// Final (pre-final review) deck - same visual language as the Review III deck:
// white slides, large bold Inter titles, VIT Chennai logo top-right, light tables.
const pptxgen = require("pptxgenjs");
const path = require("path");
const fs = require("fs");

const IMG = path.join(__dirname, "img");
const MAN = JSON.parse(fs.readFileSync(path.join(IMG, "manifest.json"), "utf8"));
const LIT = JSON.parse(fs.readFileSync(path.join(__dirname, "old_lit.json"), "utf8"));
const OUT = process.argv[2] || path.join(__dirname, "AgriBot_PreFinal_Review.pptx");

const INK = "0B0B0B", BODY = "2E3440", MUTED = "6B7280", RULE = "C9CBE8", TINT = "F4F5FB";
const ACCENT = "4B4FD1", GOOD = "1F7A4C", WARN = "9A6700", BAD = "B42318", VIT = "1E3A8A";
const FONT = "Inter";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in, as Review III
pres.author = "Adithya Sankar Menon";
pres.title = "Precision Agriculture Monitoring Quadruped Robot Dog - Pre-Final Review";
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };

const LOGO = { path: path.join(IMG, "vit_logo.jpg"), x: 11.35, y: 0.22, w: 1.72, h: 1.72 * 298 / 900 };

pres.defineSlideMaster({
  title: "TITLE",
  background: { color: "FFFFFF" },
  objects: [{ image: LOGO }],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: "FFFFFF" },
  objects: [
    { image: LOGO },
    { placeholder: { options: { name: "title", type: "title", x: 0.7, y: 0.5, w: 10.4, h: 1.0, fontFace: FONT,
      fontSize: 34, bold: true, color: INK, valign: "middle", align: "left", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 12.35, y: 6.98, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 10, color: MUTED, align: "right" },
});

// ------------------------------------------------------------------ helpers
const T = (o) => Object.assign({ fontFace: FONT, color: BODY, isTextBox: true, margin: 0 }, o);

function slide(title, notes) {
  const s = pres.addSlide({ masterName: "CONTENT" });
  s.addText(title, { placeholder: "title" });
  if (notes) s.addNotes(notes);
  return s;
}

function lead(s, text, y = 1.62) {
  s.addText(text, T({ x: 0.7, y, w: 11.9, h: 0.45, fontSize: 15, color: BODY }));
}

function fit(s, file, x, y, w, h, opts = {}) {
  const [iw, ih] = MAN[file];
  const k = Math.min(w / iw, h / ih);
  const dw = iw * k, dh = ih * k;
  const ox = opts.align === "left" ? x : opts.align === "right" ? x + w - dw : x + (w - dw) / 2;
  const oy = opts.valign === "top" ? y : y + (h - dh) / 2;
  s.addImage({ path: path.join(IMG, file), x: ox, y: oy, w: dw, h: dh, altText: opts.alt || file });
  return { x: ox, y: oy, w: dw, h: dh };
}

function caption(s, text, x, y, w) {
  s.addText(text, T({ x, y, w, h: 0.3, fontSize: 11, color: MUTED, italic: true }));
}

function table(s, rows, o) {
  const head = rows[0].map((t) => ({ text: t, options: { bold: true, fill: { color: TINT }, color: INK } }));
  const body = rows.slice(1).map((r) => r.map((c) => (typeof c === "string" ? { text: c } : c)));
  s.addTable([head, ...body], Object.assign({
    fontFace: FONT, fontSize: 13, color: BODY, valign: "middle",
    border: { type: "solid", pt: 0.75, color: RULE }, margin: [4, 8, 4, 8],
  }, o));
}

function card(s, x, y, w, h, head, body, headColor = INK, opts = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: TINT }, line: { color: TINT }, rectRadius: 0.08 });
  s.addText(head, T({ x: x + 0.22, y: y + 0.16, w: w - 0.44, h: 0.4, fontSize: 16, bold: true, color: headColor }));
  s.addText(body, T({ x: x + 0.22, y: y + 0.6, w: w - 0.44, h: h - 0.75, fontSize: opts.size || 13.5, valign: "top", paraSpaceAfter: 4 }));
}

