// Appendices. Code listings are cut from the real source files at build time,
// so the printed code always matches the repository.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");

function cut(file, startMarker, endMarker) {
  const text = fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\r/g, "");
  const a = text.indexOf(startMarker);
  if (a < 0) throw new Error(`marker not found in ${file}: ${startMarker}`);
  const b = endMarker ? text.indexOf(endMarker, a + startMarker.length) : text.length;
  if (b < 0) throw new Error(`end marker not found in ${file}: ${endMarker}`);
  return text.slice(a, b).replace(/\s+$/, "").split("\n");
}

module.exports = [
  // ---------------------------------------------------------------- 1
  { t: "appendix", title: "Wiring and Pin Map", label: "wiring-app" },
  { t: "p", text: "This appendix reproduces the wiring document used to assemble the sensor node. {fig:breadboard} shows the breadboard layout of the three voltage dividers, each made of three 1 kΩ resistors, and {tab:checklist} lists every connection." },
  { t: "fig", file: "wiring_breadboard.png", caption: "Breadboard layout: power rails fed from the expansion board, and dividers A, B and C for the PPD42 and the two ultrasonic echo signals", label: "breadboard", width: 5.75 },
  { t: "table", caption: "Wire-by-wire connection list", label: "checklist", widths: [0.5, 2.8, 3.2, 2.0], rows: [
    ["#", "From", "To", "Notes"],
    ["1", "SGP30 SCL", "Grove IIC 1, SCL (D5)", "Grove yellow"],
    ["2", "SGP30 SDA", "Grove IIC 1, SDA (D4)", "Grove white"],
    ["3", "SGP30 VCC", "Grove IIC 1, 3V3", "Grove red carries 3.3 V"],
    ["4", "SGP30 GND", "Grove IIC 1, GND", "Grove black"],
    ["5", "MCP9808", "Grove IIC 2", "Grove cable as supplied"],
    ["6", "Side header 5V", "Breadboard + rail", ""],
    ["7", "Side header GND", "Breadboard − rail", ""],
    ["8", "PPD42 pin 3 (5 V)", "+ rail", ""],
    ["9", "PPD42 pin 1 (GND)", "− rail", ""],
    ["10", "PPD42 pin 4 (P1)", "Divider A input", ""],
    ["11", "Divider A tap", "XIAO D0", "Between R1 and R2"],
    ["12", "HC-SR04 #1 VCC / GND", "+ rail / − rail", ""],
    ["13", "HC-SR04 #1 TRIG", "XIAO D6 (TX6)", "No divider needed"],
    ["14", "HC-SR04 #1 ECHO", "Divider B input", ""],
    ["15", "Divider B tap", "XIAO D7 (RX7)", "Between R1 and R2"],
    ["16", "HC-SR04 #2 VCC / GND", "+ rail / − rail", ""],
    ["17", "HC-SR04 #2 TRIG", "XIAO D8", "No divider needed"],
    ["18", "HC-SR04 #2 ECHO", "Divider C input", ""],
    ["19", "Divider C tap", "XIAO D9", "Between R1 and R2"],
    ["20", "XIAO USB-C", "Laptop or power bank", "Data-capable cable"],
    ["21", "ESP32-CAM", "ESP32-CAM-MB adapter", "5V to 5V, GND to GND"],
    ["22", "MB micro-USB", "Power bank", "Short cable avoids brownouts"],
  ] },
  { t: "p", text: "Before the first power-up, the + and − rails should be checked for continuity with a multimeter; they must not be connected. The PPD42 must be mounted upright with its connector at the bottom, and the microSD slot must be left empty because its lines are shared with the downward ultrasonic sensor. The 3S battery must never be connected to the expansion board's battery socket, which accepts only a single 3.7 V cell." },

  // ---------------------------------------------------------------- 2
  { t: "appendix", title: "Telemetry Format and Dashboard Interface", label: "api-app" },
  { t: "p", text: "The sensor node sends the following JSON record to the dashboard every five seconds. Unavailable readings are sent as null." },
  { t: "code", caption: "Example telemetry record from the sensor node", lines: [
    "{",
    '  "node": "xiao-s3", "uptime_s": 1834, "rssi": -41,',
    '  "sgp30_ok": true, "eco2_ppm": 421, "tvoc_ppb": 23, "air_level": "good",',
    '  "dust_present": false, "dust_valid": false,',
    '  "dust_ratio_pct": 0.000, "dust_pcs_per_0_01cf": 0.0, "dust_level": "absent",',
    '  "mcp9808_ok": true, "temp_c": 31.62,',
    '  "front_cm": null, "obstacle": false, "down_cm": null, "canopy_cm": null,',
    '  "muted": false',
    "}",
  ] },
  { t: "table", caption: "Dashboard HTTP interface", label: "api", widths: [1.0, 2.6, 4.7], rows: [
    ["Method", "Path", "Purpose"],
    ["POST", "/api/sensors", "Receive a telemetry record; log it to the daily CSV file"],
    ["GET", "/api/state", "Latest reading, ten-minute history, node, camera and classifier status, recent detections"],
    ["POST", "/api/camera", "Set the camera's still and stream URLs (sent by the camera at boot)"],
    ["GET", "/api/camera/stream", "Relayed MJPEG video for browsers"],
    ["GET", "/api/camera/frame.jpg", "Latest single frame"],
    ["POST", "/api/scan", "Run the vegetation gate and classifier on the current frame"],
    ["POST", "/api/classify", "Run the vegetation gate and classifier on an uploaded image"],
    ["GET", "/captures/<file>", "Saved, tagged images"],
    ["GET", "/api/export.csv", "Download the current day's sensor log"],
  ] },
  { t: "table", caption: "Camera node HTTP interface", label: "cam-api", widths: [1.0, 2.6, 4.7], rows: [
    ["Method", "Path", "Purpose"],
    ["GET", ":81/stream", "Continuous MJPEG video"],
    ["GET", ":80/capture", "One fresh JPEG; ?flash=1 lights the onboard LED"],
    ["GET", ":80/", "Status: address, signal strength, uptime, frame counts"],
  ] },

  // ---------------------------------------------------------------- 3
  { t: "appendix", title: "Key Source Code Listings", label: "code-app" },
  { t: "p", text: "The listings below are taken unchanged from the project repository." },
  { t: "code", caption: "Listing A3.1: Interrupt-driven PPD42 timing (sensor node firmware, C++)",
    lines: cut("agri_monitor/firmware/sensor_node/sensor_node.ino", "portMUX_TYPE dustMux", "// ---------------------------------------------------------------- MCP9808") },
  { t: "code", caption: "Listing A3.2: Dust window evaluation with absent-sensor detection (C++)",
    lines: cut("agri_monitor/firmware/sensor_node/sensor_node.ino", "void closeDustWindow", "void postToLaptop") },
  { t: "code", caption: "Listing A3.3: Temperature-compensated ultrasonic ranging (C++)",
    lines: cut("agri_monitor/firmware/sensor_node/sensor_node.ino", "float soundSpeedCmPerUs", "// Median of the last three") },
  { t: "code", caption: "Listing A3.4: Closed-form leg inverse kinematics (Python)",
    lines: cut("simulation/gait.py", "def leg_ik", "class Trot") },
  { t: "code", caption: "Listing A3.5: Vegetation gate (Python)",
    lines: cut("agri_monitor/dashboard/classifier.py", "# The model has no", null) },
  { t: "code", caption: "Listing A3.6: Centre-of-mass estimate used to place footholds (Python)",
    lines: cut("simulation/agribot.py", "    def com_offset", "    def sonar") },

  // ---------------------------------------------------------------- 4
  { t: "appendix", title: "Operating Instructions", label: "ops-app" },
  { t: "p", text: "All software is in the public repository github.com/AdithyaSM31/Precision-Agriculture-Monitoring-Quadruped-Robot-Dog. The steps below start the complete system on a Windows laptop." },
  { t: "numbered", items: [
    "Turn on the Windows Mobile Hotspot and set its band to 2.4 GHz; the ESP32 boards cannot see 5 GHz networks.",
    "Copy `secrets.example.h` to `secrets.h` in each firmware folder and enter the hotspot name and password. These files are excluded from version control.",
    "Flash `firmware/sensor_node` to the XIAO (board XIAO_ESP32S3) and `firmware/camera_node` to the ESP32-CAM (board AI Thinker ESP32-CAM). The XIAO's external antenna must be attached.",
    "Run `dashboard/setup.bat` once, then `dashboard/run.bat` to start the dashboard; it opens http://localhost:5000. Allow Python through the Windows firewall when prompted. Run it once with internet access so the classifier can download.",
    "Power both boards. The sensor node shows its address on the screen and appears on the dashboard within about ten seconds; the camera registers itself within about fifteen.",
    "To scan a leaf, hold it 10–15 cm from the camera against a plain background and press Scan leaf now. Images can also be uploaded.",
    "To run the simulation, double-click `simulation/run_sim.bat`; on first run it installs MuJoCo. `run_sim.bat --dashboard http://localhost:5000` also sends the simulated readings to the dashboard, and `python record.py --sweep` regenerates the video, plots and speed sweep.",
  ] },

  // ---------------------------------------------------------------- 5
  { t: "appendix", title: "Bill of Materials", label: "bom-app" },
  { t: "p", text: "{tab:bom} lists the components of the final system. Prices are those paid or listed at the time of purchase; components already available to the team are marked as such." },
  { t: "table", caption: "Bill of materials", label: "bom", widths: [3.4, 0.8, 2.0, 2.1], align: ["l", "c", "l", "l"], rows: [
    ["Item", "Qty", "Cost", "Status"],
    ["3D-printed chassis (PLA+, TPU), 35 parts", "1 set", "₹5,200", "Printed"],
    ["Seeed XIAO ESP32-S3 with expansion board and antenna", "1", "Available to the team", "In use"],
    ["Sensirion SGP30 gas sensor", "1", "Available to the team", "In use"],
    ["Grove MCP9808 temperature sensor", "1", "Available to the team", "In use"],
    ["Shinyei PPD42 dust sensor", "1", "Available to the team", "Wiring pending"],
    ["HC-SR04 ultrasonic sensor", "2", "Available to the team", "Wiring pending"],
    ["ESP32-CAM (OV3660)", "1", "₹689", "In use"],
    ["ESP32-CAM-MB programming adapter", "1", "₹119", "In use"],
    ["Grove Relay v1.3", "1", "Available to the team", "Planned"],
    ["Resistors 1 kΩ, breadboard, jumper wires, Grove cables", "—", "Available to the team", "In use"],
    ["MG996R servo", "12", "₹333 each (listed)", "For the walking MVP"],
    ["PCA9685 16-channel servo driver", "1", "₹249 (listed)", "For the walking MVP"],
  ] },
];
