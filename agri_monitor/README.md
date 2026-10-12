# AgriBot field monitor

The sensing and perception payload for the quadruped, packaged so it runs on
the static chassis now and moves onto the walking robot later.

```
 ┌──────── on the chassis ────────┐           ┌────────────── laptop ──────────────┐
 │ SGP30 ───┐                      │   Wi-Fi   │ Flask dashboard  http://localhost:5000
 │ MCP9808 ─┤                      │ ───JSON──▶│  · live air, temp, distance + charts│
 │ PPD42 ───┼─ XIAO ESP32-S3 ─ OLED│           │  · CSV log of every reading         │
 │ HC-SR04×2┘  + buzzer            │           │  · leaf-disease classifier          │
 │ camera (ESP32-CAM / phone) ─────┼───JPEG───▶│    (MobileNetV2, 38 classes)        │
 └─────────────────────────────────┘           │  · tagged image gallery             │
                                               └─────────────────────────────────────┘
```

Every tagged image is stamped with the gas and dust readings at the moment it
was captured, so each leaf diagnosis carries its air-quality context.

---

## 1. Wiring - sensor node

The XIAO ESP32-S3 plugs into the Seeed XIAO Expansion Board v1.1, which already
provides the OLED, buzzer, button and Grove ports.

| From | To | Note |
|---|---|---|
| MCP9808 (Grove) | Grove **IIC** port 2 | plug in directly; address 0x18 |
| SGP30 VCC, GND, SDA, SCL | Grove **IIC** port 1 via a cut Grove cable: red→VCC, black→GND, white→SDA, yellow→SCL | 3.3 V, address 0x58 |
| PPD42 pin 1 (GND) / pin 3 (5 V) | breadboard GND / 5V rails | heater needs 5 V; ~90 mA |
| PPD42 pin 4 (P1, >1 µm) | divider → **D0** | output ~4 V |
| HC-SR04 #1 (front) VCC / GND | 5V / GND rails | |
| HC-SR04 #1 TRIG / ECHO | **D6** / divider → **D7** | Echo is 5 V |
| HC-SR04 #2 (down) VCC / GND | 5V / GND rails | |
| HC-SR04 #2 TRIG / ECHO | **D8** / divider → **D9** | Echo is 5 V |
| Breadboard rails | expansion board side header **5V** and **GND** | |
| Power | USB-C (laptop for first test, power bank after) | |

Every divider is three 1 kΩ resistors: sensor output → 1 kΩ → **XIAO pin**, and
from that same point → 1 kΩ → 1 kΩ → GND. It turns 5 V into 3.3 V and the
PPD42's 4 V into 2.7 V. D8/D9 are the expansion board's microSD lines - leave
the SD slot empty. Set `DOWN_SENSOR_HEIGHT_CM` in the sketch to the measured
height of the downward ultrasonic above the ground.

I2C addresses on the bus: MCP9808 0x18, OLED 0x3C, RTC 0x51, SGP30 0x58 - no
conflicts (the PCA9685 servo driver at 0x40 will also fit later).

> **Never** connect the 3S LiPo to the expansion board's battery socket. It is
> for a single 3.7 V cell; 11.1 V destroys the XIAO.

The PPD42 must stand **upright** (connector at the bottom) - its heater drives a
convection airflow through the sensing chamber.

## 2. Flash the firmware

1. Arduino IDE 2 → Boards Manager → install **esp32 by Espressif**.
2. Library Manager → install **Adafruit SGP30 Sensor** and **U8g2**.
3. Copy `firmware/sensor_node/secrets.example.h` to `secrets.h`, fill in the
   hotspot name and password.
4. Board: **XIAO_ESP32S3**. Select the COM port, upload.
5. Serial Monitor at 115200 should print `SGP30 found`.

If the upload fails to connect: hold **B (boot)** on the XIAO, tap **R (reset)**,
release B, upload again.

The OLED shows readings and the node's IP. The onboard button mutes the buzzer.
Opening `http://<node-ip>/` in any browser on the same network returns the raw
JSON - useful for checking the node independently of the dashboard.

## 3. Run the dashboard

```
cd agri_monitor\dashboard
setup.bat        (once - creates .venv, ~250 MB)
run.bat          (starts the server and opens the browser)
```

The classifier downloads (~14 MB) from Hugging Face on the **first run only**.
Run it once with internet before demo day; after that it works offline.