function stat(s, x, y, w, big, label, color = ACCENT) {
  s.addText(big, T({ x, y, w, h: 0.62, fontSize: 30, bold: true, color }));
  s.addText(label, T({ x, y: y + 0.62, w, h: 0.55, fontSize: 12, color: MUTED, valign: "top" }));
}

function bullets(s, items, x, y, w, h, size = 15) {
  s.addText(items.map((t, i) => ({ text: t, options: { bullet: { indent: 16 }, breakLine: i < items.length - 1 } })),
    T({ x, y, w, h, fontSize: size, valign: "top", paraSpaceAfter: 9 }));
}

const ok = (t) => ({ text: t, options: { bold: true, color: GOOD } });
const pend = (t) => ({ text: t, options: { color: WARN } });

// ------------------------------------------------------------------ 1. title
{
  const s = pres.addSlide({ masterName: "TITLE" });
  s.addText("Precision Agriculture Monitoring Quadruped Robot Dog",
    T({ x: 0.7, y: 1.35, w: 10.6, h: 1.55, fontSize: 44, bold: true, color: INK, valign: "top" }));
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 3.12, w: 3.7, h: 0.36, fill: { color: "FFFFFF" },
    line: { color: ACCENT, width: 1 }, rectRadius: 0.06 });
  s.addText("PROJECT I  —  PRE-FINAL REVIEW", T({ x: 0.7, y: 3.12, w: 3.7, h: 0.36, fontSize: 12, color: ACCENT, align: "center", valign: "middle" }));
  s.addText("A 12-DOF printed quadruped with a distributed field-sensing payload: an ESP32-S3 sensor node, an ESP32-CAM camera node and leaf-disease classification on the laptop, with locomotion validated in MuJoCo physics simulation.",
    T({ x: 0.7, y: 3.7, w: 11.6, h: 0.85, fontSize: 16, valign: "top" }));
  s.addText([
    { text: "Presented by:", options: { bold: true, color: INK, breakLine: true } },
    { text: "Adithya Sankar Menon (23BRS1079)", options: { breakLine: true } },
    { text: "Siddhesh Pushkraj Shinde (23BCE5048)", options: { breakLine: true } },
    { text: "Rachit Gupta (23BCE1658)", options: { breakLine: true } },
    { text: " ", options: { breakLine: true } },
    { text: "Guide: ", options: { bold: true, color: INK } },
    { text: "Dr. Lakshmanan K (54758)" },
  ], T({ x: 0.7, y: 4.75, w: 7, h: 2.3, fontSize: 15, color: "4B5563", valign: "top", lineSpacingMultiple: 1.15 }));
  s.addNotes("Introduce the team and the one-line summary: the robot platform is printed, the sensing payload is built and working end to end, and locomotion is validated in a physics simulator. The live demo follows the results.");
}

// ------------------------------------------------------------------ 2. problem
{
  const s = slide("Problem Statement",
    "Frame the gap: monitoring at crop level needs close-range sensing, and the platforms that can get there are either expensive or struggle on farm terrain. The FAO figure is the motivation for early detection.");
  bullets(s, [
    "Field monitoring relies on manual scouting or drones; neither gives close-range, multi-parameter readings at crop level.",
    "Wheeled and tracked rovers struggle in mud, soft soil and the narrow furrows between planted rows.",
    "Disease is often noticed only once it is visible across the field, when treatment is costly.",
    "Commercial agricultural robots remain too expensive for most small and medium farms.",
  ], 0.7, 1.75, 7.4, 4.6, 17);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.7, y: 2.05, w: 3.95, h: 3.1, fill: { color: TINT }, line: { color: TINT }, rectRadius: 0.1 });
  s.addText("20–40 %", T({ x: 9.0, y: 2.45, w: 3.4, h: 0.95, fontSize: 48, bold: true, color: ACCENT }));
  s.addText("of global crop production is lost to plant pests and diseases every year (FAO).",
    T({ x: 9.0, y: 3.45, w: 3.4, h: 1.3, fontSize: 15, valign: "top" }));
}

