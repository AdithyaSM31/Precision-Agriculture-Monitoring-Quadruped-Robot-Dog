// Builds the IEEE-style two-column journal paper (A4) as .docx.
//   NODE_PATH=<dir with docx installed> node build_paper.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  BorderStyle, SectionType, TabStopType, VerticalAlign,
} = require("docx");

const FIG = path.join(__dirname, "figures");
const SIZES = JSON.parse(fs.readFileSync(path.join(FIG, "sizes.json"), "utf8"));
const OUT = path.join(__dirname, "AgriBot_Journal_Paper.docx");
const FONT = "Times New Roman";

// A4, IEEE-like margins; two 3.38 in columns with a 0.25 in gutter
const PAGE_W = 11906, MARGIN_LR = 900, GUTTER = 360;
const COL_W = (PAGE_W - 2 * MARGIN_LR - GUTTER) / 2; // 4873 DXA

// ------------------------------------------------------------------ references (numbered by first citation)
const REFS = {
  savary: 'S. Savary, L. Willocquet, S. J. Pethybridge, P. Esker, N. McRoberts, and A. Nelson, "The global burden of pathogens and pests on major food crops," *Nature Ecology & Evolution*, vol. 3, no. 3, pp. 430–439, 2019, doi: 10.1038/s41559-018-0793-y.',
  bechar: 'A. Bechar and C. Vigneault, "Agricultural robots for field operations: Concepts and components," *Biosystems Engineering*, vol. 149, pp. 94–111, 2016, doi: 10.1016/j.biosystemseng.2016.06.014.',
  fountas: 'S. Fountas *et al.*, "Agricultural robotics for field operations," *Sensors*, vol. 20, no. 9, art. 2672, 2020, doi: 10.3390/s20092672.',
  bledt: 'G. Bledt, M. J. Powell, B. Katz, J. Di Carlo, P. M. Wensing, and S. Kim, "MIT Cheetah 3: Design and control of a robust, dynamic quadruped robot," in *Proc. IEEE/RSJ Int. Conf. Intelligent Robots and Systems (IROS)*, 2018, pp. 2245–2252, doi: 10.1109/IROS.2018.8593885.',
  kau: 'N. Kau, A. Schultz, N. Ferrante, and P. Slade, "Stanford Doggo: An open-source, quasi-direct-drive quadruped," in *Proc. IEEE Int. Conf. Robotics and Automation (ICRA)*, 2019, doi: 10.1109/ICRA.2019.8794436.',
  hutter: 'M. Hutter *et al.*, "ANYmal – a highly mobile and dynamic quadrupedal robot," in *Proc. IEEE/RSJ Int. Conf. Intelligent Robots and Systems (IROS)*, 2016, doi: 10.1109/IROS.2016.7758092.',
  ray: 'P. P. Ray, "Internet of things for smart agriculture: Technologies, practices and future direction," *J. Ambient Intelligence and Smart Environments*, vol. 9, no. 4, pp. 395–420, 2017, doi: 10.3233/AIS-170440.',
  elijah: 'O. Elijah, T. A. Rahman, I. Orikumhi, C. Y. Leow, and M. N. Hindia, "An overview of Internet of Things (IoT) and data analytics in agriculture: Benefits and challenges," *IEEE Internet of Things J.*, vol. 5, no. 5, pp. 3758–3773, 2018.',
  mohanty: 'S. P. Mohanty, D. P. Hughes, and M. Salathé, "Using deep learning for image-based plant disease detection," *Frontiers in Plant Science*, vol. 7, art. 1419, 2016, doi: 10.3389/fpls.2016.01419.',
  ferentinos: 'K. P. Ferentinos, "Deep learning models for plant disease detection and diagnosis," *Computers and Electronics in Agriculture*, vol. 145, pp. 311–318, 2018, doi: 10.1016/j.compag.2018.01.009.',
  too: 'E. C. Too, L. Yujian, S. Njuki, and L. Yingchun, "A comparative study of fine-tuning deep learning models for plant disease identification," *Computers and Electronics in Agriculture*, vol. 161, pp. 272–279, 2019.',
  hughes: 'D. P. Hughes and M. Salathé, "An open access repository of images on plant health to enable the development of mobile disease diagnostics," arXiv:1511.08060, 2015.',
  mobilenet: 'M. Sandler, A. Howard, M. Zhu, A. Zhmoginov, and L.-C. Chen, "MobileNetV2: Inverted residuals and linear bottlenecks," in *Proc. IEEE/CVF Conf. Computer Vision and Pattern Recognition (CVPR)*, 2018, pp. 4510–4520.',
  martinelli: 'F. Martinelli *et al.*, "Advanced methods of plant disease detection. A review," *Agronomy for Sustainable Development*, vol. 35, no. 1, pp. 1–25, 2015, doi: 10.1007/s13593-014-0246-1.',
  woebbecke: 'D. M. Woebbecke, G. E. Meyer, K. Von Bargen, and D. A. Mortensen, "Color indices for weed identification under various soil, residue, and lighting conditions," *Trans. ASAE*, vol. 38, no. 1, pp. 259–269, 1995.',
  spotmicro: 'KDY0523, "SpotMicro – robot dog," Thingiverse, thing 3445283. [Online]. Available: https://www.thingiverse.com/thing:3445283',
  mg996r: 'Tower Pro, "MG996R high torque metal gear servo," product datasheet.',
  sgp30: 'Sensirion AG, "SGP30: Indoor air quality sensor for TVOC and CO2eq measurements," datasheet.',
  mcp9808: 'Microchip Technology Inc., "MCP9808: ±0.5 °C maximum accuracy digital temperature sensor," datasheet.',
  ppd42: 'Shinyei Technology Co., "Particle sensor unit PPD42NS," specification sheet.',
  mujoco: 'E. Todorov, T. Erez, and Y. Tassa, "MuJoCo: A physics engine for model-based control," in *Proc. IEEE/RSJ Int. Conf. Intelligent Robots and Systems (IROS)*, 2012, pp. 5026–5033, doi: 10.1109/IROS.2012.6386109.',
};
const order = [];
function cite(keys) {
  const nums = keys.split(",").map((k) => {
    k = k.trim();
    if (!REFS[k]) throw new Error("unknown reference " + k);
    if (!order.includes(k)) order.push(k);
    return order.indexOf(k) + 1;
  }).sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < nums.length;) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    if (j - i >= 2) parts.push(`[${nums[i]}]–[${nums[j]}]`);
    else for (let k = i; k <= j; k++) parts.push(`[${nums[k]}]`);
    i = j + 1;
  }
  return parts.join(", ");
}

