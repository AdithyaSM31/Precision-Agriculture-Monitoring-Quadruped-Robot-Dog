// AgriBot camera node
// Board  : AI-Thinker ESP32-CAM (OV2640 or OV3660), programmed through the ESP32-CAM-MB
// Serves : :80/capture          one fresh JPEG
//          :80/capture?flash=1  same, with the onboard LED lit for the shot
//          :80/                 status JSON
//          :81/stream           live MJPEG video (what the dashboard shows)
// The stream runs on its own server and port, so a capture never has to wait
// for a stream to end. On boot the node registers both URLs with the
// dashboard, so there is no IP address to look up.
//
// Arduino IDE setup
//   Board        : AI Thinker ESP32-CAM
//   Upload speed : 460800 (drop to 115200 if uploads fail)

#include <WiFi.h>
#include <HTTPClient.h>
#include "esp_camera.h"
#include "esp_http_server.h"
#include "secrets.h"

// ---------------------------------------------------------------- AI-Thinker pin map
#define PWDN_GPIO_NUM  32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM  0
#define SIOD_GPIO_NUM  26
#define SIOC_GPIO_NUM  27
#define Y9_GPIO_NUM    35
#define Y8_GPIO_NUM    34
#define Y7_GPIO_NUM    39
#define Y6_GPIO_NUM    36
#define Y5_GPIO_NUM    21
#define Y4_GPIO_NUM    19
#define Y3_GPIO_NUM    18
#define Y2_GPIO_NUM    5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM  23
#define PCLK_GPIO_NUM  22
constexpr uint8_t PIN_FLASH_LED = 4;

constexpr uint32_t REGISTER_RETRY_MS = 15000;
constexpr uint32_t WIFI_RETRY_MS     = 10000;

httpd_handle_t mainServer = nullptr, streamServer = nullptr;
bool registered = false;
String registeredIp;
volatile uint32_t captures = 0, streamFrames = 0;

bool initCamera() {
  camera_config_t c = {};
  c.ledc_channel = LEDC_CHANNEL_0;
  c.ledc_timer = LEDC_TIMER_0;
  c.pin_d0 = Y2_GPIO_NUM;  c.pin_d1 = Y3_GPIO_NUM;  c.pin_d2 = Y4_GPIO_NUM;
  c.pin_d3 = Y5_GPIO_NUM;  c.pin_d4 = Y6_GPIO_NUM;  c.pin_d5 = Y7_GPIO_NUM;
  c.pin_d6 = Y8_GPIO_NUM;  c.pin_d7 = Y9_GPIO_NUM;
  c.pin_xclk = XCLK_GPIO_NUM;  c.pin_pclk = PCLK_GPIO_NUM;
  c.pin_vsync = VSYNC_GPIO_NUM;  c.pin_href = HREF_GPIO_NUM;
  c.pin_sccb_sda = SIOD_GPIO_NUM;  c.pin_sccb_scl = SIOC_GPIO_NUM;
  c.pin_pwdn = PWDN_GPIO_NUM;  c.pin_reset = RESET_GPIO_NUM;
  c.xclk_freq_hz = 20000000;
  c.pixel_format = PIXFORMAT_JPEG;
  // 640x480 keeps video smooth over Wi-Fi (~15-20 KB a frame) and is still
  // nearly three times the classifier's 224x224 input.
  c.frame_size = FRAMESIZE_VGA;
  c.jpeg_quality = 12;
  c.fb_count = psramFound() ? 2 : 1;
  c.fb_location = psramFound() ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;
  // Always hand out the newest frame; the default mode can return one that
  // was captured seconds before the request.
  c.grab_mode = CAMERA_GRAB_LATEST;

  esp_err_t err = esp_camera_init(&c);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x - check the ribbon cable is fully seated\n", err);
    return false;
  }
  sensor_t *s = esp_camera_sensor_get();
  if (s->id.PID == OV3660_PID) {  // Espressif's corrections for this sensor
    s->set_vflip(s, 1);
    s->set_brightness(s, 1);
    s->set_saturation(s, -2);
  }
  Serial.printf("Camera ready (sensor PID 0x%x, PSRAM %s)\n", s->id.PID,
                psramFound() ? "yes" : "no");
  return true;
}

// ---------------------------------------------------------------- HTTP handlers
esp_err_t captureHandler(httpd_req_t *req) {
  bool flash = false;
  char query[32], value[4];
  if (httpd_req_get_url_query_str(req, query, sizeof(query)) == ESP_OK &&
      httpd_query_key_value(query, "flash", value, sizeof(value)) == ESP_OK)
    flash = value[0] == '1';

  if (flash) { digitalWrite(PIN_FLASH_LED, HIGH); delay(120); }
  camera_fb_t *fb = esp_camera_fb_get();
  if (flash) digitalWrite(PIN_FLASH_LED, LOW);
  if (!fb) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }
  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  esp_err_t res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
  esp_camera_fb_return(fb);
  captures = captures + 1;
  return res;
}