// ------------------------------------------------------------------ 3. objectives
{
  const s = slide("Project Objectives",
    "Four objectives, each of which maps to a demonstrable module later in the deck.");
  const W = 5.85, H = 2.25;
  const big = { size: 16 };
  card(s, 0.7, 1.75, W, H, "Mobility", "A low-cost 3D-printed 12-DOF quadruped whose gait is validated in physics simulation against real servo torque limits.", INK, big);
  card(s, 6.78, 1.75, W, H, "Sensing", "Close-range gas (TVOC, eCO₂), dust, temperature and distance sensing carried on the chassis.", INK, big);
  card(s, 0.7, 4.22, W, H, "Plant-health AI", "Camera-based leaf-disease classification that first checks whether a leaf is in view at all.", INK, big);
  card(s, 6.78, 4.22, W, H, "Live dashboard", "A wireless dashboard that logs every reading and tags each leaf image with the air conditions at capture time.", INK, big);
}

// ------------------------------------------------------------------ 4. design revision
{
  const s = slide("Design Revision Since Review III",
    "Be direct about the changes and the reasons. The scope was narrowed to what could be built and tested in the time available; locomotion is validated in simulation and continues as an MVP build.");
  lead(s, "The sensing payload moved off the Jetson onto two ESP32 nodes; locomotion moved to a physics simulator plus an MVP build.");
  table(s, [
    ["Review III plan", "Built now", "Reason"],
    ["Jetson Orin Nano on the robot", "XIAO ESP32-S3 + ESP32-CAM nodes; inference on the laptop", "A fall risks an expensive board; MG996R torque margin is thin; inference needs no onboard GPU"],
    ["IMX219 CSI camera", "ESP32-CAM (OV3660), Wi-Fi MJPEG stream", "The ESP32-S3 has no MIPI-CSI camera interface"],
    ["ROS 2 + MQTT on board", "Flask dashboard over the laptop hotspot", "Fewer moving parts; every device on one local network"],
    ["Gazebo dynamics model", "MuJoCo physics simulation", "The Gazebo stance never stabilised; MuJoCo walks and reports metrics headless"],
    ["Walking trials on hardware", "Simulation results now; servo MVP next", "Torque analysis showed walking needs CoM-centred footholds first"],
  ], { x: 0.7, y: 2.25, w: 11.95, colW: [3.0, 4.15, 4.8], rowH: 0.62 });
}

// ------------------------------------------------------------------ 5. architecture
{
  const s = slide("System Architecture",
    "Walk the data path left to right: the sensor node posts JSON every five seconds, the camera streams MJPEG, the laptop runs the dashboard, the logger and the classifier. All three sit on the laptop's Wi-Fi hotspot.");
  const box = (x, y, w, h, head, lines, fill) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: RULE, width: 1 }, rectRadius: 0.08 });
    s.addText(head, T({ x: x + 0.2, y: y + 0.14, w: w - 0.4, h: 0.4, fontSize: 15, bold: true, color: INK }));
    s.addText(lines.map((t, i) => ({ text: t, options: { bullet: { indent: 12 }, breakLine: i < lines.length - 1 } })),
      T({ x: x + 0.2, y: y + 0.6, w: w - 0.4, h: h - 0.7, fontSize: 12.5, valign: "top", paraSpaceAfter: 3 }));
  };
  box(0.7, 1.7, 3.75, 3.1, "Sensor node", ["XIAO ESP32-S3 + expansion board", "SGP30 gas · I²C 0x58", "MCP9808 temp · I²C 0x18", "PPD42 dust · D0", "HC-SR04 × 2 · D6–D9", "OLED, buzzer, button"], "FFFFFF");
  box(4.79, 1.7, 3.75, 3.1, "Laptop  ·  192.168.137.1", ["Wi-Fi hotspot, 2.4 GHz", "Flask dashboard :5000", "CSV log of every reading", "MobileNetV2 + leaf check", "Video relay to all viewers"], TINT);
  box(8.88, 1.7, 3.75, 3.1, "Camera node", ["ESP32-CAM, OV3660 sensor", "MJPEG video on :81", "Single photo on :80/capture", "Registers itself at boot"], "FFFFFF");
  const arrow = (x1, y1, x2, y2, label, ly) => {
    s.addShape(pres.shapes.LINE, { x: x1, y: y1, w: x2 - x1, h: 0, line: { color: ACCENT, width: 1.75, endArrowType: "triangle" } });
    s.addText(label, T({ x: Math.min(x1, x2) - 0.3, y: ly, w: Math.abs(x2 - x1) + 0.6, h: 0.3, fontSize: 10.5, color: ACCENT, align: "center" }));
  };
  // arrows sit in the gaps between boxes, so draw them short and label above
  s.addShape(pres.shapes.LINE, { x: 4.45, y: 3.25, w: 0.34, h: 0, line: { color: ACCENT, width: 2, endArrowType: "triangle" } });
  s.addShape(pres.shapes.LINE, { x: 8.54, y: 3.25, w: 0.34, h: 0, flipH: true, line: { color: ACCENT, width: 2, endArrowType: "triangle" } });
  s.addText("JSON every 5 s  →", T({ x: 0.7, y: 4.92, w: 3.75, h: 0.3, fontSize: 11.5, color: ACCENT, align: "right" }));
  s.addText("←  MJPEG video, ~16–20 fps", T({ x: 8.88, y: 4.92, w: 3.75, h: 0.3, fontSize: 11.5, color: ACCENT }));
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 5.45, w: 11.93, h: 1.15, fill: { color: "FFFFFF" }, line: { color: RULE, width: 1, dashType: "dash" }, rectRadius: 0.08 });
  s.addText([{ text: "Platform  ", options: { bold: true, color: INK } },
    { text: "SpotMicro-based printed chassis carrying both nodes · 12 × MG996R servos (stand-and-step MVP) · gait and torque limits validated in MuJoCo" }],
  T({ x: 0.95, y: 5.45, w: 11.4, h: 1.15, fontSize: 13.5, valign: "middle" }));
  s.addText("Any phone on the hotspot can open the dashboard at http://192.168.137.1:5000",
    T({ x: 0.7, y: 6.75, w: 11, h: 0.3, fontSize: 11, color: MUTED, italic: true }));
}