// ------------------------------------------------------------------ inline markup: *italic* **bold** ~sub~ ^sup^ {cite:a,b}
function runs(text, base = {}) {
  text = text.replace(/\{cite:([^}]+)\}/g, (_, k) => cite(k));
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|~[^~]+~|\^[^^]+\^)/g;
  let last = 0, m;
  const push = (t, o = {}) => t && out.push(new TextRun(Object.assign({ text: t, font: FONT, size: 20 }, base, o)));
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) push(tok.slice(2, -2), { bold: true });
    else if (tok.startsWith("*")) push(tok.slice(1, -1), { italics: true });
    else if (tok.startsWith("~")) push(tok.slice(1, -1), { subScript: true });
    else push(tok.slice(1, -1), { superScript: true });
    last = m.index + tok.length;
  }
  push(text.slice(last));
  return out;
}

const body = [];
const para = (text, o = {}) => body.push(new Paragraph({
  children: runs(text, o.run || {}), alignment: o.align || AlignmentType.JUSTIFIED,
  indent: o.noIndent ? undefined : { firstLine: 202 }, spacing: { after: o.after ?? 0, line: 240 },
}));
let secNo = 0, subNo = 0;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
function section(title, numbered = true) {
  subNo = 0;
  const label = numbered ? `${ROMAN[secNo++]}. ${title}` : title;
  body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 }, keepNext: true,
    children: [new TextRun({ text: label, font: FONT, size: 20, smallCaps: true })] }));
}
function subsection(title) {
  const label = `${String.fromCharCode(65 + subNo++)}. ${title}`;
  body.push(new Paragraph({ spacing: { before: 120, after: 60 }, keepNext: true,
    children: [new TextRun({ text: label, font: FONT, size: 20, italics: true })] }));
}
let eqNo = 0;
function equation(text) {
  eqNo++;
  body.push(new Paragraph({
    tabStops: [{ type: TabStopType.CENTER, position: Math.round(COL_W / 2) }, { type: TabStopType.RIGHT, position: COL_W - 20 }],
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text: "\t", font: FONT, size: 20 }), ...runs(text), new TextRun({ text: `\t(${eqNo})`, font: FONT, size: 20 })],
  }));
}
let figNo = 0;
function figure(file, captionText, widthIn = 3.3) {
  figNo++;
  const [w, h] = SIZES[file];
  const px = Math.round(widthIn * 96), py = Math.round(px * h / w);
  body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true,
    children: [new ImageRun({ type: file.endsWith(".png") ? "png" : "jpg", data: fs.readFileSync(path.join(FIG, file)),
      transformation: { width: px, height: py }, altText: { title: `Fig. ${figNo}`, description: captionText, name: file } })] }));
  body.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 160 },
    children: runs(`Fig. ${figNo}.  ${captionText}`, { size: 16 }) }));
}
let tabNo = 0;
const thin = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
function table(title, rows, widths) {
  tabNo++;
  const total = widths.reduce((a, b) => a + b, 0);
  const cols = widths.map((w) => Math.round(w / total * COL_W));
  body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 140 }, keepNext: true,
    children: [new TextRun({ text: `TABLE ${ROMAN[tabNo - 1]}`, font: FONT, size: 16 })] }));
  body.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, keepNext: true,
    children: [new TextRun({ text: title, font: FONT, size: 16, smallCaps: true })] }));
  const last = rows.length - 1;
  body.push(new Table({
    width: { size: cols.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: cols,
    rows: rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, ci) => new TableCell({
      width: { size: cols[ci], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
      margins: { top: 30, bottom: 30, left: 70, right: 70 },
      borders: { top: ri <= 1 ? thin : none, bottom: ri === 0 || ri === last ? thin : none, left: none, right: none },
      children: [new Paragraph({ alignment: ci === 0 ? AlignmentType.LEFT : AlignmentType.CENTER, keepNext: ri < last,
        children: runs(c, { size: 16, bold: ri === 0 }) })],
    })) })),
  }));
  body.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
}
function list(items) {
  items.forEach((t, i) => body.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { left: 288, hanging: 288 },
    spacing: { after: 40 }, children: runs(`${i + 1})\t${t}`) })));
}