#define PART_BOUNDARY "agribotframe"
const char *STREAM_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
const char *STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
const char *STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

// Sends frames until the viewer disconnects. Runs in the stream server's own
// task, so loop() keeps maintaining Wi-Fi meanwhile.
esp_err_t streamHandler(httpd_req_t *req) {
  esp_err_t res = httpd_resp_set_type(req, STREAM_TYPE);
  if (res != ESP_OK) return res;
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  char part[64];
  while (true) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) { res = ESP_FAIL; break; }
    size_t len = snprintf(part, sizeof(part), STREAM_PART, (unsigned)fb->len);
    res = httpd_resp_send_chunk(req, STREAM_BOUNDARY, strlen(STREAM_BOUNDARY));
    if (res == ESP_OK) res = httpd_resp_send_chunk(req, part, len);
    if (res == ESP_OK) res = httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
    esp_camera_fb_return(fb);
    if (res != ESP_OK) break;  // viewer went away
    streamFrames = streamFrames + 1;
  }
  return res;
}

esp_err_t statusHandler(httpd_req_t *req) {
  char buf[220];
  snprintf(buf, sizeof(buf),
           "{\"node\":\"esp32-cam\",\"ip\":\"%s\",\"rssi\":%d,\"uptime_s\":%lu,"
           "\"captures\":%lu,\"stream_frames\":%lu,\"registered\":%s}",
           WiFi.localIP().toString().c_str(), WiFi.RSSI(), millis() / 1000UL,
           (unsigned long)captures, (unsigned long)streamFrames,
           registered ? "true" : "false");
  httpd_resp_set_type(req, "application/json");
  return httpd_resp_send(req, buf, HTTPD_RESP_USE_STRLEN);
}

void startServers() {
  httpd_config_t cfg = HTTPD_DEFAULT_CONFIG();
  cfg.server_port = 80;
  cfg.ctrl_port = 32768;
  httpd_uri_t capture = {"/capture", HTTP_GET, captureHandler, nullptr};
  httpd_uri_t status = {"/", HTTP_GET, statusHandler, nullptr};
  if (httpd_start(&mainServer, &cfg) == ESP_OK) {
    httpd_register_uri_handler(mainServer, &capture);
    httpd_register_uri_handler(mainServer, &status);
  }
  cfg.server_port = 81;
  cfg.ctrl_port = 32769;
  httpd_uri_t stream = {"/stream", HTTP_GET, streamHandler, nullptr};
  if (httpd_start(&streamServer, &cfg) == ESP_OK)
    httpd_register_uri_handler(streamServer, &stream);
}

// ---------------------------------------------------------------- registration
// Tell the dashboard where to find us. Repeats if the IP changes (e.g. after
// the hotspot restarts) so the dashboard never points at a stale address.
void registerWithDashboard() {
  static uint32_t lastTry = 0;
  if (!WiFi.isConnected()) return;
  String ip = WiFi.localIP().toString();
  if (registered && ip == registeredIp) return;
  if (lastTry && millis() - lastTry < REGISTER_RETRY_MS) return;
  lastTry = millis();

  HTTPClient http;
  http.setConnectTimeout(2000);
  http.setTimeout(2000);
  if (!http.begin(String("http://") + SERVER_HOST + ":" + SERVER_PORT + "/api/camera")) return;
  http.addHeader("Content-Type", "application/json");
  int code = http.POST("{\"url\":\"http://" + ip + "/capture\",\"stream\":\"http://" + ip +
                       ":81/stream\"}");
  http.end();
  registered = code == 200;
  if (registered) registeredIp = ip;
  Serial.printf("Register with dashboard -> %d%s\n", code,
                registered ? "" : " (is the dashboard running? retrying)");
}

void maintainWifi() {
  static uint32_t lastTry = 0;
  if (WiFi.isConnected() || millis() - lastTry < WIFI_RETRY_MS) return;
  wl_status_t st = WiFi.status();
  if (st != WL_NO_SSID_AVAIL && st != WL_CONNECT_FAILED &&
      st != WL_CONNECTION_LOST && st != WL_DISCONNECTED) return;
  lastTry = millis();
  registered = false;
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_FLASH_LED, OUTPUT);
  digitalWrite(PIN_FLASH_LED, LOW);

  if (!initCamera()) {
    delay(3000);
    ESP.restart();
  }

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);  // power-save adds hundreds of ms of latency per frame
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to " WIFI_SSID);
  for (int i = 0; i < 40 && !WiFi.isConnected(); i++) { delay(250); Serial.print('.'); }
  Serial.println();
  if (WiFi.isConnected())
    Serial.printf("Camera URL: http://%s/capture  stream: http://%s:81/stream\n",
                  WiFi.localIP().toString().c_str(), WiFi.localIP().toString().c_str());

  startServers();
}

void loop() {
  maintainWifi();
  registerWithDashboard();
  delay(20);
}