// ------------------------------------------------------------------ 6. mechanical
{
  const s = slide("Mechanical Build — Printed Chassis",
    "The chassis is SpotMicro adapted for our payload; geometry was measured from the printed parts. The sensor node is already mounted on the printed top cover, shown in the photo.");
  bullets(s, [
    "35 parts printed and verified; base design SpotMicro (KDY0523, CC-BY), adapted for our payload",
    "~700 g PLA+ structure, TPU foot pads · printing cost ₹5,200",
    "Geometry measured from the prints: hip spacing 140 × 78 mm, femur 111 mm, tibia 125 mm",
    "Four team-designed parts: top cover, sensor deck, PPD42 and SGP30 brackets",
    "Sensor node now mounted on the printed top cover (photo)",
  ], 0.7, 1.75, 5.6, 4.6, 15);
  fit(s, "contact_sheet.jpg", 6.45, 1.65, 3.85, 4.95);
  fit(s, "photo_chassis.jpg", 10.45, 1.65, 2.2, 4.95);
  caption(s, "Print set (left) · sensor node on the top cover (right)", 6.45, 6.7, 6.2);
}

// ------------------------------------------------------------------ 7. sensor node
{
  const s = slide("Sensor Node Hardware",
    "The XIAO ESP32-S3 on its expansion board: two Grove I2C sensors live now, three more with firmware complete and wiring pending. Point out the divider rule.");
  fit(s, "photo_oled.jpg", 0.7, 1.75, 4.6, 2.6);
  caption(s, "Live readings and IP address on the node's OLED", 0.7, 4.42, 4.6);
  s.addText("Every 5 V sensor output reaches the 3.3 V XIAO through a 1 kΩ / 2 kΩ divider: 5 V → 3.3 V, and the PPD42's 4 V → 2.7 V.",
    T({ x: 0.7, y: 4.95, w: 4.6, h: 1.2, fontSize: 13, valign: "top" }));
  table(s, [
    ["Sensor", "Measures", "Interface", "Status"],
    ["SGP30", "TVOC, eCO₂", "I²C 0x58, Grove IIC 1", ok("Live")],
    ["MCP9808", "Temperature ±0.25 °C", "I²C 0x18, Grove IIC 2", ok("Live")],
    ["OLED, buzzer", "Local display, alerts", "On board", ok("Live")],
    ["PPD42", "Particles > 1 µm", "D0 via divider", pend("Wiring pending")],
    ["HC-SR04 #1", "Obstacle / row end", "D6 trig, D7 echo", pend("Wiring pending")],
    ["HC-SR04 #2", "Canopy height", "D8 trig, D9 echo", pend("Wiring pending")],
  ], { x: 5.65, y: 1.75, w: 7.0, colW: [1.55, 2.0, 2.05, 1.4], rowH: 0.56, fontSize: 12.5 });
  s.addText("Firmware for the three pending sensors is written, compiled and uploaded; they report as absent until connected.",
    T({ x: 5.65, y: 6.0, w: 7.0, h: 0.6, fontSize: 12, color: MUTED, italic: true, valign: "top" }));
}

