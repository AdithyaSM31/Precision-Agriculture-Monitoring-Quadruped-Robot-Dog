# Code walkthrough for the panel

When the panel asks to see code, open this repository in VS Code and go through the stops below in order. Each stop takes about a minute and backs up a claim on the slides. Use **Ctrl+G** to jump to a line number.

The whole system is about 2,600 lines in three languages:

| Part | Language | Files |
|---|---|---|
| Sensor and camera firmware | C++ (Arduino-ESP32) | `agri_monitor/firmware/` |
| Dashboard and classifier | Python (Flask, Transformers) | `agri_monitor/dashboard/` |
| Physics simulation | Python (MuJoCo) | `simulation/` |
| Servo controller | C++ (Arduino-ESP32) | `locomotion/servo_controller/` |

If they ask a general question first, say: *"Each part is small and does one job. The robot's microcontrollers only sense and stream; the laptop does the heavy work; the simulation and the servo controller share the same kinematics."*

---

## Stop 1: the sensor node's main loop
**File:** `agri_monitor/firmware/sensor_node/sensor_node.ino`, `loop()` at **line 418**

> "There is no operating system. `loop()` is a cooperative scheduler: each task runs when its own period has elapsed. Gas is read every second, temperature every 2 s, the ultrasonics every 0.25 s, the dust window closes every 30 s, and the node posts to the laptop every 5 s. Nothing blocks, so Wi-Fi and the local web server stay responsive."

## Stop 2: dust sensing and the absent-sensor fix
**Same file, `onDustEdge()` at line 92 and `closeDustWindow()` at line 254**

> "`onDustEdge` is an interrupt that runs on every edge of the PPD42's output. It adds up how long the line was low. Every 30 s, `closeDustWindow` turns that low-time percentage into particles using the manufacturer's curve, on the `r.dustConc = 1.1 r³ − 3.8 r² + 520 r + 0.62` line.
>
> Just above it is the fix for a real bug: an unplugged sensor held the pin low and read as 1.1 million particles. Now, zero edges plus a low line means *absent*."

Also show `soundSpeedCmPerUs()` at **line 145**, the temperature-corrected speed of sound: `331.3 + 0.606·T`.

## Stop 3: the camera node
**File:** `agri_monitor/firmware/camera_node/camera_node.ino`

- **`streamHandler()`, line 117:** "An endless multipart response. Each JPEG frame goes out as one part, which is how MJPEG video works in a browser."
- **Line 69, `CAMERA_GRAB_LATEST`:** "The camera always hands over the newest frame, never a stale buffered one."
- **`registerWithDashboard()`, line 168:** "At boot the camera posts its own URLs to the dashboard, so its IP address never has to be typed in."

## Stop 4: the dashboard server
**File:** `agri_monitor/dashboard/app.py`

- **`receive_sensors()`, line 236:** "The endpoint the sensor node posts JSON to. It stores the reading, adds it to the chart history and logs it to CSV."
- **`log_reading()`, line 81:** "One CSV per day. If the columns ever change, the old file is set aside instead of being corrupted."
- **`mjpeg_frames()`, line 160:** "Reads the camera's MJPEG stream by cutting at the JPEG start (`FF D8`) and end (`FF D9`) markers. This works with any MJPEG camera."
- **`camera_stream()`, line 301:** "One connection to the camera, relayed to every browser through a condition variable. Ten phones watching add no load on the ESP32-CAM."
- **`scan_now()`, line 325, then `tag_image()`, line 137:** "A scan classifies the latest frame and saves it with a banner and the sensor readings at that moment."

## Stop 5: the classifier and the vegetation gate (most likely to be asked)
**File:** `agri_monitor/dashboard/classifier.py`

- **`leaf_coverage()`, line 107:** four lines.
  > "Shrink to 160 × 120, convert to HSV, count pixels with hue 38–165°, saturation ≥ 0.2 and value ≥ 0.12. The fraction is the leaf coverage."
- **`classify()`, line 70:**
  > "Runs MobileNetV2 through the Hugging Face pipeline and takes the top three. Then two guards: below 12 % coverage we report *no leaf*; below 50 % confidence we report *uncertain*. The model's raw answer is still stored, so we can see what it would have said."

**Live proof:** in the dashboard, scan with the camera pointed at the room, then at a leaf.

## Stop 6: kinematics and gait
**File:** `simulation/gait.py`