// ================================================================== CONTENT
section("Introduction");
para("Plant pathogens and pests remain a major constraint on food production. An expert assessment covering five staple crops in 67 countries put global yield losses at 10–28 % for wheat, 25–41 % for rice and 20–41 % for maize {cite:savary}. Losses of this size make early detection valuable, but early detection depends on observing the crop closely and often, at canopy height, across the whole field.");
para("Field robots are an established route to such observation {cite:bechar,fountas}, yet most are wheeled or tracked and lose traction in soft soil and narrow furrows. Legged robots handle uneven ground well {cite:bledt,kau,hutter}, but research platforms are built around custom high-torque actuators and remain expensive, and even the low-cost Stanford Doggo was designed for agility rather than for carrying sensors {cite:kau}. At the other extreme, Internet-of-Things deployments place stationary sensor nodes in the field {cite:ray,elijah}, which leaves gaps between nodes.");
para("Image-based disease detection with convolutional neural networks reaches very high accuracy on the PlantVillage leaf collection {cite:mohanty,ferentinos,too,hughes}. Two practical problems follow when such a model sits behind a field camera. The training images show a single leaf on a plain background, and the model is closed-set: it assigns one of its known classes to any input, including frames that contain no plant at all.");
para("This paper describes a low-cost monitoring platform built from commodity parts, and reports what its simulation revealed about building such robots. Its contributions are:");
list([
  "A distributed sensing payload of two Wi-Fi microcontroller nodes for gas, temperature, particulate, range and image data, with firmware that detects absent sensors and a camera that registers itself with the dashboard.",
  "A leaf-disease pipeline in which a hue-based vegetation gate rejects frames without a leaf before a MobileNetV2 classifier is consulted.",
  "A MuJoCo model of the printed 12-DOF quadruped built from measured geometry, with servo torque capped at the hobby-servo stall value, and an autonomous row-survey controller that uses the onboard range sensors.",
  "Two design findings for printed quadrupeds with backward-pointing knees: footholds must be centred on the measured centre of mass, and MG996R-class servos limit the trot to about 0.18 m/s.",
  "First actuation trials on the printed robot, which confirm that its servos can hold a stance but have too little torque reserve to step, as the static and dynamic analyses predicted.",
]);
para("Section II reviews related work. Section III describes the system and Section IV the locomotion model. Section V reports results, Section VI discusses them, and Section VII concludes.");

section("Related Work");
subsection("Legged Robots");
para("MIT Cheetah 3 combines proprioceptive actuators with model-predictive control to walk over rough terrain without vision {cite:bledt}. ANYmal is a torque-controllable quadruped built for robust operation in the field {cite:hutter}. Stanford Doggo showed that an open-source quasi-direct-drive design could be built for under US$3,000 with hand tools {cite:kau}. These platforms advance locomotion; none carries an agricultural sensing payload, and their actuators cost far more than the hobby servos used here.");
subsection("Agricultural Robots");
para("Bechar and Vigneault set out the concepts and components of robots for field operations {cite:bechar}, and Fountas et al. found that research effort concentrates on harvesting and weeding {cite:fountas}. Monitoring, which needs mobility more than manipulation, receives less attention.");
subsection("Image-Based Disease Detection");
para("Mohanty et al. trained deep networks on 54,306 PlantVillage images covering 26 diseases and reported 99.35 % accuracy on held-out images {cite:mohanty}; they also observed a large drop in accuracy on images taken under different conditions. Ferentinos evaluated several architectures on 87,848 images {cite:ferentinos}, and Too et al. compared fine-tuned networks on the 38 PlantVillage classes {cite:too}. The dataset is described in {cite:hughes}. MobileNetV2 {cite:mobilenet} was designed for limited compute, which motivates its use here.");
subsection("Environmental Sensing");
para("Diseased and stressed plants change their emission of volatile organic compounds (VOCs), which makes VOC monitoring a candidate early indicator of infection {cite:martinelli}. Agricultural IoT systems usually monitor microclimate with fixed nodes {cite:ray,elijah}. Colour indices such as excess green separate vegetation from soil and residue under varied lighting {cite:woebbecke}, and underpin the vegetation gate of Section III-F.");