// ------------------------------------------------------------------ 8. firmware
{
  const s = slide("Firmware Engineering",
    "Each card is a decision that came from testing. Two of them, the missing-sensor detection and the Wi-Fi diagnostics, fixed real faults found on the bench.");
  const W = 3.9, H = 2.3, X = [0.7, 4.71, 8.72], Y = [1.75, 4.25];
  card(s, X[0], Y[0], W, H, "Interrupt-timed dust", "PPD42 low-pulse time is accumulated in an interrupt over 30 s windows, so sampling never blocks the loop.");
  card(s, X[1], Y[0], W, H, "Missing-sensor detection", "An unplugged PPD42 read as 1,114,001 particles and sounded the alarm. A line held low with no pulses is now reported as absent.");
  card(s, X[2], Y[0], W, H, "Temperature-corrected range", "Speed of sound from the MCP9808: c = 331.3 + 0.606·T m/s. Fixed 343 m/s is ~3 % off at 35 °C.");
  card(s, X[0], Y[1], W, H, "Crosstalk-free ultrasonics", "The two HC-SR04s fire alternately, never together, and each reading is median-of-3 filtered.");
  card(s, X[1], Y[1], W, H, "Wi-Fi diagnostics", "Reports why a connection fails. It traced a −78 dBm link to a missing antenna; fitted, the link reads −26 dBm.");
  card(s, X[2], Y[1], W, H, "Self-registering camera", "The ESP32-CAM sends its photo and stream URLs to the dashboard at boot, so a new IP address needs no setup.");
}

// ------------------------------------------------------------------ 9. dashboard
{
  const s = slide("Live Dashboard",
    "Show the dashboard live after this slide. Each card has a good / moderate / high band; every reading is logged to CSV; any phone on the hotspot can view it.");
  fit(s, "dash_cards.jpg", 0.7, 1.7, 11.95, 4.05, { valign: "top" });
  const y = 5.95;
  s.addText([
    { text: "Status bands  ", options: { bold: true, color: INK } }, { text: "TVOC per the German UBA guideline (220 / 660 ppb), eCO₂ 1,000 / 2,000 ppm", options: { breakLine: true } },
    { text: "Logging  ", options: { bold: true, color: INK } }, { text: "every reading to a daily CSV · 10-minute charts · no internet needed at runtime" },
  ], T({ x: 0.7, y, w: 11.95, h: 0.75, fontSize: 13.5, valign: "top", paraSpaceAfter: 4 }));
}

// ------------------------------------------------------------------ 10. classifier
{
  const s = slide("Leaf-Disease Classification",
    "The model alone has no 'not a leaf' answer: pointed at the room it said Citrus Greening with 82-90 % confidence. The leaf check runs first and rejects those frames. Demonstrate both cases live.");
  fit(s, "dash_diagnosis.jpg", 0.7, 1.7, 6.6, 3.95, { align: "left", valign: "top" });
  caption(s, "Live scan through the ESP32-CAM: Cedar Apple Rust, 96 %, leaf coverage 60 %", 0.7, 5.7, 6.6);
  s.addText([
    { text: "1  Frame from the ESP32-CAM stream", options: { breakLine: true } },
    { text: "2  Leaf check: ≥ 12 % of pixels leaf-coloured (hue 38–165°, saturation ≥ 0.2)", options: { breakLine: true } },
    { text: "3  MobileNetV2, PlantVillage: 38 classes, 14 crops", options: { breakLine: true } },
    { text: "4  Below 50 % confidence → reported as uncertain", options: { breakLine: true } },
    { text: "5  Image saved, tagged with crop, condition, gas and temperature" },
  ], T({ x: 7.65, y: 1.75, w: 5.0, h: 2.5, fontSize: 13.5, valign: "top", paraSpaceAfter: 7 }));
  table(s, [
    ["Input", "Result"],
    ["Room, no leaf", "Rejected (0–0.1 % coverage). Model alone: “Citrus Greening 82–90 %”"],
    ["12 PlantVillage leaves", "All accepted (27–76 % coverage)"],
    ["Inference", "30–80 ms per image on the laptop CPU"],
  ], { x: 7.65, y: 4.35, w: 5.0, colW: [1.75, 3.25], rowH: 0.5, fontSize: 12 });
}