To test without hardware, run `.venv\Scripts\python fake_sensors.py` alongside.

## 4. Network - use the laptop's hotspot

College Wi-Fi almost always blocks devices from talking to each other.

1. Windows Settings → Network → **Mobile hotspot** → on.
2. Edit → **Band: 2.4 GHz**. The ESP32 cannot see 5 GHz networks.
3. The laptop is then `192.168.137.1`, which is already the default in
   `secrets.h`.
4. First time `run.bat` starts, Windows Firewall asks about Python - tick
   **both Private and Public**. If the node's OLED shows an IP but the
   dashboard says *waiting*, the firewall is the cause.

## 5. Camera

### ESP32-CAM (the robot's camera)

1. Seat the ESP32-CAM on the **ESP32-CAM-MB** board, camera facing up, with
   the pin labels matching (5V to 5V, GND to GND). Connect micro-USB.
2. Copy `firmware/camera_node/secrets.example.h` to `secrets.h` - same values
   as the sensor node.
3. Board: **AI Thinker ESP32-CAM**. Upload `firmware/camera_node`.
   If it will not connect: hold **IO0** on the MB board, tap **RST**, release
   IO0, upload again, then tap RST once more to run.
4. Start the dashboard, then power the camera. It **registers itself** with the
   dashboard within ~15 s - the camera panel goes live with no URL to type.

Serial Monitor (115200) prints the camera URL and its registration result.
`http://<cam-ip>/capture?flash=1` lights the onboard LED for the shot - useful
inside the chassis. A **brownout / restart loop** on the Serial Monitor means
the USB supply is too weak: use a short cable straight into the power bank.

### Any other camera

The dashboard accepts any URL that returns a single JPEG. Paste it into the
camera box and press **Connect**.

| Camera | URL to paste |
|---|---|
| ESP32-CAM, this firmware | `http://<cam-ip>/capture` (filled in automatically) |
| Android phone, *IP Webcam* app | `http://<phone-ip>:8080/shot.jpg` |

The auto-scan box tags a frame every N seconds; 0 leaves it on the
**Scan leaf now** button. **Upload image** classifies any photo directly - the
fallback if the camera network fails during a review.

The Raspberry Pi Camera v1.3 does not work with the ESP32: it uses MIPI CSI-2,
and the ESP32-S3 only has a parallel (DVP) camera interface.

## Classifier - what it can and cannot do

Model: [`linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification`](https://huggingface.co/linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification),
MobileNetV2 fine-tuned on PlantVillage. 38 classes across 14 crops
(apple, tomato, potato, corn, grape, pepper and others). ~30 ms per image on CPU.

Spot check on 10 random PlantVillage images: 8 correct at >92 % confidence, 1
correct but flagged uncertain (42 %), 1 wrong (tomato leaf mold called late
blight, 93 %).

PlantVillage photos are single leaves on plain backgrounds. Accuracy on field
photos with soil, multiple leaves and uneven light is substantially lower. For
a demo, photograph one leaf against a plain surface. Anything below 50 %
confidence is reported as *Uncertain* rather than forced into a class, because
the model always picks one of its 38 classes even for a picture of a wall.

## Sensor notes

| | SGP30 | PPD42 |
|---|---|---|
| Measures | eCO2 (ppm), TVOC (ppb) | particles >1 µm, pcs per 0.01 ft³ |
| Warm-up | 15 s (reads 400 / 0 until then) | ~60 s heater settle |
| Sampling | 1 Hz (its baseline algorithm needs this) | 30 s low-pulse occupancy window |
| Caveat | eCO2 is *estimated* from VOCs, not measured CO2 | particle counter, not a calibrated PM2.5 instrument |

Alert bands - TVOC 220 / 660 ppb (German UBA guideline), eCO2 1000 / 2000 ppm,
dust 10,000 / 20,000 pcs - are set at the top of `sensor_node.ino`.

## Files

```
firmware/sensor_node/   XIAO ESP32-S3 firmware (Arduino)
firmware/camera_node/   AI-Thinker ESP32-CAM firmware (Arduino)
dashboard/app.py        Flask server: ingest, camera worker, tagging, API
dashboard/classifier.py model wrapper and label parsing
dashboard/templates/    the dashboard page (self-contained, no CDN)
dashboard/fake_sensors.py  hardware-free test source
dashboard/data/         runtime output: CSV logs, tagged captures (git-ignored)
```
