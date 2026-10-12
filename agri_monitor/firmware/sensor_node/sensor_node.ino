// AgriBot sensor node
// Board : Seeed XIAO ESP32-S3 on the Seeed XIAO Expansion Board v1.1
// Reads : SGP30   eCO2 / TVOC                       (I2C, Grove IIC port 1)
//         MCP9808 air temperature, +/-0.25 C        (I2C, Grove IIC port 2)
//         PPD42   dust, low-pulse occupancy          (D0)
//         HC-SR04 x2  front obstacle + canopy height (D6/D7, D8/D9)
// Shows : two rotating OLED pages, beeps on air-quality threshold crossings
// Sends : JSON to the laptop dashboard every 5 s
//
// Arduino IDE setup
//   Board package : "esp32" by Espressif (Boards Manager)
//   Board         : XIAO_ESP32S3
//   Libraries     : "Adafruit SGP30 Sensor", "U8g2" (Library Manager)

#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <Wire.h>
#include <Adafruit_SGP30.h>
#include <U8g2lib.h>
#include "secrets.h"

// ---------------------------------------------------------------- pins
// D1 (button) and D3 (buzzer) are fixed by the expansion board. D8/D9 are the
// board's microSD SPI lines - the SD slot is unused, so they drive the second
// ultrasonic instead. I2C (OLED, SGP30, MCP9808) is on D4 (SDA) / D5 (SCL).
constexpr uint8_t PIN_DUST       = D0;  // PPD42 pin 4 (P1) through divider
constexpr uint8_t PIN_BUTTON     = D1;  // onboard push button, active LOW
constexpr uint8_t PIN_BUZZER     = D3;  // onboard passive buzzer
constexpr uint8_t PIN_FRONT_TRIG = D6;  // HC-SR04 #1, facing forward
constexpr uint8_t PIN_FRONT_ECHO = D7;  //   through divider
constexpr uint8_t PIN_DOWN_TRIG  = D8;  // HC-SR04 #2, facing down at the crop
constexpr uint8_t PIN_DOWN_ECHO  = D9;  //   through divider

// ---------------------------------------------------------------- geometry
// Height of the downward ultrasonic above the ground. Canopy height is this
// minus the measured distance, so measure it with a ruler once mounted.
constexpr float DOWN_SENSOR_HEIGHT_CM = 40.0f;
constexpr float OBSTACLE_CM           = 25.0f;   // front reading below this = obstacle

// ---------------------------------------------------------------- timing
constexpr uint32_t SGP_PERIOD_MS    = 1000;   // SGP30 baseline algorithm expects 1 Hz
constexpr uint32_t DUST_WINDOW_MS   = 30000;  // PPD42 datasheet sampling window
constexpr uint32_t TEMP_PERIOD_MS   = 2000;
constexpr uint32_t SONAR_PERIOD_MS  = 250;    // alternates sensors -> each at 2 Hz
constexpr uint32_t POST_PERIOD_MS   = 5000;
constexpr uint32_t OLED_PERIOD_MS   = 500;
constexpr uint32_t OLED_PAGE_MS     = 4000;
constexpr uint32_t WIFI_RETRY_MS    = 10000;
constexpr uint32_t SGP_WARMUP_MS    = 15000;  // reads a flat 400 ppm / 0 ppb until then
constexpr uint32_t DUST_WARMUP_MS   = 60000;  // PPD42 heater needs ~1 min to settle

// ---------------------------------------------------------------- alert thresholds
// TVOC bands follow the German UBA guideline; eCO2 bands are common indoor limits.
// Dust bands are indicative only - the PPD42 is a particle counter, not a reference
// instrument.
constexpr uint16_t TVOC_MODERATE = 220,   TVOC_HIGH = 660;      // ppb
constexpr uint16_t ECO2_MODERATE = 1000,  ECO2_HIGH = 2000;     // ppm
constexpr float    DUST_MODERATE = 10000, DUST_HIGH = 20000;    // pcs / 0.01 ft^3

enum Level : uint8_t { LV_WARMUP, LV_GOOD, LV_MODERATE, LV_HIGH, LV_ABSENT };
const char *LEVEL_NAME[] = {"warmup", "good", "moderate", "high", "absent"};