section("System Design");
subsection("Mechanical Platform");
para("The chassis is derived from the open SpotMicro design {cite:spotmicro} and was printed in PLA+ with TPU foot pads, 35 parts in total. Its geometry was measured from the printed parts rather than taken from drawings; Table I lists the values used throughout. Each leg has abduction, hip and knee joints, and all four knees point backward. The joints are driven by twelve MG996R servos, whose stall torque is 0.92–1.08 N·m depending on supply voltage {cite:mg996r}. The configuration modelled here weighs 1.35 kg: it carries both sensing nodes but no onboard computer or battery.");
table("Measured Platform Parameters", [
  ["Parameter", "Value"],
  ["Hip spacing, longitudinal × lateral", "140 × 78 mm"],
  ["Shoulder offset *L*~0~", "60 mm"],
  ["Femur *L*~1~ / tibia *L*~2~", "111 / 125 mm"],
  ["Mass (modelled configuration)", "1.35 kg"],
  ["Servo stall torque (MG996R)", "0.92–1.08 N·m"],
], [3, 2]);
para("Fig. 1 shows the assembled robot. The sensor node and its breadboard sit on a printed top cover with the node's Wi-Fi antenna raised on a standoff, and the camera node looks out through the opening in the printed head. The payload is powered over USB from a power bank, so no battery or regulator is carried on the chassis.");
figure("fig_robot.jpg", "The assembled robot: sensor node and antenna on the top cover, camera node in the head, payload powered from a USB power bank.");
subsection("System Architecture");
para("Fig. 2 shows the three parts of the system. A sensor node and a camera node join a 2.4 GHz Wi-Fi hotspot hosted by a laptop, which runs the dashboard and the classifier. Moving inference off the robot removes the need for an onboard GPU, which would add mass, power demand and an expensive component exposed to falls.");
figure("fig1_architecture.png", "System architecture. Both nodes ride on the chassis and reach the laptop over its Wi-Fi hotspot.");
subsection("Sensor Node");
para("The sensor node is a Seeed XIAO ESP32-S3 on an expansion board that provides an OLED display, a buzzer and Grove connectors (Table II). An SGP30 reports total VOC (TVOC) and an estimated CO~2~ equivalent (eCO~2~) over I^2^C. It is read once per second because its on-chip baseline compensation expects that rate, and its first 15 s of output are flagged as warm-up {cite:sgp30}. An MCP9808 measures temperature to ±0.25 °C typical {cite:mcp9808}. A Shinyei PPD42 counts particles larger than 1 µm through the low-pulse occupancy of its output {cite:ppd42}. Two HC-SR04 ultrasonic sensors measure range ahead of the robot and down to the canopy. The node posts its readings to the dashboard as JSON every 5 s.");
table("Sensor Node Interfaces", [
  ["Device", "Quantity", "Interface"],
  ["SGP30", "TVOC, eCO~2~", "I^2^C, 0x58"],
  ["MCP9808", "Temperature", "I^2^C, 0x18"],
  ["PPD42", "Particles > 1 µm", "Digital, D0"],
  ["HC-SR04 × 2", "Range", "Digital, D6–D9"],
  ["OLED", "Local display", "I^2^C, 0x3C"],
], [2.2, 2.4, 2.4]);
para("Three firmware decisions came from bench testing. First, PPD42 low time is accumulated by an interrupt on each edge of its output over 30 s windows, so sampling never blocks the main loop. The ratio *r* of low time to window length, in percent, gives a particle count *C* per 0.01 ft^3^ through the manufacturer's calibration curve {cite:ppd42}:");
equation("*C* = 1.1*r*^3^ − 3.8*r*^2^ + 520*r* + 0.62");
para("With the sensor disconnected, the input read permanently low and (1) returned 1.1 × 10^6^ particles, raising a false alarm. The pin now has a pull-down, and a window with no edges and a low line is reported as an absent sensor. Second, range is computed from the echo time using the temperature-dependent speed of sound,", { noIndent: true });
equation("*c* = 331.3 + 0.606*T*  (m/s)");
para("with *T* in °C from the MCP9808; assuming 343 m/s instead would be about 3 % in error at 35 °C. The two ultrasonic sensors fire alternately so that neither hears the other's pulse, and each reading is the median of the last three. Third, the 5 V outputs of the PPD42 and HC-SR04 reach the 3.3 V microcontroller through 1 kΩ/2 kΩ dividers.", { noIndent: true });
subsection("Camera Node");
para("An ESP32-CAM with an OV3660 sensor captures 640 × 480 JPEG frames. It runs two HTTP servers: one streams Motion-JPEG on port 81 and the other returns a single frame on port 80, so a capture never waits for a stream to end. The camera driver returns the newest frame rather than a buffered one. At boot the node posts both URLs to the dashboard, so it works without anyone knowing the address the hotspot assigned.");
subsection("Dashboard");
para("The dashboard is a Flask application. It shows eCO~2~, TVOC, dust and temperature as cards with recent-history charts, stores every reading in a daily CSV file, and colours readings by status band; for TVOC the moderate and high bands begin at 220 and 660 ppb. It holds a single connection to the camera stream and relays frames to every browser, so additional viewers add no load on the ESP32-CAM.");
subsection("Gated Leaf-Disease Classification");
para("Classification uses MobileNetV2 {cite:mobilenet} fine-tuned on the 38 PlantVillage classes {cite:hughes}, which cover 14 crops; a publicly available fine-tuned checkpoint was used without further training. Each frame first passes a vegetation gate. The frame is reduced to 160 × 120 pixels and converted to HSV, and the leaf coverage *f* is the fraction of pixels whose hue *H*, saturation *S* and value *V* satisfy");
equation("38° ≤ *H* ≤ 165°,   *S* ≥ 0.20,   *V* ≥ 0.12");
para("The hue band spans green and the yellow of chlorotic leaves while excluding skin, wood and soil, and low-saturation walls and floors fail the saturation test. A frame with *f* < 0.12 is reported as containing no leaf. Otherwise the classifier runs, and a top-1 probability below 0.5 is reported as uncertain. Each image is saved with its crop, condition and the gas, dust and temperature readings at capture time. Fig. 3 shows the gate on four camera frames: brown lesions are not counted as leaf-coloured, but the surrounding green tissue keeps diseased leaves above the threshold.", { noIndent: true });
figure("fig_gate.png", "The vegetation gate on four ESP32-CAM frames taken outdoors. Left: camera frame; right: leaf-coloured pixels in green, with the leaf coverage and the gate's decision.", 2.6);