// ------------------------------------------------------------------ 11. hardware results
{
  const s = slide("Results — Hardware Validation",
    "These are measured on the bench, not modelled. The breath and finger tests are the ones to repeat live in front of the panel.");
  lead(s, "Every working module was exercised on the bench; all values are from those runs.");
  table(s, [
    ["Test", "Result", "What it shows"],
    ["SGP30, breath test", "eCO₂ 400 → 746 ppm, TVOC 0 → 210 ppb within 5 s, back to baseline after", "Gas sensing responds and recovers"],
    ["MCP9808, finger contact", "31.5 → 35.0 °C in ~10 s", "Temperature tracks a real change"],
    ["XIAO Wi-Fi link", "−78 dBm with auth time-outs → −26 dBm with antenna fitted", "Diagnostics found the fault"],
    ["Camera video", "~0.5 → 16–20 fps after moving to MJPEG streaming", "Smooth live view for scanning"],
    ["Camera onboarding", "Registered itself on a new IP at every boot tested", "No manual network setup"],
    ["Leaf check", "Room view rejected; 12 / 12 leaf images accepted", "No disease reported without a leaf"],
    ["Dust sensor absent", "Reported as absent instead of a false 1.1 M count", "No false alarms from wiring faults"],
  ], { x: 0.7, y: 2.2, w: 11.95, colW: [2.85, 5.6, 3.5], rowH: 0.54, fontSize: 12.5 });
}

// ------------------------------------------------------------------ 12. simulation
{
  const s = slide("MuJoCo Physics Simulation",
    "Built from scratch in MuJoCo after Gazebo would not hold a stance. The robot is built from measured dimensions and its servos are capped at MG996R stall torque, so if it walks here, it is not because of unrealistic motors.");
  fit(s, "frame_03_diseased_patch.jpg", 0.7, 1.7, 7.45, 4.2, { align: "left", valign: "top" });
  caption(s, "Surveying the middle row gap; the trail turns red over the diseased plants", 0.7, 5.98, 7.45);
  bullets(s, [
    "Robot from measured geometry: 140 × 78 mm hips, 111 / 125 mm legs, 1.35 kg",
    "12 position servos capped at 1.0 N·m (MG996R stall 0.92–1.08 N·m)",
    "Leg IK checked against MuJoCo's own kinematics: 1,280 targets, 0.0000 mm error",
    "Mission: stand up, trot each row gap, detect row ends by ultrasonic, turn, log gas, dust and temperature",
  ], 8.45, 1.75, 4.2, 4.7, 13.5);
}

// ------------------------------------------------------------------ 13. simulation results
{
  const s = slide("Results — Autonomous Field Survey",
    "The full survey ran without a fall. The TVOC peak sits 0.2 m from the true source because the SGP30 takes about 2.5 s to respond while the robot keeps walking; a real effect worth discussing.");
  fit(s, "survey_map.jpg", 0.7, 1.65, 8.2, 3.9, { align: "left", valign: "top" });
  caption(s, "Path coloured by measured TVOC; squares mark row ends detected by the front ultrasonic", 0.7, 5.5, 8.2);
  stat(s, 9.25, 1.75, 3.4, "16.7 m · 129 s", "all 3 row gaps surveyed, no falls");
  stat(s, 9.25, 2.95, 3.4, "3 / 3", "row ends detected by the front ultrasonic");
  stat(s, 9.25, 4.15, 3.4, "≤ 2.7°", "body tilt throughout; servos at their limit 1.3 % of the time");
  stat(s, 9.25, 5.35, 3.4, "535 ppb", "TVOC peak, 0.2 m from the true source (SGP30 lag)", BAD);
}