// ---------------------------------------------------------------- devices
constexpr uint8_t MCP9808_ADDR = 0x18;
Adafruit_SGP30 sgp;
U8G2_SSD1306_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE);
WebServer server(80);

bool sgpOk = false, tempOk = false, muted = false;

// ---------------------------------------------------------------- readings
struct Readings {
  uint16_t eco2 = 0, tvoc = 0;
  float dustRatio = 0, dustConc = 0;  // % low time, pcs / 0.01 ft^3
  bool dustValid = false, dustPresent = true;
  Level air = LV_WARMUP, dust = LV_WARMUP;
  float tempC = NAN;
  float frontCm = NAN, downCm = NAN;  // NAN = no echo (nothing within ~4 m)
} r;

// ---------------------------------------------------------------- PPD42 low-pulse timing
// The sensor pulls P1 LOW while particles cross its beam. Concentration follows
// from the fraction of time the line spends LOW over a 30 s window. Timing it in
// an interrupt keeps loop() free, unlike the usual blocking pulseIn() approach.
portMUX_TYPE dustMux = portMUX_INITIALIZER_UNLOCKED;
volatile uint32_t dustLowAccumUs = 0;
volatile uint32_t dustLowStartUs = 0;
volatile bool dustIsLow = false;
volatile uint32_t dustEdges = 0;

void IRAM_ATTR onDustEdge() {
  uint32_t now = micros();
  portENTER_CRITICAL_ISR(&dustMux);
  dustEdges = dustEdges + 1;
  if (digitalRead(PIN_DUST) == LOW) {
    if (!dustIsLow) { dustIsLow = true; dustLowStartUs = now; }
  } else if (dustIsLow) {
    dustLowAccumUs += now - dustLowStartUs;
    dustIsLow = false;
  }
  portEXIT_CRITICAL_ISR(&dustMux);
}

// Returns LOW time in the window just ended and starts a new one. A pulse still
// in progress is split at the window boundary so no time is lost or double counted.
uint32_t takeDustLowUs(uint32_t &edges) {
  uint32_t now = micros();
  portENTER_CRITICAL(&dustMux);
  uint32_t lowUs = dustLowAccumUs;
  if (dustIsLow) { lowUs += now - dustLowStartUs; dustLowStartUs = now; }
  dustLowAccumUs = 0;
  edges = dustEdges;
  dustEdges = 0;
  portEXIT_CRITICAL(&dustMux);
  return lowUs;
}

// ---------------------------------------------------------------- MCP9808
uint16_t mcpRead16(uint8_t reg) {
  Wire.beginTransmission(MCP9808_ADDR);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return 0xFFFF;
  if (Wire.requestFrom(MCP9808_ADDR, (uint8_t)2) != 2) return 0xFFFF;
  uint16_t hi = Wire.read();
  return (hi << 8) | Wire.read();
}

bool mcpBegin() {
  // Manufacturer ID 0x0054 and device ID 0x04 identify a genuine MCP9808.
  return mcpRead16(0x06) == 0x0054 && (mcpRead16(0x07) >> 8) == 0x04;
}

float mcpReadC() {
  uint16_t raw = mcpRead16(0x05);  // ambient temperature register
  if (raw == 0xFFFF) return NAN;
  float t = (raw & 0x0FFF) / 16.0f;
  if (raw & 0x1000) t -= 256.0f;  // sign bit
  return t;
}

// ---------------------------------------------------------------- HC-SR04
// Speed of sound rises ~0.6 m/s per degree C; using the MCP9808 reading
// instead of a fixed 343 m/s removes a ~2 % error on a hot field day.
float soundSpeedCmPerUs() {
  float t = isnan(r.tempC) ? 20.0f : r.tempC;
  return (331.3f + 0.606f * t) / 10000.0f;
}

float readSonarCm(uint8_t trig, uint8_t echo) {
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);
  uint32_t us = pulseIn(echo, HIGH, 25000);  // 25 ms ~= 4.3 m, the sensor's limit
  if (us == 0) return NAN;
  return us * soundSpeedCmPerUs() / 2.0f;
}

// Median of the last three readings rejects the odd stray echo.
struct Median3 {
  float v[3] = {NAN, NAN, NAN};
  uint8_t i = 0;
  float push(float x) {
    v[i] = x; i = (i + 1) % 3;
    float a = v[0], b = v[1], c = v[2];
    if (isnan(a) || isnan(b) || isnan(c)) return x;
    return max(min(a, b), min(max(a, b), c));
  }
} frontFilter, downFilter;