section("Locomotion and Simulation");
subsection("Kinematics");
para("Foot targets (*p*~x~, *p*~y~, *p*~z~) are expressed relative to each leg's abduction joint in the body frame, with *x* forward and *z* up, and side sign *s* = +1 for left legs and −1 for right legs. With *L*~0~, *L*~1~ and *L*~2~ from Table I, the closed-form solution is");
equation("*h* = (*p*~y~^2^ + *p*~z~^2^ − *L*~0~^2^)^1/2^");
equation("*θ*~a~ = atan2(*p*~z~, *p*~y~) − atan2(−*h*, *sL*~0~)");
equation("*θ*~k~ = −arccos[(*p*~x~^2^ + *h*^2^ − *L*~1~^2^ − *L*~2~^2^) / (2*L*~1~*L*~2~)]");
equation("*θ*~h~ = atan2(−*p*~x~, *h*) − atan2(*L*~2~ sin *θ*~k~, *L*~1~ + *L*~2~ cos *θ*~k~)");
para("where *θ*~a~, *θ*~h~ and *θ*~k~ are the abduction, hip and knee angles. The negative knee branch places the knee behind the foot, matching the physical assembly. The solution was checked against the simulator's own forward kinematics at 1,280 targets spanning the working volume of every leg; the largest foot-position error was below 10^−7^ m.", { noIndent: true });
subsection("Simulation Model");
para("The robot was modelled in MuJoCo {cite:mujoco} from the dimensions in Table I, with a 2 ms time step and the implicit-fast integrator. Each joint is driven by a position servo with stiffness 15 N·m/rad and damping 0.15 N·m·s/rad, and its output is clamped to 1.0 N·m, between the MG996R stall values at 4.8 V and 6 V. The feet are rubber spheres with a friction coefficient of 1.2.");
subsection("Gait");
para("The controller runs at 100 Hz and generates a diagonal trot. Each foot follows a straight stance stroke under the body and a raised-cosine swing 30 mm high, at a body height of 180 mm. For forward speed *v* and yaw rate *ω*, the stance stroke of the foot at body position (*x*~i~, *y*~i~) follows the ground velocity (*v* − *ωy*~i~, *ωx*~i~) over the stance time, which turns the robot without a separate turning gait. A levelling term moves each foot vertically by half of the displacement that the measured roll and pitch impose at that foot. A frequency of 2 Hz and a duty factor of 0.6 were chosen from a sweep over frequency (2, 2.5 and 3 Hz), duty factor (0.5 and 0.6), servo stiffness and levelling gain. Footholds are placed around the robot's centre of mass, estimated every control cycle as the whole-body centre of mass in the body frame and low-pass filtered; Section V-C explains why.");
subsection("Survey Mission");
para("The simulated field has four rows of tomato plants 0.7 m apart and 4 m long, a hedge around the boundary, and a patch of stressed plants with yellowed foliage. A VOC plume is modelled over the patch, peaking 640 ppb above a 16 ppb background, and dust over the dry headland. The simulated SGP30 follows the local value through a first-order lag with a 2.5 s time constant. The robot stands up from a crouch and then follows a serpentine route down the three gaps between rows at 0.14 m/s. Heading error *e* sets the yaw rate *ω* = 1.6*e*, limited to ±0.55 rad/s; forward speed is scaled by cos^3^ *e*, and the robot turns on the spot when |*e*| exceeds 0.6 rad. A pass ends when the front range sensor reads less than 0.55 m, which happens when it sees the hedge at the end of a row.");
figure("fig3_simulation.png", "Simulated survey in MuJoCo. The trail behind the robot is coloured by measured TVOC and turns red over the stressed plants; the inset is the onboard camera view.");