// ------------------------------------------------------------------ 14. findings
{
  const s = slide("Engineering Findings",
    "Two findings that change the physical build. First, the centre-of-mass offset: without correcting it the robot fell in all 24 gait settings. Second, MG996R torque sets a speed ceiling of about 0.18 m/s.");
  card(s, 0.7, 1.75, 5.2, 4.75, "Centre of mass sits 12 mm aft",
    "All four knees point backward, as on SpotMicro, so the leg mass hangs rearward.\n\nWith footholds centred on the body, the trot tipped backward within 1–3 s in all 24 gait settings tried.\n\nPlacing the feet around the measured centre of mass made it stable: 0.7° tilt trotting in place. The same correction applies to the physical robot.");
  fit(s, "speed_sweep.jpg", 6.2, 1.7, 6.45, 3.25, { valign: "top" });
  table(s, [
    ["Speed", "Result"],
    ["0.08–0.18 m/s", "Tracks the command within 7 %"],
    ["0.20 m/s", "Servos at limit 68 % of the time, tilt 12°"],
    ["0.22 m/s", { text: "Falls", options: { bold: true, color: BAD } }],
  ], { x: 6.2, y: 5.05, w: 6.45, colW: [1.8, 4.65], rowH: 0.36, fontSize: 12 });
}

// ------------------------------------------------------------------ 15. limitations
{
  const s = slide("Limitations",
    "State these before the panel asks. Each one is also listed in the repository README.");
  table(s, [
    ["Limitation", "Effect", "How it is handled"],
    ["Simulated gas, dust and temperature come from modelled fields", "Simulation shows the method, not field data", "Hardware sensors validated on the bench; field logging next"],
    ["Classifier trained on lab photos (PlantVillage), 14 crops", "Lower accuracy on real field images", "Leaf check and 50 % confidence threshold; field-image fine-tuning as future work"],
    ["SGP30 eCO₂ is estimated from VOCs; PPD42 counts particles, not PM2.5", "Relative readings, not regulatory values", "Used for trends and alerts, not absolute limits"],
    ["Walking not yet shown on hardware; MG996R margins are thin", "Locomotion evidence is simulation-only", "Servo MVP before the final review, with the CoM correction ready"],
    ["Dust and ultrasonic sensors not yet wired", "Not part of today's live demo", "Firmware complete and uploaded; wiring next"],
  ], { x: 0.7, y: 1.8, w: 11.95, colW: [4.3, 3.35, 4.3], rowH: [0.45, 0.82, 0.82, 0.82, 0.82, 0.82], fontSize: 13 });
}

// ------------------------------------------------------------------ 16. remaining work
{
  const s = slide("Remaining Work Before the Final Review",
    "Everything on the left is firmware-ready or a direct continuation; the deliverables on the right have fixed deadlines.");
  const steps = [
    ["01", "Wire the PPD42 and both HC-SR04s through their dividers; firmware already handles them"],
    ["02", "Grove Relay v1.3: act on readings (irrigation pump or gas alert), with a dashboard control"],
    ["03", "Servo MVP: stand, sit and step, using the simulator's gait and centre-of-mass correction"],
  ];
  steps.forEach(([n, t], i) => {
    const y = 1.8 + i * 1.32;
    s.addText(n, T({ x: 0.7, y, w: 0.8, h: 0.6, fontSize: 26, bold: true, color: ACCENT }));
    s.addText(t, T({ x: 1.55, y: y + 0.05, w: 5.2, h: 1.0, fontSize: 15, valign: "top" }));
  });
  card(s, 7.3, 1.75, 5.35, 3.85, "Deliverables", "Project report in the BCSE497J template, with similarity ≤ 15 %, by 21 October\n\nJournal / conference paper submission with acknowledgement\n\nFinal panel review demonstration");
}