- **`leg_ik()`, line 18:**
  > "Closed-form inverse kinematics: about ten lines. The knee uses the law of cosines; the negative branch puts the knee behind the foot, as on the real robot."
- **`Trot.foot_targets()`, line 48:**
  > "Diagonal pairs move together. In stance the foot slides back under the body; in swing it lifts on a raised-cosine path. `com_shift` (line 46) places every foot around the centre of mass. That one line is the fix that stopped all 24 gait settings from falling."

**Live proof:** run this. It finishes in under a second:

```
cd simulation
.venv\Scripts\python check_ik.py
```

It prints: `1280 targets across 4 legs - worst foot position error 0.0000 mm`.

## Stop 7: the simulation's realism and mission
- **`simulation/model.py`, line 17 (`SERVO_TORQUE = 1.0`) and line 186 (`forcerange`):**
  > "Every joint is a position servo whose torque is clamped to the MG996R's stall torque. The simulation cannot cheat with strong motors."
- **`simulation/agribot.py`, `com_offset()` at line 98:**
  > "Computes the whole-robot centre of mass in the body frame from MuJoCo, every control cycle."
- **`simulation/agribot.py`, `_command()` at line 117:**
  > "The mission: heading control towards the next waypoint, slowing when misaligned, turning on the spot above 0.6 rad. The row ends when the front ultrasonic reads under 55 cm."

**Live proof:** `run_sim.bat` opens the viewer with the autonomous survey.

## Stop 8: the servo controller for the real robot
**File:** `locomotion/servo_controller/servo_controller.ino`

- **`legIK()`, line 121, and `trotTargets()`, line 176:**
  > "The same inverse kinematics and trot as the simulation, ported line for line to C++. We checked the port against the Python at 640 targets: the largest difference is 6 × 10⁻⁶ rad, which is float rounding."
- **`pcaBegin()` and `pcaPulse()`, lines 81 and 95:**
  > "A minimal driver for the PCA9685 PWM board: set the 50 Hz prescaler, then write each servo's pulse width."
- **`controlTick()`, line 206:**
  > "The 50 Hz control loop, with leg test, stand, sway and trot modes, selected by serial commands."

> **Be accurate here.** The code that produced the two leg videos was written on another laptop and is not in this repository. This controller was written afterwards as a port of the simulation's gait. If asked, say so: *"The first trials used a simpler test sketch; this controller ports the simulated gait to the real servos, and it is what we will use for the walking trials."* Only say it ran on the robot once you have actually flashed and run it.

---

## Likely code questions

| Question | Short answer | Where to point |
|---|---|---|
| "Why no RTOS?" | The tasks are periodic and short, so a millis()-based scheduler is simpler and cannot deadlock. The camera's HTTP server already runs in its own task. | `sensor_node.ino:418` |
| "How do two sensors on one I²C bus not clash?" | Different addresses: 0x58 (SGP30), 0x18 (MCP9808), 0x3C (OLED), 0x51 (RTC). | `sensor_node.ino`, `mcpBegin()` line 129 |
| "Why did you use your own MJPEG parser?" | Cutting at JPEG markers works for any camera's stream, whatever boundary string it uses. | `app.py:160` |
| "Is the classifier trained by you?" | No. It is a public MobileNetV2 checkpoint fine-tuned on PlantVillage. Our work is the integration, the gate and the threshold. | `classifier.py:14` |
| "What happens if the camera disconnects?" | The worker catches the error, shows it on the dashboard and reconnects every 2 s. Image upload still works. | `app.py:205` |
| "How did you verify the kinematics?" | Against MuJoCo's own forward kinematics, at 1,280 targets. | `check_ik.py` (run it) |
| "Where are the Wi-Fi credentials?" | In `secrets.h`, kept out of git. The repo has a `secrets.example.h` template. | `.gitignore` |
| "How long did the simulation take to tune?" | A sweep of 24 gait settings, scripted in `tune.py`. | `simulation/tune.py` |

## Before the review
- Open VS Code on the repo with these files already in tabs: `sensor_node.ino`, `app.py`, `classifier.py`, `gait.py`, `servo_controller.ino`.
- Have a terminal open in `simulation/`, ready for `check_ik.py` and `run_sim.bat`.
- Increase the editor font size (**Ctrl +**) so the panel can read the code on a projector.