section("Results");
subsection("Hardware Validation");
para("Each working module was tested on the bench (Table III). Breathing on the SGP30 raised eCO~2~ from 400 to 746 ppm and TVOC from 0 to 210 ppb within 5 s, and both returned to baseline once the air cleared. Finger contact raised the MCP9808 reading from 31.5 to 35.0 °C in about 10 s. The firmware's connection diagnostics traced repeated authentication time-outs to a missing antenna on the XIAO: the node heard the hotspot at −78 dBm, and at −26 dBm once the antenna was fitted. Switching the camera from per-request stills to MJPEG streaming raised the displayed frame rate from about 0.5 to 16–20 frames per second. With the PPD42 connected, room air read 0–5,065 particles per 0.01 ft^3^, varying from one 30 s window to the next. Two logged sessions of 28 and 17 minutes recorded 321 and 199 readings without gaps.");
table("Bench Validation", [
  ["Test", "Result"],
  ["SGP30, breath", "eCO~2~ 400→746 ppm, TVOC 0→210 ppb in 5 s"],
  ["MCP9808, contact", "31.5→35.0 °C in ~10 s"],
  ["Wi-Fi link, XIAO", "−78 dBm → −26 dBm with antenna"],
  ["Camera video", "~0.5 → 16–20 fps (MJPEG)"],
  ["PPD42, room air", "0–5,065 per 0.01 ft^3^ per 30 s window"],
  ["PPD42 disconnected", "Reported absent; no false count"],
  ["Vegetation gate", "Room rejected; 12 / 12 leaves accepted"],
], [1.8, 4.7]);
subsection("Leaf-Disease Classification");
para("Pointed at an empty room, the classifier alone returned “orange, citrus greening” with 82–90 % confidence; the gate measured 0–0.1 % leaf coverage and rejected every such frame. Twelve PlantVillage images from seven crops measured 27–76 % coverage, and all passed. In an earlier spot check of ten PlantVillage images, eight were classified correctly with confidence above 92 %, one was correct but fell below the 0.5 threshold, and one tomato leaf-mould image was labelled late blight. Outdoors, the camera's washed-out colours lowered the saturation of real foliage: a hedge seen from about 1 m measured 11 % coverage and was rejected, so the network's 75.5 % “grape black rot” was withheld. A potted plant filling the frame passed with 60 % coverage and was labelled healthy corn at 53.4 %; its species was not independently identified, and the low probability is the only warning that the input may lie outside the 14 crops. A photograph of spotted leaves shown on a screen was flagged as diseased (black rot, 80.5 %). Inference took 30–80 ms per image on the laptop CPU. These checks show that the gate behaves as intended; they are not a measurement of accuracy on field images.");
subsection("Gait Stability and the Centre of Mass");
para("With footholds centred on the body, the trot tipped over within 0.8–3.0 s in all 24 settings of the gait sweep, even when stepping in place, and the body always drifted backward. The whole-body centre of mass sat 12 mm behind the body centre: with all knees pointing backward, the leg mass hangs rearward, so the diagonal support line of a trot passes in front of the centre of mass and every support phase tips the body back. With footholds centred on the measured centre of mass, the selected gait trotted in place with tilt below 0.7° and a servo at its torque limit 8 % of the time. Turning reached 113 % of the commanded rate (0.57 rad/s for 0.5 rad/s); the heading loop absorbs the overshoot.");
subsection("Speed Limit");
para("Table IV and Fig. 5 show the response to commanded speed. From 0.08 to 0.18 m/s the robot tracked the command to within 7 %. At 0.20 m/s the servos were at their torque limit 68 % of the time and tilt reached 12°; at 0.22 m/s the robot fell. The 0.24 m/s run stayed upright but reached only 0.166 m/s with 77 % saturation, so it is not usable either. With a 1.0 N·m cap, MG996R-class servos therefore limit this platform to about 0.18 m/s.");
table("Trot Speed Against Servo Saturation", [
  ["Commanded (m/s)", "Achieved (m/s)", "At limit", "Outcome"],
  ["0.06", "0.053", "8 %", "Stable"],
  ["0.08", "0.075", "8 %", "Stable"],
  ["0.10", "0.096", "8 %", "Stable"],
  ["0.14", "0.134", "15 %", "Stable"],
  ["0.18", "0.168", "34 %", "Stable"],
  ["0.20", "0.147", "68 %", "Tilt 12°"],
  ["0.22", "0.102", "78 %", "Fell"],
  ["0.24", "0.166", "77 %", "Tilt 16°"],
], [1.6, 1.6, 1.2, 1.4]);
figure("fig5_speed_sweep.png", "Achieved speed and time at the torque limit against commanded trot speed; × marks a fall.");
subsection("Autonomous Survey");
para("The robot completed the survey without falling (Table V, Figs. 4 and 6). It walked 16.7 m in 129 s at a mean 0.131 m/s, kept body tilt within 2.7°, and had a servo at its torque limit 1.3 % of the time; the median per-cycle peak servo load was 62.5 % of stall. The front range sensor ended all three passes, each 55 cm from the hedge. Measured TVOC peaked at 535 ppb at *x* = 0.60 m, 0.2 m from the plume centre at *x* = 0.80 m. The robot crossed the plume moving towards −*x*, and the sensor's 2.5 s lag displaced the peak by a comparable distance along the path.");
table("Autonomous Survey Metrics", [
  ["Metric", "Value"],
  ["Distance / duration", "16.7 m / 129 s"],
  ["Mean speed", "0.131 m/s"],
  ["Falls", "0"],
  ["Maximum body tilt", "2.7°"],
  ["Time any servo at limit", "1.3 %"],
  ["Row ends detected by ultrasound", "3 / 3"],
  ["TVOC peak / offset from source", "535 ppb / 0.2 m"],
], [3, 2]);
figure("fig4_survey_map.png", "Top view of the survey: path coloured by measured TVOC over the modelled VOC field. Squares mark row ends detected by the front ultrasonic sensor.");
subsection("Actuation on the Physical Robot");
para("The twelve servos of the printed robot were then driven in two recorded trials. With the robot on its back, so that the servos carried only the legs, all four legs moved through their commanded joint angles, which confirmed the wiring, joint directions and control signals. Standing on its feet (Fig. 7), the robot supported its own weight and shifted its legs and body, but the motion was slow, of small amplitude and visibly strained, and it did not take a step. This agrees with the analysis: the static knee torque in a four-foot stance is 36–52 % of a genuine MG996R's rating and rises when a leg lifts, inexpensive copies of the servo often deliver less, and twelve servos moving together draw enough current to make a sagging supply a further cause.");
figure("fig_stand.jpg", "Standing trial on the physical robot, frames from a 10 s video: the robot supports its own weight and shifts its legs, but slowly and with little reserve.", 3.0);