float canopyCm() {
  if (isnan(r.downCm)) return NAN;
  return max(0.0f, DOWN_SENSOR_HEIGHT_CM - r.downCm);
}

// ---------------------------------------------------------------- helpers
Level gradeAir(uint16_t eco2, uint16_t tvoc) {
  if (tvoc >= TVOC_HIGH || eco2 >= ECO2_HIGH) return LV_HIGH;
  if (tvoc >= TVOC_MODERATE || eco2 >= ECO2_MODERATE) return LV_MODERATE;
  return LV_GOOD;
}

Level gradeDust(float conc) {
  if (conc >= DUST_HIGH) return LV_HIGH;
  if (conc >= DUST_MODERATE) return LV_MODERATE;
  return LV_GOOD;
}

void beep(uint8_t times) {
  if (muted) return;
  for (uint8_t i = 0; i < times; i++) {
    tone(PIN_BUZZER, 2700, 120);
    delay(180);
  }
}

// JSON has no NaN, so missing readings are sent as null.
void jsonNum(char *out, size_t n, float v, int decimals) {
  if (isnan(v)) snprintf(out, n, "null");
  else snprintf(out, n, "%.*f", decimals, v);
}

String toJson() {
  char temp[16], front[16], down[16], canopy[16], buf[520];
  jsonNum(temp, sizeof(temp), r.tempC, 2);
  jsonNum(front, sizeof(front), r.frontCm, 1);
  jsonNum(down, sizeof(down), r.downCm, 1);
  jsonNum(canopy, sizeof(canopy), canopyCm(), 1);
  bool obstacle = !isnan(r.frontCm) && r.frontCm < OBSTACLE_CM;
  snprintf(buf, sizeof(buf),
           "{\"node\":\"xiao-s3\",\"uptime_s\":%lu,\"rssi\":%d,"
           "\"sgp30_ok\":%s,\"eco2_ppm\":%u,\"tvoc_ppb\":%u,\"air_level\":\"%s\","
           "\"dust_present\":%s,\"dust_valid\":%s,\"dust_ratio_pct\":%.3f,\"dust_pcs_per_0_01cf\":%.1f,"
           "\"dust_level\":\"%s\",\"mcp9808_ok\":%s,\"temp_c\":%s,"
           "\"front_cm\":%s,\"obstacle\":%s,\"down_cm\":%s,\"canopy_cm\":%s,"
           "\"muted\":%s}",
           millis() / 1000UL, WiFi.isConnected() ? WiFi.RSSI() : 0,
           sgpOk ? "true" : "false", r.eco2, r.tvoc, LEVEL_NAME[r.air],
           r.dustPresent ? "true" : "false", r.dustValid ? "true" : "false",
           r.dustRatio, r.dustConc,
           LEVEL_NAME[r.dust], tempOk ? "true" : "false", temp,
           front, obstacle ? "true" : "false", down, canopy,
           muted ? "true" : "false");
  return String(buf);
}

// ---------------------------------------------------------------- tasks
void readSgp30() {
  if (!sgpOk) return;
  if (!sgp.IAQmeasure()) { Serial.println("SGP30 read failed"); return; }
  r.eco2 = sgp.eCO2;
  r.tvoc = sgp.TVOC;
  Level prev = r.air;
  r.air = millis() < SGP_WARMUP_MS ? LV_WARMUP : gradeAir(r.eco2, r.tvoc);
  if (r.air == LV_HIGH && prev != LV_HIGH) beep(3);
}

void readTemperature() {
  if (!tempOk) return;
  float t = mcpReadC();
  if (!isnan(t)) r.tempC = t;
}

// Fires one sensor per call so the two never hear each other's ping.
void readSonars() {
  static bool front = true;
  if (front) r.frontCm = frontFilter.push(readSonarCm(PIN_FRONT_TRIG, PIN_FRONT_ECHO));
  else r.downCm = downFilter.push(readSonarCm(PIN_DOWN_TRIG, PIN_DOWN_ECHO));
  front = !front;
}

