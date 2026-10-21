# Servo controller for the printed quadruped

`servo_controller/servo_controller.ino` drives the robot's 12 MG996R servos through a PCA9685 PWM board. It uses the same leg inverse kinematics and diagonal trot as the MuJoCo simulation (`simulation/gait.py`), ported to C++:

| Simulation (Python) | Controller (C++) |
|---|---|
| `gait.leg_ik` | `legIK` |
| `Trot.foot_targets` | `trotTargets` |
| Geometry in `model.py` (`HIP_X`, `HIP_Y`, `L0`, `L1`, `L2`) | Same constants at the top of the sketch |
| Centre-of-mass-centred footholds (`com_shift`) | `comX`, default −12 mm |

The C++ `legIK` was compared with the Python `leg_ik` at 640 foot targets. The largest joint-angle difference was 6 × 10⁻⁶ rad, which is float rounding. It compiles for the XIAO ESP32-S3 and for a generic ESP32 (core 3.3.12) with no warnings.

## Wiring

| From | To |
|---|---|
| ESP32 SDA / SCL (XIAO: D4 / D5) | PCA9685 SDA / SCL |
| ESP32 3V3 and GND | PCA9685 VCC and GND (logic) |
| 6 V supply, at least 10 A | PCA9685 V+ terminal and GND (servo power) |
| Servo plugs | Channels 0–11: FL abd, hip, knee, then FR, RL, RR |

- **Power:** never power the servos from the ESP32 or from USB. One MG996R can draw over 2 A at stall, so twelve can draw far more than USB supplies. A sagging supply is one likely reason the legs were weak in the first trials.
- **Ground:** the servo supply and the ESP32 must share ground.
- **Capacitor:** a 1000 µF capacitor across V+ and GND helps with current spikes.

## Flash

Use the Arduino IDE or arduino-cli. Pick the board (XIAO_ESP32S3 or ESP32 Dev Module), upload, and open the Serial Monitor at 115200 baud with "Newline" line ending.

```
arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3 locomotion/servo_controller
arduino-cli upload  --fqbn esp32:esp32:XIAO_ESP32S3 -p COM5 locomotion/servo_controller
```

## Calibrate (once)

Each servo needs two numbers: the pulse that puts its joint at the model's zero angle, and the direction it turns. Zero angle means abduction level, with the thigh and shank pointing straight down.

1. Lay the robot on its back, with the legs free.
2. For each joint, send `jog <ch> 0`, then adjust with `trim <ch> <us>` until the joint is at zero. For example, `trim 1 1430`.
3. Check each joint moves the right way:
   - abduction, `jog <ch> 20`: the foot swings towards the robot's left (on every leg)
   - hip, `jog <ch> 20`: the foot swings backward
   - knee, `jog <ch> -20`: the knee bends (knee angles run from 0, straight, to −157°)

   If a joint moves the wrong way, send `flip <ch>`.
4. Send `cal`, then paste the printed tables over `NEUTRAL_US` and `DIR` at the top of the sketch and re-upload.

## Commands

| Command | What it does |
|---|---|
| `relax` | Servos off (limp). This is also the state at power-up. |
| `rest` | Crouch at 100 mm |
| `stand [mm]` | Stand (default 180 mm) |
| `test` | Robot on its back: sweep each leg in turn |
| `sway` | Shift weight from side to side |
| `step` | Trot in place |
| `walk [mm/s]` | Trot forward (default 40, max 180) |
| `turn [deg/s]` | Trot while turning |
| `stop` | Stop stepping, keep standing |
| `freq <Hz>`, `lift <mm>`, `com <mm>` | Gait frequency, step height, centre-of-mass shift |
| `jog`, `trim`, `flip`, `cal`, `status` | Calibration and diagnostics |

## Suggested first session

1. `test` with the robot on its back.
2. `rest`.
3. `stand`, while holding the robot.
4. `sway`.
5. `step`.
6. `walk 40`.

If it struggles to stand, try `stand 200`. Straighter legs shorten the knee's lever arm, from about 76 mm at 180 mm height to about 43 mm at 220 mm, so the knees carry less torque.