section("Discussion");
para("The centre-of-mass offset follows from the leg geometry rather than from the simulator, so it applies equally to the physical robot: a gait for a printed quadruped with backward-pointing knees should place footholds around the measured centre of mass, which moves as payload is added. The speed ceiling is tied to the servo class in the same way. Lighter legs or stronger servos would raise it; within an MG996R budget, monitoring is better served by slow, steady walking, which also suits the sensors.");
para("The VOC result shows a trade-off between survey speed and localisation, because a slow gas sensor smears a point source along the path. A slower pass, a pause at each waypoint, or deconvolution with the sensor's known response would each reduce the offset.");
para("The vegetation gate is deliberately simple. It cannot tell a leaf of an untrained crop from a trained one, or a photograph of a leaf from a plant, and open-set recognition would be the principled replacement. It does stop the most damaging failure in a demonstration or deployment: confident disease reports from frames with no plant in them. Moving perception to a laptop keeps the robot light and inexpensive at the cost of depending on the network; the firmware's connection diagnostics and the camera's self-registration reduce that cost in practice.");
para("The work has clear limitations. The environmental fields in the simulation are modelled, not measured, so the simulation demonstrates the method rather than field performance. The classifier was trained on laboratory images and has not been evaluated on field images. eCO~2~ from the SGP30 is estimated from VOCs, and the PPD42 is an uncalibrated particle counter. Walking has so far been shown only in simulation: on the physical robot the servos hold a stance but cannot yet step, and the causes, servo strength and supply sag, have not been separated by measurement. The ultrasonic sensors had firmware support but were not yet wired at the time of writing, and the gate's saturation limit should be tuned to the colour response of the ESP32-CAM.");