void closeDustWindow(uint32_t windowMs) {
  uint32_t edges;
  uint32_t lowUs = takeDustLowUs(edges);
  // A working PPD42 idles HIGH and pulses LOW. A line held LOW for a whole
  // window with no pulses means no sensor (the pin's pull-down, or the
  // divider's bottom resistors, hold it there) - not maximum dust.
  if (edges == 0 && digitalRead(PIN_DUST) == LOW) {
    r.dustPresent = false;
    r.dustValid = false;
    r.dust = LV_ABSENT;
    Serial.println("dust: PPD42 not detected (pin held LOW, no pulses) - check wiring");
    return;
  }
  r.dustPresent = true;
  float ratio = lowUs / (windowMs * 10.0f);  // percent of window spent LOW
  // Shinyei's published curve for the PPD42 (particles > 1 um)
  r.dustRatio = ratio;
  r.dustConc = 1.1f * powf(ratio, 3) - 3.8f * powf(ratio, 2) + 520.0f * ratio + 0.62f;
  r.dustValid = millis() >= DUST_WARMUP_MS;
  Level prev = r.dust;
  r.dust = r.dustValid ? gradeDust(r.dustConc) : LV_WARMUP;
  if (r.dust == LV_HIGH && prev != LV_HIGH) beep(2);
  Serial.printf("dust: low %.3f %%  ->  %.0f pcs/0.01cf (%s)\n",
                r.dustRatio, r.dustConc, LEVEL_NAME[r.dust]);
}

void postToLaptop() {
  if (!WiFi.isConnected()) return;
  HTTPClient http;
  http.setConnectTimeout(1500);
  http.setTimeout(1500);
  String url = String("http://") + SERVER_HOST + ":" + SERVER_PORT + "/api/sensors";
  if (!http.begin(url)) return;
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(toJson());
  if (code != 200) Serial.printf("POST %s -> %d\n", url.c_str(), code);
  http.end();
}

const char *wifiState() {
  switch (WiFi.status()) {
    case WL_CONNECTED:      return "connected";
    case WL_NO_SSID_AVAIL:  return "network not found (antenna fitted? 2.4 GHz?)";
    case WL_CONNECT_FAILED: return "connect failed (password?)";
    case WL_CONNECTION_LOST:return "connection lost";
    default:                return "connecting";
  }
}

void printSummary() {
  Serial.printf("eCO2 %u ppm  TVOC %u ppb  temp %.2f C  front %.1f cm  down %.1f cm  "
                "canopy %.1f cm  WiFi %s\n",
                r.eco2, r.tvoc, r.tempC, r.frontCm, r.downCm, canopyCm(),
                WiFi.isConnected() ? WiFi.localIP().toString().c_str() : wifiState());
}

void drawAirPage() {
  char line[24];
  if (sgpOk) {
    snprintf(line, sizeof(line), "eCO2 %5u ppm", r.eco2);
    oled.drawStr(0, 24, line);
    snprintf(line, sizeof(line), "TVOC %5u ppb", r.tvoc);
    oled.drawStr(0, 35, line);
    oled.drawStr(92, 35, LEVEL_NAME[r.air]);
  } else {
    oled.drawStr(0, 30, "SGP30 not found");
  }
  if (!r.dustPresent) snprintf(line, sizeof(line), "Dust: no sensor");
  else if (r.dustValid) snprintf(line, sizeof(line), "Dust %6.0f pcs", r.dustConc);
  else snprintf(line, sizeof(line), "Dust warming %2lus",
                (unsigned long)(DUST_WARMUP_MS - min<uint32_t>(millis(), DUST_WARMUP_MS)) / 1000UL);
  oled.drawStr(0, 46, line);
  if (r.dustValid) oled.drawStr(92, 46, LEVEL_NAME[r.dust]);
}

void drawFieldPage() {
  char line[24];
  if (tempOk && !isnan(r.tempC)) snprintf(line, sizeof(line), "Temp   %6.2f C", r.tempC);
  else snprintf(line, sizeof(line), "MCP9808 not found");
  oled.drawStr(0, 24, line);
  if (isnan(r.frontCm)) snprintf(line, sizeof(line), "Front     --- cm");
  else snprintf(line, sizeof(line), "Front  %6.1f cm", r.frontCm);
  oled.drawStr(0, 35, line);
  if (!isnan(r.frontCm) && r.frontCm < OBSTACLE_CM) oled.drawStr(104, 35, "STOP");
  float canopy = canopyCm();
  if (isnan(canopy)) snprintf(line, sizeof(line), "Canopy    --- cm");
  else snprintf(line, sizeof(line), "Canopy %6.1f cm", canopy);
  oled.drawStr(0, 46, line);
}

