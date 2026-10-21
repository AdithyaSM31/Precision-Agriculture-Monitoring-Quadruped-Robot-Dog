// AgriBot servo controller: drives the 12 MG996R servos of the printed quadruped
// through a PCA9685 16-channel PWM board, using the same leg inverse kinematics
// and diagonal trot as the MuJoCo simulation (simulation/gait.py).
//
// Board: any ESP32 (XIAO ESP32-S3 included) or Arduino with I2C. The PCA9685 is
// at address 0x40 on the default SDA/SCL pins. Servos are powered from their own
// 6 V supply into the PCA9685's V+ terminal - never from the microcontroller.
//
// Control is by text commands over USB serial at 115200 baud (newline ending).
// Type "help" for the list. On power-up the servos stay limp until you send a
// command, so the robot never jumps on boot.

#include <Wire.h>
#include <math.h>

// Types first: the Arduino builder puts function prototypes above the first function.
struct Angles { float abd, hip, knee; };
enum Mode { RELAX, POSE, TEST, SWAY, TROT, JOG };

// ---------------------------------------------------------------- geometry (m)
// Measured from the printed chassis - identical to simulation/model.py.
const float HIP_X = 0.070f, HIP_Y = 0.039f;   // abduction joints: 140 x 78 mm spacing
const float L0 = 0.060f;                      // shoulder (abduction) offset
const float L1 = 0.111f;                      // femur
const float L2 = 0.125f;                      // tibia

enum Leg { FL, FR, RL, RR };
const char *LEG_NAME[4] = {"FL", "FR", "RL", "RR"};
const int FORE[4] = {1, 1, -1, -1};           // +1 front legs, -1 rear legs
const int SIDE[4] = {1, -1, 1, -1};           // +1 left legs, -1 right legs
const float PHASE[4] = {0.0f, 0.5f, 0.5f, 0.0f};  // trot: FL+RR together, FR+RL together
const char *JOINT_NAME[3] = {"abd", "hip", "knee"};

// ---------------------------------------------------------------- wiring and calibration
// PCA9685 channel for each joint, [leg][abd, hip, knee]. Change to match your wiring.
uint8_t CH[4][3] = {{0, 1, 2}, {3, 4, 5}, {6, 7, 8}, {9, 10, 11}};

// Pulse in microseconds that puts each joint at the model's ZERO angle:
// abduction with the leg vertical, thigh and shank pointing straight down.
// Start at 1500 and set each one with the "jog" and "trim" commands, then paste
// the table printed by "cal" back here.
int NEUTRAL_US[4][3] = {{1500, 1500, 1500}, {1500, 1500, 1500},
                        {1500, 1500, 1500}, {1500, 1500, 1500}};

// +1 or -1: which way each servo turns for a positive model angle. Positive
// abduction swings the foot to the robot's left, positive hip swings it backward,
// and knees bend to negative angles. Mirrored legs usually need opposite signs.
// Check each joint with "jog" and fix with "flip".
int8_t DIR[4][3] = {{1, 1, 1}, {-1, -1, -1}, {1, 1, 1}, {-1, -1, -1}};

const float US_PER_DEG = 2000.0f / 180.0f;    // MG996R: ~500-2500 us over ~180 deg
const int PULSE_MIN_US = 500, PULSE_MAX_US = 2500;

// Joint limits in radians (same ranges as the simulation's joints).
const float LIM_LO[3] = {-0.6f, -1.7f, -2.75f};
const float LIM_HI[3] = {0.6f, 1.7f, 0.0f};

// ---------------------------------------------------------------- motion settings
const float CTRL_HZ = 50.0f;                  // servo update rate (one PWM period)
const float CTRL_DT = 1.0f / CTRL_HZ;
const float REST_HEIGHT = 0.100f;             // crouched body height (hip to foot), m
float standHeight = 0.180f;                   // standing height, m (as in the simulation)
float stepHeight = 0.030f;                    // foot lift in swing, m
float gaitFreq = 1.5f;                        // steps per second (simulation used 2.0)
float duty = 0.6f;                            // fraction of the cycle a foot is on the ground
// The knees-back legs put the centre of mass ~12 mm behind the body centre, so
// feet are placed around it (the simulation's key finding). Tune with "com".
float comX = -0.012f, comY = 0.0f;