section("Conclusion");
para("A low-cost legged monitoring platform was built from a printed quadruped chassis, two microcontroller sensing nodes and a laptop dashboard. The sensing payload works end to end, and a vegetation gate stops the classifier from reporting diseases in frames without leaves. A physics model with realistic servo limits showed that the robot can survey crop rows autonomously once its footholds account for a 12 mm rearward centre-of-mass offset, and that MG996R servos cap its trot near 0.18 m/s. On the printed robot the servos move the legs and hold a stance, but with too little torque reserve to step. Future work will give the servos a dedicated supply, apply the centre-of-mass correction and a taller stance with straighter legs to demonstrate walking on the physical robot, wire the ultrasonic sensors, act on readings through a relay-driven irrigation output, evaluate the classifier on field images, and compensate for the gas sensor's response lag.");

section("Acknowledgment", false);
para("The authors thank the School of Computer Science and Engineering, Vellore Institute of Technology, Chennai, for its support. The SpotMicro design by KDY0523 is used under a Creative Commons Attribution licence.");

section("References", false);
order.forEach((k, i) => body.push(new Paragraph({
  alignment: AlignmentType.LEFT, indent: { left: 400, hanging: 400 }, spacing: { after: 40 },
  tabStops: [{ type: TabStopType.LEFT, position: 400 }],
  children: runs(`[${i + 1}]\t${REFS[k]}`, { size: 16 }),
})));
const unused = Object.keys(REFS).filter((k) => !order.includes(k));
if (unused.length) throw new Error("uncited references: " + unused.join(", "));

// ------------------------------------------------------------------ title block
const title = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [new TextRun({ text: "A Low-Cost Legged Platform for In-Field Crop and Air-Quality Monitoring with Gated Leaf-Disease Classification and Physics-Validated Locomotion", font: FONT, size: 44 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
    children: [new TextRun({ text: "Adithya Sankar Menon, Siddhesh Pushkraj Shinde, Rachit Gupta, and Lakshmanan K", font: FONT, size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 },
    children: [new TextRun({ text: "School of Computer Science and Engineering, Vellore Institute of Technology, Chennai, India", font: FONT, size: 20, italics: true })] }),
];
const abstract = new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [
  new TextRun({ text: "Abstract", font: FONT, size: 18, bold: true, italics: true }),
  new TextRun({ text: "—", font: FONT, size: 18, bold: true }),
  ...runs("Crop-level monitoring needs sensors that can move between planted rows, yet wheeled field robots struggle in soft soil and commercial legged robots are costly. This paper presents a low-cost monitoring platform built on a 3D-printed, twelve-degree-of-freedom quadruped chassis. Sensing is split across two Wi-Fi nodes: an ESP32-S3 node that reads volatile organic compounds and estimated CO~2~ (SGP30), temperature (MCP9808), particulate count (PPD42) and ultrasonic range, and an ESP32-CAM node that streams video. A laptop-side dashboard logs every reading and classifies leaf disease with a MobileNetV2 network trained on PlantVillage. Because a closed-set classifier always returns one of its classes, a hue-based vegetation gate rejects frames without a leaf: it rejected a room scene that the network alone labelled as citrus greening with 82–90 % confidence, while accepting all twelve leaf images tested. Locomotion is validated in a MuJoCo model built from the measured chassis geometry, with servo torque capped at the MG996R stall value. The simulation exposed a 12 mm rearward centre-of-mass offset that toppled the trot in all 24 gait settings tried until footholds were centred on the measured centre of mass. After this correction the robot completed an autonomous survey of three crop rows (16.7 m in 129 s) with tilt below 2.7°, detected every row end ultrasonically, and located a simulated disease-related VOC source to within 0.2 m. A speed sweep shows that MG996R torque limits the trot to about 0.18 m/s. On the physical robot, the servos hold a stance and move the legs but lack the torque reserve to step, consistent with these limits.", { size: 18, bold: true }),
] });
const keywords = new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 160 }, children: [
  new TextRun({ text: "Index Terms", font: FONT, size: 18, bold: true, italics: true }),
  new TextRun({ text: "—Agricultural robotics, quadruped robot, precision agriculture, plant disease detection, environmental sensing, ESP32, MuJoCo simulation.", font: FONT, size: 18, bold: true }),
] });

const page = { size: { width: PAGE_W, height: 16838 }, margin: { top: 1080, bottom: 1080, left: MARGIN_LR, right: MARGIN_LR } };
const doc = new Document({
  creator: "Adithya Sankar Menon",
  title: "A Low-Cost Legged Platform for In-Field Crop and Air-Quality Monitoring",
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  sections: [
    { properties: { page }, children: title },
    { properties: { page, type: SectionType.CONTINUOUS, column: { count: 2, space: GUTTER, equalWidth: true } },
      children: [abstract, keywords, ...body] },
  ],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("wrote", OUT, `(${order.length} references, ${figNo} figures, ${tabNo} tables)`); });