// ------------------------------------------------------------------ 17. tech stack
{
  const s = slide("Technology Stack",
    "Everything here is in the public GitHub repository, with run instructions.");
  const W = 3.9, H = 2.3, X = [0.7, 4.71, 8.72], Y = [1.75, 4.25];
  card(s, X[0], Y[0], W, H, "Hardware", "Seeed XIAO ESP32-S3 + expansion board · ESP32-CAM (OV3660) + MB · SGP30, MCP9808, PPD42, HC-SR04 × 2 · 12 × MG996R");
  card(s, X[1], Y[0], W, H, "Firmware", "Arduino-ESP32 3.3 · Adafruit SGP30 · U8g2 · esp_http_server (MJPEG)");
  card(s, X[2], Y[0], W, H, "Dashboard & AI", "Python · Flask · PyTorch · Hugging Face Transformers · MobileNetV2 (PlantVillage)");
  card(s, X[0], Y[1], W, H, "Simulation", "MuJoCo 3 · NumPy · Matplotlib · headless video and metrics");
  card(s, X[1], Y[1], W, H, "Mechanical", "SpotMicro base (CC-BY) · PLA+ / TPU · parametric Python generators for the custom parts");
  card(s, X[2], Y[1], W, H, "Collaboration", "Git + GitHub: firmware, dashboard, simulation, print files and results in one repository");
}

// ------------------------------------------------------------------ 18-21. literature review (carried over from Review III)
const LIT_ROWS = LIT.lit;
for (let i = 0; i < LIT_ROWS.length; i += 5) {
  const chunk = LIT_ROWS.slice(i, i + 5);
  const s = slide(`Literature Review (${LIT_ROWS.length} Papers)`,
    i === 0 ? "Carried over from Review III. Summarise the gap: no low-cost legged platform combines in-field environmental sensing with plant-disease detection." : "");
  table(s, [
    ["#", "Authors & Year", "Paper Title", "Venue", "Key Contribution", "Research Gap"],
    ...chunk,
  ], { x: 0.55, y: 1.6, w: 12.25, colW: [0.4, 1.55, 2.6, 1.75, 3.0, 2.95], fontSize: 10, rowH: [0.38, ...chunk.map(() => 0.92)], valign: "top", margin: [3, 5, 3, 5] });
}

// ------------------------------------------------------------------ references
{
  const s = slide("References", "");
  // Review III numbered the references differently from its table; follow the table.
  const surname = (a) => a.split(/[ ,]/)[0].normalize("NFD").replace(/[̀-ͯ]/g, "");
  const strip = (r) => r.replace(/^\[\d+\]\s*/, "");
  const refs = LIT.lit.map((row, i) => {
    const hit = LIT.refs.find((r) => surname(strip(r)) === surname(row[1]));
    if (!hit) throw new Error("no reference for " + row[1]);
    return `[${i + 1}] ${strip(hit)}`;
  });
  const half = Math.ceil(refs.length / 2);
  [refs.slice(0, half), refs.slice(half)].forEach((col, c) => {
    s.addText(col.map((r, i) => ({ text: r, options: { breakLine: i < col.length - 1 } })),
      T({ x: 0.6 + c * 6.2, y: 1.6, w: 5.95, h: 5.3, fontSize: 9.5, valign: "top", paraSpaceAfter: 5 }));
  });
}

// ------------------------------------------------------------------ conclusion
{
  const s = slide("Conclusion",
    "Close on what is demonstrable today, then move to the live demo: dashboard, breath test, room scan rejected, leaf scan diagnosed, and the simulation.");
  bullets(s, [
    "The sensing payload works end to end: two wireless nodes, a live dashboard, logging, and leaf-disease classification that refuses to guess without a leaf.",
    "Locomotion is validated in physics simulation with real servo limits: a full autonomous row survey without a fall.",
    "Simulation produced two findings for the physical build: centre-of-mass-centred footholds, and a ~0.18 m/s speed ceiling for MG996R servos.",
  ], 0.7, 1.75, 11.9, 3.6, 16);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 4.6, w: 11.95, h: 1.05, fill: { color: TINT }, line: { color: TINT }, rectRadius: 0.08 });
  s.addText([{ text: "Repository  ", options: { bold: true, color: INK } },
    { text: "github.com/AdithyaSM31/Precision-Agriculture-Monitoring-Quadruped-Robot-Dog", options: { color: ACCENT } }],
  T({ x: 0.95, y: 4.6, w: 11.5, h: 1.05, fontSize: 15, valign: "middle" }));
  s.addText("Thank you", T({ x: 0.7, y: 6.0, w: 11.95, h: 0.7, fontSize: 28, bold: true, color: INK }));
}

pres.writeFile({ fileName: OUT }).then(() => console.log("wrote", OUT));