void drawOled() {
  bool fieldPage = (millis() / OLED_PAGE_MS) % 2;
  oled.clearBuffer();
  oled.setFont(u8g2_font_6x10_tf);
  oled.drawStr(0, 9, fieldPage ? "AgriBot field" : "AgriBot air");
  if (muted) oled.drawStr(104, 9, "MUTE");
  oled.drawHLine(0, 12, 128);
  if (fieldPage) drawFieldPage(); else drawAirPage();
  oled.drawHLine(0, 51, 128);
  if (WiFi.isConnected()) oled.drawStr(0, 62, WiFi.localIP().toString().c_str());
  else oled.drawStr(0, 62, "WiFi connecting...");
  oled.sendBuffer();
}

// Retries only after an attempt has actually ended. Calling begin() while the
// driver is still mid-handshake aborts it ("sta is connecting, cannot set config").
void maintainWifi() {
  static uint32_t lastTry = 0;
  if (WiFi.isConnected() || millis() - lastTry < WIFI_RETRY_MS) return;
  wl_status_t st = WiFi.status();
  if (st != WL_NO_SSID_AVAIL && st != WL_CONNECT_FAILED &&
      st != WL_CONNECTION_LOST && st != WL_DISCONNECTED) return;
  lastTry = millis();
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void pollButton() {
  static bool wasDown = false;
  static uint32_t downAt = 0;
  bool down = digitalRead(PIN_BUTTON) == LOW;
  if (down && !wasDown) downAt = millis();
  if (!down && wasDown && millis() - downAt > 30) {  // debounced release
    muted = !muted;
    if (!muted) tone(PIN_BUZZER, 2000, 60);
  }
  wasDown = down;
}

// ---------------------------------------------------------------- setup / loop
void setup() {
  Serial.begin(115200);
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_DUST, INPUT_PULLDOWN);  // an unplugged sensor reads LOW, not noise
  pinMode(PIN_FRONT_TRIG, OUTPUT);
  pinMode(PIN_FRONT_ECHO, INPUT);
  pinMode(PIN_DOWN_TRIG, OUTPUT);
  pinMode(PIN_DOWN_ECHO, INPUT);
  attachInterrupt(digitalPinToInterrupt(PIN_DUST), onDustEdge, CHANGE);

  Wire.begin();
  oled.begin();
  oled.clearBuffer();
  oled.setFont(u8g2_font_6x10_tf);
  oled.drawStr(0, 30, "AgriBot starting...");
  oled.sendBuffer();

  sgpOk = sgp.begin();
  Serial.println(sgpOk ? "SGP30 found" : "SGP30 NOT found - check its I2C wiring");
  tempOk = mcpBegin();
  Serial.println(tempOk ? "MCP9808 found" : "MCP9808 NOT found - check its Grove cable");

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Local endpoint so the readings can be checked from a phone browser too.
  server.on("/", []() { server.send(200, "application/json", toJson()); });
  server.begin();

  tone(PIN_BUZZER, 2000, 80);
}

void loop() {
  static uint32_t lastSgp = 0, lastDust = 0, lastTemp = 0, lastSonar = 0,
                  lastPost = 0, lastOled = 0;
  uint32_t now = millis();

  if (now - lastSgp >= SGP_PERIOD_MS) { lastSgp = now; readSgp30(); }
  if (now - lastTemp >= TEMP_PERIOD_MS) { lastTemp = now; readTemperature(); }
  if (now - lastSonar >= SONAR_PERIOD_MS) { lastSonar = now; readSonars(); }
  if (now - lastDust >= DUST_WINDOW_MS) { closeDustWindow(now - lastDust); lastDust = now; }
  if (now - lastPost >= POST_PERIOD_MS) { lastPost = now; postToLaptop(); printSummary(); }
  if (now - lastOled >= OLED_PERIOD_MS) { lastOled = now; drawOled(); }

  pollButton();
  maintainWifi();
  server.handleClient();
}