// ---------------------------------------------------------------- PCA9685 driver
const uint8_t PCA_ADDR = 0x40;
const float PCA_OSC_HZ = 25000000.0f;         // internal oscillator; a few % off on some boards

void pcaWrite(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(PCA_ADDR);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

bool pcaBegin() {
  Wire.beginTransmission(PCA_ADDR);
  if (Wire.endTransmission() != 0) return false;
  uint8_t prescale = (uint8_t)lroundf(PCA_OSC_HZ / (4096.0f * CTRL_HZ)) - 1;  // 121 for 50 Hz
  pcaWrite(0x00, 0x10);                       // MODE1: sleep (prescale can only change asleep)
  pcaWrite(0xFE, prescale);
  pcaWrite(0x00, 0x20);                       // wake, register auto-increment on
  delay(1);
  pcaWrite(0x00, 0xA0);                       // restart PWM, keep auto-increment
  pcaWrite(0x01, 0x04);                       // MODE2: totem-pole outputs
  return true;
}

// Sets one channel's pulse width; 0 switches the channel fully off (servo limp).
void pcaPulse(uint8_t ch, int us) {
  Wire.beginTransmission(PCA_ADDR);
  Wire.write(0x06 + 4 * ch);                  // LEDn_ON_L
  Wire.write(0);
  Wire.write(0);                              // pulse starts at tick 0
  if (us <= 0) {
    Wire.write(0);
    Wire.write(0x10);                         // full-OFF bit
  } else {
    uint16_t ticks = (uint16_t)((uint32_t)us * 4096UL * (uint32_t)CTRL_HZ / 1000000UL);
    Wire.write(ticks & 0xFF);
    Wire.write(ticks >> 8);
  }
  Wire.endTransmission();
}

// ---------------------------------------------------------------- kinematics
float wrapPi(float a) {
  while (a > PI) a -= 2 * PI;
  while (a < -PI) a += 2 * PI;
  return a;
}

// Joint angles that put the foot at (px, py, pz), relative to the leg's abduction
// joint in the body frame (x forward, y left, z up). Port of gait.leg_ik, which
// was checked against MuJoCo's forward kinematics to below 1e-7 m.
Angles legIK(float px, float py, float pz, int side) {
  Angles a;
  float h = sqrtf(fmaxf(py * py + pz * pz - L0 * L0, 1e-9f));  // leg length in the y-z plane
  a.abd = wrapPi(atan2f(pz, py) - atan2f(-h, side * L0));
  float c = (px * px + h * h - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  c = fminf(1.0f, fmaxf(-1.0f, c));
  a.knee = -acosf(c);                                          // knee behind the foot
  a.hip = atan2f(-px, h) - atan2f(L2 * sinf(a.knee), L1 + L2 * cosf(a.knee));
  return a;
}

// ---------------------------------------------------------------- servo output
float jointNow[4][3];                         // last commanded model angles (rad)
bool driving = false;                         // false = all servos limp

int pulseFor(int leg, int j, float rad) {
  rad = fminf(LIM_HI[j], fmaxf(LIM_LO[j], rad));
  int us = NEUTRAL_US[leg][j] + (int)lroundf(DIR[leg][j] * rad * (180.0f / PI) * US_PER_DEG);
  return constrain(us, PULSE_MIN_US, PULSE_MAX_US);
}

void writeJoint(int leg, int j, float rad) {
  jointNow[leg][j] = rad;
  if (driving) pcaPulse(CH[leg][j], pulseFor(leg, j, rad));
}

void writeLeg(int leg, const Angles &a) {
  writeJoint(leg, 0, a.abd);
  writeJoint(leg, 1, a.hip);
  writeJoint(leg, 2, a.knee);
}

void relaxAll() {
  driving = false;
  for (int leg = 0; leg < 4; leg++)
    for (int j = 0; j < 3; j++) pcaPulse(CH[leg][j], 0);
}

// ---------------------------------------------------------------- behaviours
Mode mode = RELAX;
float height = REST_HEIGHT, heightTarget = REST_HEIGHT;
float vCmd = 0.0f, wCmd = 0.0f;               // forward speed (m/s) and yaw rate (rad/s)
float phase = 0.0f, amp = 0.0f, modeTime = 0.0f;
int jogLeg = 0, jogJoint = 0;
float jogAngle = 0.0f;

const char *MODE_NAME[] = {"relaxed", "pose", "leg test", "sway", "trot", "jog"};

void setMode(Mode m) {
  mode = m;
  modeTime = 0.0f;
  if (m != RELAX) driving = true;
}

// Foot targets for the trot - port of gait.Trot.foot_targets (no IMU levelling).
void trotTargets(float out[4][3]) {
  amp += ((mode == TROT) ? 1.0f : -1.0f) * CTRL_DT / 0.4f;     // ramp stepping in and out
  amp = fminf(1.0f, fmaxf(0.0f, amp));
  phase = fmodf(phase + gaitFreq * CTRL_DT, 1.0f);
  float tStance = duty / gaitFreq;
  for (int leg = 0; leg < 4; leg++) {
    float fx = FORE[leg] * HIP_X, fy = SIDE[leg] * (HIP_Y + L0);  // foot's nominal spot
    float vx = vCmd - wCmd * fy, vy = wCmd * fx;                 // ground velocity at that foot
    float sx = vx * tStance * amp, sy = vy * tStance * amp;
    float p = fmodf(phase + PHASE[leg], 1.0f);
    float dx, dy, dz;
    if (p < duty) {                                              // stance: foot slides back
      float u = p / duty;
      dx = sx * (0.5f - u);
      dy = sy * (0.5f - u);
      dz = 0.0f;
    } else {                                                     // swing: lift and reach forward
      float u = (p - duty) / (1.0f - duty);
      float k = (1.0f - cosf(PI * u)) / 2.0f;
      dx = sx * (k - 0.5f);
      dy = sy * (k - 0.5f);
      dz = stepHeight * amp * sinf(PI * u);
    }
    out[leg][0] = dx + comX;
    out[leg][1] = SIDE[leg] * L0 + dy + comY;
    out[leg][2] = -height + dz;
  }
}

// One control tick: work out every joint angle for the current mode and send it.
void controlTick() {
  modeTime += CTRL_DT;
  // body height moves smoothly towards its target at 5 cm/s
  float dh = heightTarget - height, step = 0.05f * CTRL_DT;
  height += fminf(step, fmaxf(-step, dh));

  if (mode == RELAX) return;
  if (mode == JOG) {
    writeJoint(jogLeg, jogJoint, jogAngle);
    return;
  }
  if (mode == TEST) {
    // Robot on its back: each leg in turn sweeps hip, knee and abduction around
    // the crouched pose, 4 s per leg. Confirms wiring and joint directions.
    int active = ((int)(modeTime / 4.0f)) % 4;
    float s = sinf(2 * PI * modeTime / 2.0f);
    for (int leg = 0; leg < 4; leg++) {
      Angles a = legIK(0.0f, SIDE[leg] * L0, -REST_HEIGHT, SIDE[leg]);
      if (leg == active) {
        a.hip += 0.35f * s;
        a.knee += 0.35f * s;
        a.abd += 0.20f * sinf(2 * PI * modeTime / 4.0f);
      }
      writeLeg(leg, a);
    }
    return;
  }

  float targets[4][3];
  float savedComY = comY;
  if (mode == SWAY) comY = 0.020f * sinf(2 * PI * 0.25f * modeTime);  // shift weight left-right
  trotTargets(targets);
  comY = savedComY;
  for (int leg = 0; leg < 4; leg++)
    writeLeg(leg, legIK(targets[leg][0], targets[leg][1], targets[leg][2], SIDE[leg]));
}

// ---------------------------------------------------------------- serial commands
void printHelp() {
  Serial.println(F(
    "\nAgriBot servo controller - commands:\n"
    "  relax            servos off (limp)\n"
    "  rest             crouch at 100 mm\n"
    "  stand [mm]       stand up (default 180 mm, as in the simulation)\n"
    "  test             robot ON ITS BACK: sweep each leg in turn\n"
    "  sway             stand and shift weight from side to side\n"
    "  step             trot in place\n"
    "  walk [mm/s]      trot forward (default 40, max 180)\n"
    "  turn [deg/s]     trot while turning on the spot (default 15)\n"
    "  stop             stop stepping, keep standing\n"
    "  freq <Hz>        gait frequency (default 1.5)\n"
    "  lift <mm>        step height (default 30)\n"
    "  com <mm>         centre-of-mass shift along x (default -12)\n"
    "  jog <ch> <deg>   move one joint to a model angle (ch 0-11 = FL abd,hip,knee, FR..., RL..., RR...)\n"
    "  trim <ch> <us>   set the neutral pulse of a joint\n"
    "  flip <ch>        reverse a joint's direction\n"
    "  cal              print the calibration tables to paste into the sketch\n"
    "  status           show mode, height and joint angles\n"));
}

void printCalibration() {
  Serial.println(F("\n// paste over the tables at the top of servo_controller.ino"));
  Serial.print(F("int NEUTRAL_US[4][3] = {"));
  for (int leg = 0; leg < 4; leg++)
    Serial.printf("{%d, %d, %d}%s", NEUTRAL_US[leg][0], NEUTRAL_US[leg][1], NEUTRAL_US[leg][2], leg < 3 ? ", " : "};\n");
  Serial.print(F("int8_t DIR[4][3] = {"));
  for (int leg = 0; leg < 4; leg++)
    Serial.printf("{%d, %d, %d}%s", DIR[leg][0], DIR[leg][1], DIR[leg][2], leg < 3 ? ", " : "};\n");
}

void printStatus() {
  Serial.printf("mode %s, height %.0f mm (target %.0f), freq %.2f Hz, com x %.0f mm\n",
                MODE_NAME[mode], height * 1000, heightTarget * 1000, gaitFreq, comX * 1000);
  for (int leg = 0; leg < 4; leg++)
    Serial.printf("  %s  abd %6.1f  hip %6.1f  knee %6.1f deg\n", LEG_NAME[leg],
                  jointNow[leg][0] * 180 / PI, jointNow[leg][1] * 180 / PI, jointNow[leg][2] * 180 / PI);
}

bool channelToJoint(int ch, int &leg, int &j) {
  if (ch < 0 || ch > 11) { Serial.println(F("joint index must be 0-11")); return false; }
  leg = ch / 3;
  j = ch % 3;
  return true;
}

void handleCommand(String line) {
  line.trim();
  if (!line.length()) return;
  int sp = line.indexOf(' ');
  String cmd = sp < 0 ? line : line.substring(0, sp);
  String rest = sp < 0 ? "" : line.substring(sp + 1);
  rest.trim();
  float a1 = rest.toFloat();
  int sp2 = rest.indexOf(' ');
  float a2 = sp2 < 0 ? 0.0f : rest.substring(sp2 + 1).toFloat();
  bool hasArg = rest.length() > 0;

  if (cmd == "help") printHelp();
  else if (cmd == "relax") { mode = RELAX; relaxAll(); }
  else if (cmd == "rest") { heightTarget = REST_HEIGHT; vCmd = wCmd = 0; setMode(POSE); }
  else if (cmd == "stand") {
    if (hasArg) standHeight = constrain(a1, 90.0f, 225.0f) / 1000.0f;
    heightTarget = standHeight; vCmd = wCmd = 0; setMode(POSE);
  }
  else if (cmd == "test") { heightTarget = height = REST_HEIGHT; setMode(TEST); }
  else if (cmd == "sway") { heightTarget = standHeight; vCmd = wCmd = 0; setMode(SWAY); }
  else if (cmd == "step") { heightTarget = standHeight; vCmd = wCmd = 0; setMode(TROT); }
  else if (cmd == "walk") {
    vCmd = constrain(hasArg ? a1 : 40.0f, -180.0f, 180.0f) / 1000.0f;
    wCmd = 0; heightTarget = standHeight; setMode(TROT);
  }
  else if (cmd == "turn") {
    wCmd = constrain(hasArg ? a1 : 15.0f, -30.0f, 30.0f) * PI / 180.0f;
    vCmd = 0; heightTarget = standHeight; setMode(TROT);
  }
  else if (cmd == "stop") { vCmd = wCmd = 0; mode = POSE; }
  else if (cmd == "freq" && hasArg) gaitFreq = constrain(a1, 0.5f, 3.0f);
  else if (cmd == "lift" && hasArg) stepHeight = constrain(a1, 0.0f, 50.0f) / 1000.0f;
  else if (cmd == "com" && hasArg) comX = constrain(a1, -40.0f, 40.0f) / 1000.0f;
  else if (cmd == "jog" && hasArg) {
    if (channelToJoint((int)a1, jogLeg, jogJoint)) {
      jogAngle = a2 * PI / 180.0f;
      setMode(JOG);
      Serial.printf("%s %s -> %.1f deg = %d us\n", LEG_NAME[jogLeg], JOINT_NAME[jogJoint], a2,
                    pulseFor(jogLeg, jogJoint, jogAngle));
    }
  }
  else if (cmd == "trim" && sp2 > 0) {
    int leg, j;
    if (channelToJoint((int)a1, leg, j)) {
      NEUTRAL_US[leg][j] = constrain((int)a2, PULSE_MIN_US, PULSE_MAX_US);
      Serial.printf("%s %s neutral = %d us\n", LEG_NAME[leg], JOINT_NAME[j], NEUTRAL_US[leg][j]);
    }
  }
  else if (cmd == "flip" && hasArg) {
    int leg, j;
    if (channelToJoint((int)a1, leg, j)) {
      DIR[leg][j] = -DIR[leg][j];
      Serial.printf("%s %s direction = %d\n", LEG_NAME[leg], JOINT_NAME[j], DIR[leg][j]);
    }
  }
  else if (cmd == "cal") printCalibration();
  else if (cmd == "status") printStatus();
  else { Serial.print(F("unknown command: ")); Serial.println(line); Serial.println(F("type help")); return; }
  if (cmd != "help" && cmd != "cal" && cmd != "status") Serial.printf("ok - mode %s\n", MODE_NAME[mode]);
}

// ---------------------------------------------------------------- setup / loop
void setup() {
  Serial.begin(115200);
  delay(300);
  Wire.begin();
  Wire.setClock(400000);
  if (!pcaBegin()) Serial.println(F("PCA9685 not found at 0x40 - check SDA/SCL, VCC and GND"));
  relaxAll();
  for (int leg = 0; leg < 4; leg++) {
    Angles a = legIK(0.0f, SIDE[leg] * L0, -REST_HEIGHT, SIDE[leg]);
    jointNow[leg][0] = a.abd; jointNow[leg][1] = a.hip; jointNow[leg][2] = a.knee;
  }
  printHelp();
  Serial.println(F("Servos are limp. Lay the robot on its back and send 'test', or 'rest' to crouch."));
}

void loop() {
  static uint32_t lastTick = 0;
  static String line;
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') { handleCommand(line); line = ""; }
    else if (line.length() < 64) line += c;
  }
  uint32_t now = micros();
  if (now - lastTick >= (uint32_t)(CTRL_DT * 1e6f)) {
    lastTick = now;
    controlTick();
  }
}
