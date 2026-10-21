// Final review deck, organised around the six criteria of the Final Review panel rubric.
//   NODE_PATH=<dir with pptxgenjs, react, react-dom, react-icons, sharp> node build_final_deck.js [out.pptx]
// Images, videos and their poster frames live in ./img (sizes in img/manifest.json).
const pptxgen = require("pptxgenjs");
const path = require("path");
const fs = require("fs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const gi = require("react-icons/gi");

const ROOT = path.resolve(__dirname, "..");
const IMG = path.join(__dirname, "img");
const MAN = JSON.parse(fs.readFileSync(path.join(IMG, "manifest.json"), "utf8"));
const LIT = JSON.parse(fs.readFileSync(path.join(__dirname, "old_lit.json"), "utf8"));
const NOTES = require("./speaker_notes.js");   // detailed notes, keyed by slide title
const SWEEP = JSON.parse(fs.readFileSync(path.join(ROOT, "simulation", "results", "speed_sweep.json"), "utf8"));
const SESSION_CSV = path.join(ROOT, "agri_monitor", "dashboard", "data", "sensors_2026-10-14.csv");
const OUT = process.argv[2] || path.join(ROOT, "Project Final Review PPT.pptx");
const APPLY_THEME = process.env.PPTX_APPLY_THEME;   // path to the pptx skill's scripts/apply_theme.js

// ------------------------------------------------------------------ theme
const HEX = {
  ink: "1B2620", forest: "173F2A", white: "FFFFFF", mist: "EEF4EC",
  leaf: "2F7D46", lime: "8DC63F", amber: "C98A0B", red: "B3261E", sky: "2B6F8E", sage: "6B7768",
  rule: "D3DED0", paleOnDark: "CFE3C8",
};
const THEME = {
  name: "AgriBot Field",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: HEX.ink, lt1: HEX.white, dk2: HEX.forest, lt2: HEX.mist,
    accent1: HEX.leaf, accent2: HEX.lime, accent3: HEX.amber, accent4: HEX.red, accent5: HEX.sky, accent6: HEX.sage,
    hlink: HEX.sky, folHlink: HEX.sage,
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.author = "Adithya Sankar Menon";
pres.title = "Precision Agriculture Monitoring Quadruped Robot Dog - Final Review";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const INK = C.text1, FOREST = C.text2, WHITE = C.background1, MIST = C.background2;
const LEAF = C.accent1, LIME = C.accent2, AMBER = C.accent3, RED = C.accent4, SKY = C.accent5, SAGE = C.accent6;

const LOGO = path.join(IMG, "vit_logo.jpg");
const FOOT = "Final Review  ·  Precision Agriculture Monitoring Quadruped Robot Dog";

pres.defineSlideMaster({ title: "TITLE_DARK", background: { color: HEX.forest } });
pres.defineSlideMaster({
  title: "DIVIDER",
  background: { color: HEX.forest },
  objects: [
    { placeholder: { options: { name: "num", type: "body", x: 0.8, y: 1.55, w: 4, h: 1.5, fontSize: 88, bold: true,
      color: LIME, fontFace: THEME.headFontFace, valign: "bottom", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 3.1, w: 8.6, h: 1.2, fontSize: 44, bold: true,
      color: WHITE, valign: "top", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 4.45, w: 8.4, h: 1.4, fontSize: 18,
      color: MIST, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: HEX.white },
  objects: [
    { image: { path: LOGO, x: 11.55, y: 0.36, w: 1.35, h: 1.35 * 298 / 900 } },
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.32, w: 10.7, h: 0.8, fontSize: 30, bold: true,
      color: FOREST, valign: "middle", align: "left", margin: 0 }, text: "" } },
    { text: { text: FOOT, options: { x: 0.6, y: 7.02, w: 9, h: 0.28, fontSize: 10, color: SAGE, margin: 0 } } },
  ],
  slideNumber: { x: 12.25, y: 7.02, w: 0.65, h: 0.28, fontSize: 10, color: SAGE, align: "right" },
});

// ------------------------------------------------------------------ icons
const ICONS = {
  seedling: fa.FaSeedling, leaf: fa.FaLeaf, chip: fa.FaMicrochip, wifi: fa.FaWifi, camera: fa.FaCamera,
  robot: fa.FaRobot, chart: fa.FaChartLine, cogs: fa.FaCogs, laptop: fa.FaLaptopCode, shield: fa.FaShieldAlt,
  scale: fa.FaBalanceScale, rupee: fa.FaRupeeSign, bulb: fa.FaLightbulb, check: fa.FaCheckCircle,
  warn: fa.FaExclamationTriangle, thermo: fa.FaThermometerHalf, wind: fa.FaWind, smog: fa.FaSmog,
  tractor: fa.FaTractor, tower: fa.FaBroadcastTower, cubes: fa.FaCubes, diagram: fa.FaProjectDiagram,
  video: fa.FaVideo, lock: fa.FaLock, bolt: fa.FaBolt, route: fa.FaRoute, book: fa.FaBook, search: fa.FaSearch,
  clipboard: fa.FaClipboardCheck, github: fa.FaGithub, walk: fa.FaWalking, db: fa.FaDatabase, eye: fa.FaEye,
  filter: fa.FaFilter, brain: fa.FaBrain, flask: fa.FaFlask, map: fa.FaMapMarkedAlt, tools: fa.FaTools,
  plug: fa.FaPlug, list: fa.FaListOl, heart: fa.FaHandHoldingHeart, usershield: fa.FaUserShield, code: fa.FaCode,
  compass: fa.FaDraftingCompass, gauge: fa.FaTachometerAlt, vial: fa.FaVial, ruler: fa.FaRulerCombined,
  question: fa.FaQuestion, flag: fa.FaFlagCheckered, sync: fa.FaSync, steth: fa.FaStethoscope,
  drone: gi.GiDeliveryDrone, leg: gi.GiRobotLeg, sprout: gi.GiSprout,
};
const iconCache = {};
async function iconData(name, hex) {
  const key = name + hex;
  if (!iconCache[key]) {
    const svg = renderToStaticMarkup(React.createElement(ICONS[name], { color: "#" + hex, size: 256 }));
    const png = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
    iconCache[key] = "image/png;base64," + png.toString("base64");
  }
  return iconCache[key];
}

// ------------------------------------------------------------------ helpers
const T = (o) => Object.assign({ isTextBox: true, margin: 0, color: INK, fontSize: 16, valign: "top" }, o);
let objId = 0;
const nm = (p) => `${p}-${++objId}`;

function contentSlide(section, title, notes) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(title, { placeholder: "title" });
  const n = NOTES[title] || notes;
  if (n) s.addNotes(n);
  return s;
}

async function divider(section, num, title, body, icon, notes) {
  pres.addSection({ title: section });
  const s = pres.addSlide({ masterName: "DIVIDER", sectionTitle: section });
  s.addText(num, { placeholder: "num" });
  s.addText(title, { placeholder: "title" });
  s.addText(body, { placeholder: "body" });
  s.addImage({ data: await iconData(icon, HEX.lime), x: 9.35, y: 1.7, w: 3.3, h: 3.3, transparency: 70, objectName: nm("divider-icon") });
  const n = NOTES[`${num}|${title}`] || notes;
  if (n) s.addNotes(n);
  return s;
}

async function iconCircle(s, icon, x, y, d = 0.62, fill = LEAF, glyph = HEX.white) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill }, objectName: nm("icon-bg") });
  const g = d * 0.52;
  s.addImage({ data: await iconData(icon, glyph), x: x + (d - g) / 2, y: y + (d - g) / 2, w: g, h: g, objectName: nm("icon") });
}

function panel(s, x, y, w, h, fill = MIST) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.1, objectName: nm("panel") });
}

// card: tinted panel, icon circle, bold head beside it, body below
async function card(s, x, y, w, h, icon, head, body, o = {}) {
  panel(s, x, y, w, h, o.fill || MIST);
  await iconCircle(s, icon, x + 0.25, y + 0.25, 0.6, o.iconFill || LEAF);
  s.addText(head, T({ x: x + 1.0, y: y + 0.25, w: w - 1.2, h: 0.6, fontSize: o.headSize || 18, bold: true, color: o.headColor || FOREST, valign: "middle" }));
  if (body) s.addText(body, T({ x: x + 0.25, y: y + 1.0, w: w - 0.5, h: h - 1.15, fontSize: o.size || 15, paraSpaceAfter: 4 }));
}

function lead(s, text, y = 1.3, size = 18) {
  s.addText(text, T({ x: 0.6, y, w: 12.1, h: 0.5, fontSize: size, color: INK, valign: "middle" }));
}

function caption(s, text, x, y, w, h = 0.3) {
  s.addText(text, T({ x, y, w, h, fontSize: 12, italic: true, color: SAGE }));
}

function box(file, x, y, w, h, o = {}) {
  const [iw, ih] = MAN[file];
  const k = Math.min(w / iw, h / ih);
  const dw = iw * k, dh = ih * k;
  const ox = o.align === "left" ? x : o.align === "right" ? x + w - dw : x + (w - dw) / 2;
  const oy = o.valign === "top" ? y : o.valign === "bottom" ? y + h - dh : y + (h - dh) / 2;
  return { x: ox, y: oy, w: dw, h: dh };
}
function fit(s, file, x, y, w, h, o = {}) {
  const b = box(file, x, y, w, h, o);
  s.addImage({ path: path.join(IMG, file), ...b, altText: o.alt || file, objectName: nm("image") });
  return b;
}
function video(s, file, x, y, w, h, o = {}) {
  const b = box(file, x, y, w, h, o);
  const poster = fs.readFileSync(path.join(IMG, file.replace(".mp4", "_poster.png"))).toString("base64");
  s.addMedia({ type: "video", path: path.join(IMG, file), ...b, cover: "data:image/png;base64," + poster, objectName: nm("video") });
  return b;
}

function table(s, rows, o) {
  const head = rows[0].map((t) => ({ text: t, options: { bold: true, fill: { color: FOREST }, color: WHITE } }));
  const body = rows.slice(1).map((r, ri) => r.map((c) => {
    const cell = typeof c === "string" ? { text: c, options: {} } : { text: c.text, options: Object.assign({}, c.options) };
    cell.options.fill = { color: ri % 2 ? WHITE : MIST };
    return cell;
  }));
  s.addTable([head, ...body], Object.assign({
    fontSize: 14, color: INK, valign: "middle", border: { type: "solid", pt: 0.75, color: HEX.rule },
    margin: [4, 8, 4, 8], objectName: nm("table"),
  }, o));
}

function stat(s, x, y, w, big, label, color = LEAF, size = 40) {
  s.addText(big, T({ x, y, w, h: size / 60, fontSize: size, bold: true, color, fontFace: THEME.headFontFace, valign: "bottom" }));
  s.addText(label, T({ x, y: y + size / 60 + 0.06, w, h: 0.7, fontSize: 14, color: SAGE }));
}

function chip(s, text, x, y, w, fill) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.36, fill: { color: fill }, line: { color: fill }, rectRadius: 0.18, objectName: nm("chip") });
  s.addText(text, T({ x, y, w, h: 0.36, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle" }));
}

function bullets(s, items, x, y, w, h, size = 17) {
  s.addText(items.map((t, i) => ({ text: t, options: { bullet: { indent: 18 }, breakLine: i < items.length - 1 } })),
    T({ x, y, w, h, fontSize: size, paraSpaceAfter: 10 }));
}

const ok = (t) => ({ text: t, options: { bold: true, color: LEAF } });
const part = (t) => ({ text: t, options: { bold: true, color: AMBER } });
const bad = (t) => ({ text: t, options: { bold: true, color: RED } });

const chartText = {
  catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt",
  titleFontFace: "+mn-lt", legendFontFace: "+mn-lt", catAxisTitleFontFace: "+mn-lt", valAxisTitleFontFace: "+mn-lt",
  catAxisLabelColor: HEX.sage, valAxisLabelColor: HEX.sage, catAxisLabelFontSize: 12, valAxisLabelFontSize: 12,
  catAxisTitleColor: HEX.sage, valAxisTitleColor: HEX.sage, catAxisTitleFontSize: 12, valAxisTitleFontSize: 12,
  titleColor: HEX.forest, titleFontSize: 15, legendFontSize: 12, legendColor: HEX.ink,
  valGridLine: { color: HEX.rule, size: 0.75 }, catGridLine: { style: "none" },
};

// ================================================================== slides
async function build() {
  const agendaRanges = {};
  const mark = (k) => { agendaRanges[k] = [pres.slides.length + 1]; };
  const close = (k) => { agendaRanges[k].push(pres.slides.length); };

  // ---------------------------------------------------------------- 1 title
  pres.addSection({ title: "Opening" });
  {
    const s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Opening" });
    s.addImage({ path: path.join(IMG, "photo_robot.jpg"), x: 7.35, y: 0, w: 5.983, h: 7.5,
      sizing: { type: "cover", w: 5.983, h: 7.5 }, objectName: "hero-photo", altText: "The assembled robot standing outdoors" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 0.55, w: 2.05, h: 0.78, fill: { color: WHITE }, line: { color: WHITE }, rectRadius: 0.08, objectName: "logo-chip" });
    s.addImage({ path: LOGO, x: 0.85, y: 0.63, w: 1.75, h: 1.75 * 298 / 900, objectName: "logo" });
    s.addText("CAPSTONE PROJECT  ·  FINAL REVIEW", T({ x: 0.7, y: 1.75, w: 6.3, h: 0.4, fontSize: 15, bold: true, color: LIME, charSpacing: 2 }));
    s.addText("Precision Agriculture Monitoring Quadruped Robot Dog",
      T({ x: 0.7, y: 2.2, w: 6.4, h: 2.0, fontSize: 38, bold: true, color: WHITE, fontFace: THEME.headFontFace }));
    s.addText("A 3D-printed quadruped carrying wireless crop-health sensing, with leaf-disease classification and physics-validated locomotion",
      T({ x: 0.7, y: 4.2, w: 6.3, h: 0.95, fontSize: 17, color: MIST }));
    s.addText([
      { text: "Adithya Sankar Menon  ·  23BRS1079", options: { breakLine: true } },
      { text: "Siddhesh Pushkraj Shinde  ·  23BCE5048", options: { breakLine: true } },
      { text: "Rachit Gupta  ·  23BCE1658", options: { breakLine: true } },
      { text: "Guide: Dr. Lakshmanan K  ·  54758", options: { bold: true, color: LIME } },
    ], T({ x: 0.7, y: 5.35, w: 6.3, h: 1.6, fontSize: 15, color: WHITE, lineSpacingMultiple: 1.15 }));
    s.addNotes(NOTES.__title || "Introduce the team and the one-line summary: a printed quadruped that carries a working sensing payload, a dashboard that classifies leaf disease, locomotion validated in physics simulation, and legs that now move on the real robot. Say that the talk follows the six criteria of the panel rubric.");
  }

  // ---------------------------------------------------------------- 2 agenda (ranges filled in at the end)
  const agenda = contentSlide("Opening", "How This Review Is Organised",
    "The talk follows the panel rubric, one section per criterion, so the panel can find the evidence for each mark. The live demo sits in section 03.");
  const AGENDA = [
    ["domain", "search", "Domain and Problem", "Crop-loss context, monitoring platforms, 18-paper survey, research gaps, objectives"],
    ["method", "diagram", "Methodology and Design", "Workflow, design decisions, architecture, data flow, algorithms, locomotion model"],
    ["complete", "check", "Completion and Integration", "Scope delivered, assembled robot, integrated dashboard, stable logging, live demo"],
    ["results", "chart", "Testing and Results", "Bench tests, classifier validation, hardware actuation, simulated survey, speed limit"],
    ["innovation", "bulb", "Innovation and Relevance", "Contributions, cost and feasibility, ethics, practical use, limitations, future work"],
    ["close", "flag", "Conclusion and Q&A", "Key takeaways, references, questions"],
  ];

  // ================================================================ 01 domain
  mark("domain");
  await divider("01 Domain and Problem", "01", "Domain and Problem",
    "Why crop-level monitoring matters, what existing platforms miss, and what this project set out to do", "seedling",
    "Criterion 1: domain knowledge and problem understanding.");
  {
    const s = contentSlide("01 Domain and Problem", "Crop Disease Is Costly, and Often Seen Too Late",
      "Open with the scale of the problem. Savary et al. surveyed five staple crops in 67 countries. Early detection needs close, frequent observation at canopy height, which is what the platforms on the right struggle to provide.");
    panel(s, 0.6, 1.45, 5.2, 5.3, FOREST);
    s.addText("20–40 %", T({ x: 0.95, y: 1.75, w: 4.6, h: 1.2, fontSize: 66, bold: true, color: LIME, fontFace: THEME.headFontFace, valign: "middle" }));
    s.addText("of global crop production is lost to plant pests and diseases every year (FAO)", T({ x: 0.95, y: 2.95, w: 4.5, h: 0.9, fontSize: 17, color: WHITE }));
    const losses = [["Wheat", "10–28 %"], ["Rice", "25–41 %"], ["Maize", "20–41 %"]];
    losses.forEach(([crop, v], i) => {
      s.addText(v, T({ x: 0.95 + i * 1.55, y: 4.3, w: 1.5, h: 0.6, fontSize: 24, bold: true, color: WHITE, fontFace: THEME.headFontFace }));
      s.addText(crop, T({ x: 0.95 + i * 1.55, y: 4.9, w: 1.5, h: 0.35, fontSize: 14, color: MIST }));
    });
    s.addText("Yield losses to pathogens and pests, global estimate (Savary et al., 2019)", T({ x: 0.95, y: 5.45, w: 4.6, h: 0.9, fontSize: 13, italic: true, color: MIST }));
    const rows = [
      ["drone", "Drones see only the canopy top", "Short flights; no view of leaf undersides or the air between rows"],
      ["tractor", "Wheeled rovers get stuck", "Lose traction in mud, soft soil and narrow furrows"],
      ["tower", "Fixed IoT nodes leave gaps", "Stationary sensors cover only the spot where they stand"],
      ["rupee", "Research robots cost too much", "Legged platforms such as ANYmal cost far beyond a small farm's budget"],
    ];
    for (const [i, [ic, head, body]] of rows.entries()) {
      const y = 1.5 + i * 1.32;
      await iconCircle(s, ic, 6.25, y + 0.05, 0.7, LEAF);
      s.addText(head, T({ x: 7.2, y, w: 5.5, h: 0.45, fontSize: 19, bold: true, color: FOREST }));
      s.addText(body, T({ x: 7.2, y: y + 0.47, w: 5.5, h: 0.7, fontSize: 16 }));
    }
  }
  {
    const s = contentSlide("01 Domain and Problem", "Which Platform Can Monitor Between Crop Rows?",
      "A qualitative comparison drawn from the literature survey. The legged robot is the only platform that combines close-range sensing with mobility on soft ground; the open question this project tackles is whether it can be done at hobby-servo cost.");
    lead(s, "A legged robot can walk between rows and carry sensors to the leaves; the question is whether it can be built cheaply.");
    const Y = { text: "✓", options: { bold: true, color: LEAF, align: "center", fontSize: 20 } };
    const N = { text: "✗", options: { bold: true, color: RED, align: "center", fontSize: 20 } };
    const P = { text: "~", options: { bold: true, color: AMBER, align: "center", fontSize: 20 } };
    table(s, [
      ["Platform", "Close-range, leaf-level sensing", "Moves on soft soil and in furrows", "Covers the whole field", "Affordable for small farms"],
      ["Drone", N, Y, Y, P],
      ["Wheeled or tracked rover", Y, N, P, P],
      ["Fixed IoT sensor nodes", P, { text: "—", options: { align: "center", color: SAGE } }, N, P],
      ["Research quadruped (ANYmal, Cheetah 3)", Y, Y, Y, N],
      [{ text: "This project: printed quadruped", options: { bold: true, color: FOREST } }, Y, Y, Y, Y],
    ], { x: 0.6, y: 2.0, w: 12.1, colW: [3.5, 2.25, 2.25, 2.05, 2.05], rowH: 0.62, fontSize: 15 });
    s.addText("✓ suited     ~ partly     ✗ not suited", T({ x: 0.6, y: 6.15, w: 8, h: 0.35, fontSize: 13, color: SAGE }));
  }
  {
    const s = contentSlide("01 Domain and Problem", "What 18 Papers Tell Us",
      "Summarise the survey by theme rather than paper by paper; the full 18-paper table is in the backup slides at the end. Each theme ends with the gap this project addresses.");
    const themes = [
      ["leg", "Legged locomotion  [1–6]", "MIT Cheetah 3, Mini Cheetah, ANYmal, Stanford Doggo; MPC and learned gaits", "Custom actuators, costly; none carries a crop-sensing payload"],
      ["tractor", "Field robots and drones  [7–10]", "Reviews of agricultural rovers, drone–ground teaming, farmer interfaces", "Wheels fail in mud and furrows; drones cannot see under the canopy"],
      ["leaf", "Leaf-disease deep learning  [11–15]", "CNNs reach 97–99 % on PlantVillage; MobileNetV2 is efficient enough for edge use", "Lab images only; closed-set models label anything they see"],
      ["tower", "IoT environmental sensing  [16–18]", "Layered IoT and sensor networks for microclimate, gases and soil", "Stationary nodes leave gaps; nothing carries sensors along rows"],
    ];
    for (const [i, [ic, head, found, gap]] of themes.entries()) {
      const x = 0.6 + (i % 2) * 6.15, y = 1.4 + Math.floor(i / 2) * 2.75;
      panel(s, x, y, 5.95, 2.55);
      await iconCircle(s, ic, x + 0.25, y + 0.25, 0.6);
      s.addText(head, T({ x: x + 1.0, y: y + 0.25, w: 4.8, h: 0.6, fontSize: 19, bold: true, color: FOREST, valign: "middle" }));
      s.addText(found, T({ x: x + 0.25, y: y + 1.0, w: 5.45, h: 0.75, fontSize: 15 }));
      s.addText([{ text: "Gap  ", options: { bold: true, color: RED } }, { text: gap }], T({ x: x + 0.25, y: y + 1.75, w: 5.45, h: 0.7, fontSize: 15 }));
    }
  }
  {
    const s = contentSlide("01 Domain and Problem", "Research Gaps and How This Project Answers Them",
      "Each gap on the left maps to a part of the build on the right.");
    const gaps = [
      ["Low-cost legged robots have not carried an environmental and imaging payload, and their feasibility with hobby servos is rarely quantified",
        "A printed 12-DOF quadruped with two sensing nodes, and a physics model with the real MG996R torque limit"],
      ["Crop sensing relies on fixed nodes; a mobile, low-cost platform logging gas, dust and temperature along the rows is missing",
        "A wireless sensor node on the robot reporting every 5 s to a logging dashboard"],
      ["Disease classifiers are closed-set and report a disease for any input, even a wall",
        "A vegetation gate that checks for leaf before the classifier is allowed to answer"],
      ["Hobby quadruped designs give no guidance on centre of mass or the speed servos allow",
        "Measured: centre of mass 12 mm aft, trot limited to about 0.18 m/s"],
    ];
    s.addText("Gap in the literature", T({ x: 0.6, y: 1.35, w: 5.6, h: 0.4, fontSize: 16, bold: true, color: RED }));
    s.addText("Our response", T({ x: 7.0, y: 1.35, w: 5.7, h: 0.4, fontSize: 16, bold: true, color: LEAF }));
    for (const [i, [g, r]] of gaps.entries()) {
      const y = 1.85 + i * 1.25;
      panel(s, 0.6, y, 5.8, 1.1, MIST);
      s.addText(g, T({ x: 0.8, y: y + 0.1, w: 5.4, h: 0.9, fontSize: 14.5, valign: "middle" }));
      s.addShape(pres.shapes.RIGHT_ARROW, { x: 6.5, y: y + 0.38, w: 0.4, h: 0.34, fill: { color: LEAF }, line: { color: LEAF }, objectName: nm("arrow") });
      panel(s, 7.0, y, 5.7, 1.1, FOREST);
      s.addText(r, T({ x: 7.2, y: y + 0.1, w: 5.3, h: 0.9, fontSize: 14.5, color: WHITE, valign: "middle" }));
    }
  }
  {
    const s = contentSlide("01 Domain and Problem", "Objectives and Scope",
      "Four objectives, each with evidence later in the deck. Be clear about what is in and out of scope.");
    const objs = [
      ["walk", "Mobility", "A low-cost printed 12-DOF quadruped whose gait is validated against real servo torque limits, then tested on the robot"],
      ["wind", "Sensing", "Gas (TVOC, eCO₂), dust, temperature and range sensing carried on the chassis"],
      ["leaf", "Plant-health AI", "Leaf-disease classification that first checks a leaf is in view"],
      ["chart", "Live dashboard", "Wireless logging, live charts, and leaf images tagged with the readings at capture"],
    ];
    for (const [i, [ic, h, b]] of objs.entries()) {
      await card(s, 0.6 + i * 3.05, 1.4, 2.85, 3.25, ic, h, b, { size: 15 });
    }
    panel(s, 0.6, 4.9, 6.0, 1.85, MIST);
    s.addText([{ text: "In scope", options: { bold: true, color: LEAF, breakLine: true } },
      { text: "Printed platform, sensing and camera nodes, dashboard and classifier, locomotion design, simulation, first actuation trials" }],
    T({ x: 0.85, y: 5.05, w: 5.5, h: 1.6, fontSize: 15 }));
    panel(s, 6.75, 4.9, 5.95, 1.85, MIST);
    s.addText([{ text: "Out of scope", options: { bold: true, color: RED, breakLine: true } },
      { text: "Trials on a working farm, sensor calibration against reference instruments, training a new classifier, GPS mapping" }],
    T({ x: 7.0, y: 5.05, w: 5.5, h: 1.6, fontSize: 15 }));
  }
  close("domain");

  // ================================================================ 02 methodology
  mark("method");
  await divider("02 Methodology and Design", "02", "Methodology and Design",
    "How the system was designed: the workflow, key technical decisions, architecture, data flow and algorithms", "diagram",
    "Criterion 2: methodology, architecture and technical design.");
  {
    const s = contentSlide("02 Methodology and Design", "Methodology: Analyse, Revise, Build, Validate",
      "The project moved from analysis to a revised design, then built and validated each layer. Simulation came before powering the servos, so the gait could be developed without risking the hardware.");
    const steps = [
      ["clipboard", "Analyse", "Torque, power and heat analysis of the Review III plan"],
      ["sync", "Revise", "Move inference to a laptop; split sensing over two ESP32 nodes"],
      ["chip", "Build sensing", "Sensor node and camera firmware, wiring with dividers"],
      ["laptop", "Build software", "Flask dashboard, logging, gated classifier"],
      ["robot", "Simulate", "Kinematics and gait in MuJoCo with real servo limits"],
      ["vial", "Validate", "Bench tests, logged sessions, scans, leg actuation"],
    ];
    const W = 1.88, G = 0.17;
    for (const [i, [ic, h, b]] of steps.entries()) {
      const x = 0.6 + i * (W + G);
      panel(s, x, 1.55, W, 3.6, i % 2 ? MIST : MIST);
      s.addText(String(i + 1).padStart(2, "0"), T({ x: x + 0.2, y: 1.7, w: 1.0, h: 0.5, fontSize: 22, bold: true, color: LIME, fontFace: THEME.headFontFace }));
      await iconCircle(s, ic, x + W - 0.85, 1.7, 0.62);
      s.addText(h, T({ x: x + 0.2, y: 2.5, w: W - 0.35, h: 0.5, fontSize: 18, bold: true, color: FOREST }));
      s.addText(b, T({ x: x + 0.2, y: 3.05, w: W - 0.35, h: 2.0, fontSize: 15 }));
      if (i < steps.length - 1) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + W - 0.02, y: 3.2, w: G + 0.04, h: 0.3, fill: { color: LEAF }, line: { color: LEAF }, objectName: nm("arrow") });
    }
    panel(s, 0.6, 5.4, 12.1, 1.3, FOREST);
    s.addText([{ text: "Guiding principle  ", options: { bold: true, color: LIME } },
      { text: "Every design change came from a measurement or analysis: supply and heat limits, servo torque margin, camera interface, and faults found on the bench." }],
    T({ x: 0.9, y: 5.4, w: 11.5, h: 1.3, fontSize: 17, color: WHITE, valign: "middle" }));
  }
  {
    const s = contentSlide("02 Methodology and Design", "Key Technical Decisions Since Review III",
      "Be direct about the changes and the reason for each.");
    table(s, [
      ["Review III plan", "Final system", "Reason"],
      ["Jetson Orin Nano on the robot", "XIAO ESP32-S3 and ESP32-CAM nodes; inference on a laptop", "Needs 9–19 V and dissipates 7–25 W inside a PLA body; a fall risks an expensive board"],
      ["IMX219 CSI camera", "ESP32-CAM (OV3660), MJPEG over Wi-Fi", "The ESP32-S3 has no MIPI-CSI camera interface"],
      ["ROS 2 and MQTT on the robot", "HTTP and JSON to a Flask dashboard", "Fewer parts; every device on one local network"],
      ["Gazebo dynamics model", "MuJoCo physics model", "The Gazebo stance never stabilised; MuJoCo walks and reports metrics"],
      ["3S LiPo and onboard regulators", "USB power bank for the nodes; separate supply for servos", "Safer and simpler for bench work"],
      ["Walking trials on hardware", "Gait in simulation first, then leg actuation on the robot", "Simulation showed a centre-of-mass correction is needed"],
    ], { x: 0.6, y: 1.4, w: 12.1, colW: [3.0, 4.2, 4.9], rowH: [0.5, 0.78, 0.66, 0.66, 0.66, 0.66, 0.66], fontSize: 14 });
  }
  {
    const s = contentSlide("02 Methodology and Design", "System Architecture",
      "Three parts on one Wi-Fi hotspot hosted by the laptop. The robot carries only inexpensive microcontrollers; all computation is on the laptop.");
    const boxes = [
      [0.6, "chip", "Sensor node", "XIAO ESP32-S3 + expansion board", ["SGP30 gas · I²C 0x58", "MCP9808 temperature · I²C 0x18", "PPD42 dust · D0", "HC-SR04 × 2 · D6–D9", "OLED, buzzer, button"], MIST, FOREST, INK],
      [4.75, "laptop", "Laptop base station", "Hotspot 192.168.137.1", ["Flask dashboard on port 5000", "CSV log of every reading", "Vegetation gate + MobileNetV2", "Relays video to all viewers"], FOREST, WHITE, WHITE],
      [8.9, "camera", "Camera node", "ESP32-CAM, OV3660 sensor", ["MJPEG video on port 81", "Single photo on port 80", "Registers itself at boot"], MIST, FOREST, INK],
    ];
    for (const [x, ic, h, sub, lines, fill, hc, bc] of boxes) {
      panel(s, x, 1.45, 3.8, 3.75, fill);
      await iconCircle(s, ic, x + 0.25, 1.65, 0.62, fill === FOREST ? LIME : LEAF, fill === FOREST ? HEX.forest : HEX.white);
      s.addText(h, T({ x: x + 1.0, y: 1.62, w: 2.7, h: 0.4, fontSize: 18, bold: true, color: hc }));
      s.addText(sub, T({ x: x + 1.0, y: 2.0, w: 2.7, h: 0.35, fontSize: 13, color: fill === FOREST ? MIST : SAGE }));
      s.addText(lines.map((t, i) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: i < lines.length - 1 } })),
        T({ x: x + 0.25, y: 2.55, w: 3.35, h: 2.5, fontSize: 15, color: bc, paraSpaceAfter: 5 }));
    }
    s.addShape(pres.shapes.RIGHT_ARROW, { x: 4.42, y: 3.05, w: 0.32, h: 0.4, fill: { color: LEAF }, line: { color: LEAF }, objectName: nm("arrow") });
    s.addShape(pres.shapes.LEFT_ARROW, { x: 8.57, y: 3.05, w: 0.32, h: 0.4, fill: { color: LEAF }, line: { color: LEAF }, objectName: nm("arrow") });
    s.addText("JSON every 5 s", T({ x: 0.6, y: 5.3, w: 3.8, h: 0.35, fontSize: 14, bold: true, color: LEAF, align: "right" }));
    s.addText("MJPEG video, 16–20 fps", T({ x: 8.9, y: 5.3, w: 3.8, h: 0.35, fontSize: 14, bold: true, color: LEAF }));
    panel(s, 0.6, 5.85, 12.1, 0.95, MIST);
    s.addText([{ text: "Platform  ", options: { bold: true, color: FOREST } },
      { text: "SpotMicro-based printed chassis carrying both nodes  ·  12 × MG996R servos  ·  gait validated in MuJoCo  ·  any phone on the hotspot can open the dashboard" }],
    T({ x: 0.85, y: 5.85, w: 11.7, h: 0.95, fontSize: 15, valign: "middle" }));
  }
  {
    const s = contentSlide("02 Methodology and Design", "Data Flow: From Sensor to Tagged Diagnosis",
      "Two streams meet in the dashboard. Every leaf image is stored together with the air readings at the moment of capture, which is what links plant health to the environment.");
    const lanes = [
      ["Sensor stream", ["Sample: gas 1 s, temperature 2 s, dust 30 s", "Post JSON to /api/sensors every 5 s", "Grade good / moderate / high", "Log to daily CSV, update live cards"], ["thermo", "wifi", "gauge", "db"]],
      ["Camera stream", ["ESP32-CAM streams MJPEG", "Dashboard relays frames to every viewer", "Scan: vegetation gate, then MobileNetV2", "Save image tagged with crop, condition and readings"], ["camera", "video", "filter", "leaf"]],
    ];
    for (const [li, [name, steps, icons]] of lanes.entries()) {
      const y = 1.4 + li * 2.75;
      s.addText(name, T({ x: 0.6, y, w: 4, h: 0.4, fontSize: 18, bold: true, color: FOREST }));
      for (const [i, t] of steps.entries()) {
        const x = 0.6 + i * 3.1;
        panel(s, x, y + 0.5, 2.8, 2.1, i === 3 ? FOREST : MIST);
        await iconCircle(s, icons[i], x + 0.2, y + 0.65, 0.55, i === 3 ? LIME : LEAF, i === 3 ? HEX.forest : HEX.white);
        s.addText(t, T({ x: x + 0.2, y: y + 1.3, w: 2.45, h: 1.2, fontSize: 16, color: i === 3 ? WHITE : INK }));
        if (i < 3) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + 2.83, y: y + 1.4, w: 0.24, h: 0.3, fill: { color: LEAF }, line: { color: LEAF }, objectName: nm("arrow") });
      }
    }
  }
  {
    const s = contentSlide("02 Methodology and Design", "Sensor Node Hardware",
      "The XIAO ESP32-S3 on its expansion board. Gas, temperature and dust are live; the ultrasonic firmware is complete and the sensors are not yet wired. Point out the voltage-divider rule.");
    const b = fit(s, "photo_oled.jpg", 0.6, 1.45, 4.9, 2.85, { valign: "top" });
    caption(s, "Live readings and IP address on the node's OLED", 0.6, b.y + b.h + 0.08, 4.9);
    panel(s, 0.6, 4.75, 4.9, 2.0, MIST);
    s.addText([{ text: "5 V → 3.3 V safely  ", options: { bold: true, color: FOREST, breakLine: true } },
      { text: "Every 5 V sensor output reaches the XIAO through a 1 kΩ / 2 kΩ divider: 5 V becomes 3.33 V, and the PPD42's 4 V becomes 2.67 V." }],
    T({ x: 0.85, y: 4.9, w: 4.45, h: 1.75, fontSize: 15 }));
    table(s, [
      ["Sensor", "Measures", "Interface", "Status"],
      ["SGP30", "TVOC, eCO₂", "I²C 0x58", ok("Live")],
      ["MCP9808", "Temperature, ±0.25 °C", "I²C 0x18", ok("Live")],
      ["PPD42", "Particles > 1 µm", "D0, via divider", ok("Live")],
      ["OLED, buzzer, button", "Display and alerts", "On board", ok("Live")],
      ["HC-SR04 #1", "Obstacle, row end", "D6 / D7", part("Wiring pending")],
      ["HC-SR04 #2", "Canopy height", "D8 / D9", part("Wiring pending")],
    ], { x: 5.85, y: 1.45, w: 6.85, colW: [1.85, 1.95, 1.3, 1.75], rowH: 0.58, fontSize: 14 });
    s.addText("Ultrasonic firmware is written and flashed; the sensors report as absent until connected.",
      T({ x: 5.85, y: 5.75, w: 6.85, h: 0.6, fontSize: 13, italic: true, color: SAGE }));
  }
  {
    const s = contentSlide("02 Methodology and Design", "Firmware Algorithms",
      "Each card is an algorithm or a fix that came from testing. The dust formula is the manufacturer's calibration curve; the speed-of-sound correction keeps range accurate on hot days.");
    const cards = [
      ["smog", "Dust by low-pulse occupancy", "An interrupt times the PPD42's low pulses over 30 s. C = 1.1r³ − 3.8r² + 520r + 0.62 particles per 0.01 ft³"],
      ["warn", "Absent-sensor detection", "An unplugged PPD42 read as 1.1 million particles. No edges and a low line now means absent"],
      ["thermo", "Temperature-corrected range", "c = 331.3 + 0.606·T m/s from the MCP9808; a fixed 343 m/s is ~3 % off at 35 °C"],
      ["sync", "Crosstalk-free ultrasonics", "The two HC-SR04s fire alternately, and each reading is a median of three"],
      ["wifi", "Wi-Fi diagnostics", "Reports why a link fails; traced −78 dBm to a missing antenna, −26 dBm once fitted"],
      ["camera", "Self-registering camera", "The ESP32-CAM sends its stream URL to the dashboard at boot, so a new IP needs no setup"],
    ];
    for (const [i, [ic, h, b]] of cards.entries()) {
      await card(s, 0.6 + (i % 3) * 4.08, 1.45 + Math.floor(i / 3) * 2.7, 3.86, 2.5, ic, h, b, { size: 15, headSize: 16.5 });
    }
  }
  {
    const s = contentSlide("02 Methodology and Design", "Gated Leaf-Disease Classification",
      "The classifier alone has no 'not a leaf' answer: pointed at a room it said citrus greening at 82–90 %. The gate runs first and asks a simpler question: is enough of the frame leaf-coloured? Walk through the four frames.");
    const steps = [
      ["camera", "Frame from the ESP32-CAM"],
      ["filter", "Vegetation gate: share of pixels with 38° ≤ H ≤ 165°, S ≥ 0.20, V ≥ 0.12; below 12 % → no leaf"],
      ["brain", "MobileNetV2 trained on PlantVillage: 38 classes, 14 crops"],
      ["question", "Top probability below 50 % → reported as uncertain"],
      ["db", "Image saved and tagged with crop, condition and the readings"],
    ];
    for (const [i, [ic, t]] of steps.entries()) {
      const y = 1.45 + i * 1.05;
      await iconCircle(s, ic, 0.6, y, 0.6, i === 1 ? LIME : LEAF, i === 1 ? HEX.forest : HEX.white);
      s.addText(t, T({ x: 1.4, y: y - 0.05, w: 3.85, h: 0.95, fontSize: 15, valign: "middle", bold: i === 1, color: i === 1 ? FOREST : INK }));
    }
    const b = fit(s, "vegetation_gate.png", 5.5, 1.4, 7.2, 4.95, { align: "right", valign: "top" });
    caption(s, "The gate on four outdoor camera frames: leaf-coloured pixels in green", b.x, b.y + b.h + 0.1, b.w);
  }
  {
    const s = contentSlide("02 Methodology and Design", "Locomotion Design: Kinematics, Gait, Centre of Mass",
      "Closed-form inverse kinematics from the measured leg geometry, a diagonal trot, and the key finding: footholds must be centred on the centre of mass, which sits 12 mm behind the body centre.");
    const b1 = fit(s, "leg_kinematics.png", 0.6, 1.4, 3.6, 3.75, { valign: "top" });
    caption(s, "Leg geometry: femur 111 mm, tibia 125 mm", 0.6, b1.y + b1.h + 0.08, 3.6);
    const b2 = fit(s, "com_support_line.png", 4.45, 1.4, 3.8, 3.75, { valign: "top" });
    caption(s, "Trot support line passes in front of the centre of mass", 4.45, b2.y + b2.h + 0.08, 3.8, 0.55);
    const items = [
      ["ruler", "Closed-form IK", "Abduction, hip, knee from the foot target; verified at 1,280 targets, error < 10⁻⁷ m"],
      ["walk", "Diagonal trot", "2 Hz, duty 0.6, 30 mm step height, 180 mm body height, roll and pitch levelling"],
      ["compass", "CoM-centred footholds", "Feet placed around the measured centre of mass, 12 mm aft of the body centre"],
    ];
    for (const [i, [ic, h, t]] of items.entries()) {
      const y = 1.45 + i * 1.4;
      await iconCircle(s, ic, 8.55, y, 0.6);
      s.addText(h, T({ x: 9.3, y: y - 0.02, w: 3.4, h: 0.45, fontSize: 17, bold: true, color: FOREST }));
      s.addText(t, T({ x: 9.3, y: y + 0.42, w: 3.4, h: 0.85, fontSize: 14.5 }));
    }
    panel(s, 0.6, 5.75, 12.1, 1.0, FOREST);
    s.addText([{ text: "Why footholds matter  ", options: { bold: true, color: LIME } },
      { text: "Centred on the body, the trot fell in all 24 gait settings; centred on the measured centre of mass, tilt stayed below 0.7°." }],
    T({ x: 0.85, y: 5.75, w: 11.6, h: 1.0, fontSize: 16, color: WHITE, valign: "middle" }));
  }
  {
    const s = contentSlide("02 Methodology and Design", "Simulation Model in MuJoCo",
      "Built in MuJoCo after Gazebo would not hold a stance. Because the servos are capped at MG996R stall torque, a gait that works here is not relying on unrealistic motors. Play the clip.");
    const b = video(s, "sim_survey.mp4", 0.6, 1.4, 7.6, 4.3, { align: "left", valign: "top" });
    caption(s, "Autonomous survey: stand up, trot each row gap, detect the row end, turn, log readings", b.x, b.y + b.h + 0.1, b.w);
    const items = [
      ["ruler", "Measured geometry", "140 × 78 mm hip spacing, 111 / 125 mm legs, 1.35 kg"],
      ["bolt", "Realistic servos", "Position servos capped at 1.0 N·m (MG996R stall 0.92–1.08 N·m)"],
      ["map", "Modelled field", "4 tomato rows, a stressed patch emitting VOCs, a dusty headland"],
      ["route", "Autonomous mission", "Heading control; front range sensor ends each row at 55 cm"],
    ];
    for (const [i, [ic, h, t]] of items.entries()) {
      const y = 1.45 + i * 1.15;
      await iconCircle(s, ic, 8.55, y, 0.58);
      s.addText(h, T({ x: 9.3, y: y - 0.02, w: 3.4, h: 0.42, fontSize: 17, bold: true, color: FOREST }));
      s.addText(t, T({ x: 9.3, y: y + 0.4, w: 3.4, h: 0.72, fontSize: 14.5 }));
    }
    panel(s, 0.6, 6.2, 12.1, 0.62, MIST);
    s.addText([{ text: "Gait chosen by a sweep  ", options: { bold: true, color: FOREST } },
      { text: "24 settings: frequency 2 / 2.5 / 3 Hz × duty 0.5 / 0.6 × stiffness 15 / 30 N·m/rad × levelling gain 0 / 0.5" }],
    T({ x: 0.85, y: 6.2, w: 11.6, h: 0.62, fontSize: 15, valign: "middle" }));
  }
  {
    const s = contentSlide("02 Methodology and Design", "Technology Stack",
      "Everything is in the public GitHub repository with run instructions.");
    const cards = [
      ["chip", "Hardware", "XIAO ESP32-S3 + expansion board · ESP32-CAM (OV3660) · SGP30, MCP9808, PPD42, HC-SR04 × 2 · 12 × MG996R"],
      ["code", "Firmware", "Arduino-ESP32 core 3.3 · Adafruit SGP30 · U8g2 display · esp_http_server for MJPEG"],
      ["brain", "Dashboard and AI", "Python · Flask · PyTorch · Hugging Face Transformers · MobileNetV2 (PlantVillage)"],
      ["robot", "Simulation", "MuJoCo 3 · NumPy · Matplotlib · headless video and metrics"],
      ["cubes", "Mechanical", "SpotMicro base (CC-BY) · PLA+ and TPU · Python generators for the custom mounts"],
      ["github", "Collaboration", "Git and GitHub: firmware, dashboard, simulation and print files in one repository"],
    ];
    for (const [i, [ic, h, b]] of cards.entries()) {
      await card(s, 0.6 + (i % 3) * 4.08, 1.45 + Math.floor(i / 3) * 2.7, 3.86, 2.5, ic, h, b, { size: 15 });
    }
  }
  close("method");

  // ================================================================ 03 completion
  mark("complete");
  await divider("03 Completion and Integration", "03", "Completion and Integration",
    "What was delivered, how the parts work together, and evidence of stable operation, followed by the live demo", "check",
    "Criterion 3: completion, functionality and integration.");
  {
    const s = contentSlide("03 Completion and Integration", "Scope Delivered",
      "Four of six objectives are fully achieved. Sensing is complete except the ultrasonic wiring; walking on hardware is partly achieved: the legs move and the robot stands, but it cannot yet step.");
    stat(s, 0.6, 1.5, 3.0, "4 / 6", "objectives fully achieved", LEAF, 54);
    stat(s, 0.6, 3.2, 3.0, "2 / 6", "partly achieved, with a clear next step", AMBER, 54);
    table(s, [
      ["Objective", "Status", "Evidence"],
      ["Print and adapt the chassis; measure its geometry", ok("Achieved"), "35 parts printed; four custom parts; measured geometry"],
      ["Wireless sensing payload, robust to faults", part("Partly"), "Gas, dust, temperature live; ultrasonic wiring pending"],
      ["Camera streaming and gated classification", ok("Achieved"), "16–20 fps; gate rejects non-leaf frames"],
      ["Live dashboard with logging and tagging", ok("Achieved"), "Logged sessions; tagged captures with readings"],
      ["Verified kinematics; gait feasible in simulation", ok("Achieved"), "IK error < 10⁻⁷ m; full survey, no fall"],
      ["Walking on the physical robot", part("Partly"), "Legs actuate and it stands; no steps yet"],
    ], { x: 3.85, y: 1.45, w: 8.85, colW: [3.6, 1.25, 4.0], rowH: [0.5, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75], fontSize: 14 });
  }
  {
    const s = contentSlide("03 Completion and Integration", "The Assembled Robot",
      "The final assembly: sensor node and antenna on the printed top cover, the camera in the head, the payload on a USB power bank.");
    const b = fit(s, "photo_robot.jpg", 0.6, 1.4, 7.6, 5.3, { align: "left", valign: "top" });
    caption(s, "The assembled robot standing outdoors", b.x, b.y + b.h + 0.08, b.w);
    const items = [
      ["cubes", "35 printed parts", "SpotMicro base adapted for the payload; ~700 g PLA+ with TPU feet; ₹5,200 to print"],
      ["chip", "Sensor node on the top cover", "XIAO, breadboard and sensors, with the external antenna on a standoff"],
      ["camera", "Camera in the head", "ESP32-CAM looks out through the printed nose"],
      ["plug", "No battery on board", "Payload runs from a USB power bank beside the robot"],
    ];
    for (const [i, [ic, h, t]] of items.entries()) {
      const y = 1.45 + i * 1.32;
      await iconCircle(s, ic, 8.55, y, 0.58);
      s.addText(h, T({ x: 9.3, y: y - 0.02, w: 3.4, h: 0.42, fontSize: 17, bold: true, color: FOREST }));
      s.addText(t, T({ x: 9.3, y: y + 0.4, w: 3.4, h: 0.85, fontSize: 14.5 }));
    }
  }
  {
    const s = contentSlide("03 Completion and Integration", "Integrated Dashboard",
      "Show the dashboard live after this slide. Four sensor cards with bands, live video, one-click scanning, and every reading logged.");
    const b = fit(s, "dash_cards.jpg", 0.6, 1.4, 12.1, 2.4, { valign: "top" });
    caption(s, "Dashboard on 18 October 2026: live eCO₂, TVOC, dust and temperature from the sensor node", 0.6, b.y + b.h + 0.08, 12.1);
    const cards = [
      ["gauge", "Status bands", "TVOC 220 / 660 ppb (German UBA guideline); eCO₂ 1,000 / 2,000 ppm; node marked offline after 15 s of silence"],
      ["db", "Logging", "Every reading to a daily CSV; every scan saved as a tagged image with the readings at capture"],
      ["video", "Camera and diagnosis", "Live MJPEG video, one-click scan or image upload, top three classes with confidence"],
    ];
    for (const [i, [ic, h, t]] of cards.entries()) {
      await card(s, 0.6 + i * 4.08, 4.35, 3.86, 2.4, ic, h, t, { size: 15 });
    }
  }
  {
    const s = contentSlide("03 Completion and Integration", "Stable Operation over Wi-Fi",
      "A 17-minute session on 14 October with the gas sensor repeatedly exposed to VOC sources. Readings arrived every 5 s with no gaps, and recovered to baseline after each exposure.");
    const rows = fs.readFileSync(SESSION_CSV, "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split(","));
    const t0 = new Date(rows[0][0]).getTime();
    const labels = rows.map((r) => ((new Date(r[0]).getTime() - t0) / 60000).toFixed(1));
    const tvoc = rows.map((r) => Number(r[2]));
    s.addChart(pres.charts.LINE, [
      { name: "TVOC (ppb)", labels, values: tvoc },
      { name: "High band (660 ppb)", labels, values: tvoc.map(() => 660) },
      { name: "Moderate band (220 ppb)", labels, values: tvoc.map(() => 220) },
    ], Object.assign({}, chartText, {
      x: 0.6, y: 1.4, w: 7.9, h: 5.3, chartColors: [HEX.leaf, HEX.red, HEX.amber], lineSize: 2, lineDataSymbol: "none",
      showTitle: true, title: "TVOC logged from the sensor node, 14 October 2026",
      showLegend: true, legendPos: "b", catAxisTitle: "minutes", showCatAxisTitle: true, valAxisTitle: "ppb", showValAxisTitle: true,
      catAxisLabelFrequency: 24, catAxisLabelRotate: 0, valAxisMaxVal: 2000, objectName: "tvoc-session-chart",
    }));
    stat(s, 8.95, 1.45, 3.75, "321 + 199", "readings in two sessions (28 and 17 min), no records lost", LEAF, 38);
    stat(s, 8.95, 3.15, 3.75, "1,764 ppb", "TVOC peak during exposure, back to baseline within tens of seconds", RED, 38);
    stat(s, 8.95, 4.85, 3.75, "−26 to −60", "dBm Wi-Fi signal throughout, ample for 5 s telemetry", SKY, 38);
  }
  {
    const s = contentSlide("03 Completion and Integration", "Live Demonstration",
      "Run the demo in this order. Keep the uploaded-image route ready in case the camera network fails.");
    const steps = [
      ["chart", "Dashboard live", "Open http://192.168.137.1:5000; status pills show the sensor node, camera and classifier"],
      ["wind", "Breath test", "Breathe on the SGP30: eCO₂ and TVOC rise within seconds and recover"],
      ["thermo", "Touch test", "Hold the MCP9808: temperature climbs about 3–4 °C"],
      ["leaf", "Leaf scan", "Show a leaf to the camera, then an empty scene: diagnosis versus no leaf in view"],
      ["robot", "Simulation", "Run the MuJoCo survey: rows, turns, TVOC trail over the stressed patch"],
      ["walk", "Robot", "Power the servos: the robot stands and moves its legs"],
    ];
    for (const [i, [ic, h, t]] of steps.entries()) {
      const x = 0.6 + (i % 2) * 6.15, y = 1.45 + Math.floor(i / 2) * 1.8;
      panel(s, x, y, 5.95, 1.6, MIST);
      s.addText(String(i + 1), T({ x: x + 0.25, y: y + 0.2, w: 0.6, h: 0.7, fontSize: 34, bold: true, color: LIME, fontFace: THEME.headFontFace }));
      await iconCircle(s, ic, x + 0.85, y + 0.25, 0.55);
      s.addText(h, T({ x: x + 1.6, y: y + 0.2, w: 4.2, h: 0.45, fontSize: 18, bold: true, color: FOREST }));
      s.addText(t, T({ x: x + 1.6, y: y + 0.66, w: 4.2, h: 0.9, fontSize: 14.5 }));
    }
  }
  close("complete");

  // ================================================================ 04 results
  mark("results");
  await divider("04 Testing and Results", "04", "Testing and Results",
    "Test procedures and measured results on the hardware, then the simulation metrics and their interpretation", "chart",
    "Criterion 4: testing, validation and analysis of results.");
  {
    const s = contentSlide("04 Testing and Results", "Bench Validation of the Hardware",
      "Each test applies a known change and checks the response. These are measured on the physical hardware, not modelled.");
    table(s, [
      ["Test procedure", "Measured result", "What it shows"],
      ["Breathe on the SGP30", "eCO₂ 400 → 746 ppm, TVOC 0 → 210 ppb within 5 s; back to baseline", "Gas sensing responds and recovers"],
      ["Finger on the MCP9808", "31.5 → 35.0 °C in about 10 s", "Temperature tracks a real change"],
      ["PPD42 in room air", "0–5,065 particles / 0.01 ft³ per 30 s window", "Dust sensing live"],
      ["PPD42 unplugged", "Reported as absent instead of 1.1 million", "No false alarms from wiring faults"],
      ["Wi-Fi link of the XIAO", "−78 dBm with time-outs → −26 dBm with antenna", "Diagnostics found the fault"],
      ["Camera video", "≈0.5 → 16–20 fps after moving to MJPEG", "Live view usable for scanning"],
      ["Servos, robot on its back", "All four legs follow commanded angles", "Wiring and servo control work"],
      ["Servos, robot standing", "Holds a stance and shifts its legs, slowly", "Torque margin is thin, as predicted"],
    ], { x: 0.6, y: 1.4, w: 12.1, colW: [3.1, 5.4, 3.6], rowH: 0.585, fontSize: 14 });
  }
  {
    const s = contentSlide("04 Testing and Results", "Classifier Validation: The Gate Prevents False Diagnoses",
      "The key comparison is the classifier with and without the gate. Without it, an empty room was diagnosed as citrus greening at up to 90 %. The PlantVillage checks show the pipeline working; they are not a field-accuracy figure.");
    panel(s, 0.6, 1.45, 5.95, 2.6, MIST);
    s.addText("Without the gate", T({ x: 0.85, y: 1.6, w: 5.5, h: 0.4, fontSize: 16, bold: true, color: RED }));
    s.addText("82–90 %", T({ x: 0.85, y: 2.0, w: 5.5, h: 1.0, fontSize: 52, bold: true, color: RED, fontFace: THEME.headFontFace }));
    s.addText("confidence for “citrus greening” on a photo of an empty room", T({ x: 0.85, y: 3.05, w: 5.5, h: 0.8, fontSize: 15 }));
    panel(s, 6.75, 1.45, 5.95, 2.6, FOREST);
    s.addText("With the gate", T({ x: 7.0, y: 1.6, w: 5.5, h: 0.4, fontSize: 16, bold: true, color: LIME }));
    s.addText("Rejected", T({ x: 7.0, y: 2.0, w: 5.5, h: 1.0, fontSize: 52, bold: true, color: WHITE, fontFace: THEME.headFontFace }));
    s.addText("0–0.1 % leaf coverage measured: “no leaf in view”, no diagnosis shown", T({ x: 7.0, y: 3.05, w: 5.5, h: 0.8, fontSize: 15, color: MIST }));
    const st = [
      ["12 / 12", "PlantVillage leaves accepted by the gate (27–76 % coverage)", LEAF],
      ["8 / 10", "spot-check images classified correctly above 92 %; 1 uncertain, 1 wrong", LEAF],
      ["30–80 ms", "inference per image on the laptop CPU", SKY],
    ];
    st.forEach(([big, lab, col], i) => stat(s, 0.6 + i * 4.08, 4.45, 3.8, big, lab, col, 40));
  }
  {
    const s = contentSlide("04 Testing and Results", "Live Scans Outdoors with the Robot's Camera",
      "Three outdoor scans. Left: a hedge from a metre away is turned away; too little of the frame is leaf. Middle: a plant outside the training set gets a low-confidence label. Right: a photo of spotted leaves is flagged as diseased. Read labels as indications, not diagnoses.");
    const items = [
      ["diag_hedge.jpg", "Hedge at ~1 m: no leaf in view", "11 % coverage, so the model's 75.5 % “black rot” is withheld", AMBER],
      ["diag_plant.jpg", "Potted plant: low confidence", "60 % coverage; “healthy corn” at 53.4 %, just above the 50 % threshold", SKY],
      ["diag_spots.jpg", "Spotted leaves: flagged", "26 % coverage; “grape black rot” at 80.5 %, readings saved with the image", RED],
    ];
    items.forEach(([f, h, t, col], i) => {
      const x = 0.6 + i * 4.08;
      fit(s, f, x, 1.4, 3.86, 3.6, { valign: "top" });
      s.addText(h, T({ x, y: 5.15, w: 3.86, h: 0.45, fontSize: 17, bold: true, color: col }));
      s.addText(t, T({ x, y: 5.6, w: 3.86, h: 0.8, fontSize: 14.5 }));
    });
    s.addText("Washed-out camera colours put some real foliage near the 12 % threshold; holding the leaf close fixes it.",
      T({ x: 0.6, y: 6.45, w: 12.1, h: 0.35, fontSize: 13, italic: true, color: SAGE }));
  }
  {
    const s = contentSlide("04 Testing and Results", "Actuation Trials on the Physical Robot",
      "Play both clips. Left: on its back the legs move freely, which proves wiring, joint directions and control. Right: standing, it holds its own weight and shifts, but slowly and with strain, and does not step. This matches the torque analysis.");
    const b1 = video(s, "video1.mp4", 0.6, 1.4, 5.95, 3.35, { valign: "top" });
    const b2 = video(s, "video2.mp4", 6.75, 1.4, 5.95, 3.35, { valign: "top" });
    caption(s, "On its back: all four legs follow their commanded angles", b1.x, b1.y + b1.h + 0.08, b1.w);
    caption(s, "Standing: supports its weight and shifts its legs, but weakly", b2.x, b2.y + b2.h + 0.08, b2.w);
    panel(s, 0.6, 5.3, 5.95, 1.45, MIST);
    s.addText([{ text: "Why it is weak  ", options: { bold: true, color: RED, breakLine: true } },
      { text: "Stance knee torque is 36–52 % of a genuine MG996R's rating and rises when a leg lifts; copies deliver less, and a sagging supply cuts torque further." }],
    T({ x: 0.85, y: 5.4, w: 5.5, h: 1.3, fontSize: 14.5 }));
    panel(s, 6.75, 5.3, 5.95, 1.45, FOREST);
    s.addText([{ text: "Next step  ", options: { bold: true, color: LIME, breakLine: true } },
      { text: "Dedicated 6 V servo supply, CoM-centred footholds and straighter legs (a taller stance); stronger servos if the margin is still thin." }],
    T({ x: 7.0, y: 5.4, w: 5.5, h: 1.3, fontSize: 14.5, color: WHITE }));
  }
  {
    const s = contentSlide("04 Testing and Results", "Simulated Autonomous Field Survey",
      "The full survey ran without a fall. The TVOC peak sits 0.2 m from the true source because the SGP30 takes about 2.5 s to respond while the robot keeps walking: a real effect worth discussing.");
    const b = fit(s, "survey_map.jpg", 0.6, 1.4, 8.3, 4.6, { align: "left", valign: "top" });
    caption(s, "Route coloured by measured TVOC over the modelled VOC field; squares mark row ends detected by the front ultrasonic sensor", b.x, b.y + b.h + 0.08, b.w, 0.55);
    stat(s, 9.3, 1.45, 3.4, "16.7 m", "in 129 s: all three row gaps, no falls", LEAF, 40);
    stat(s, 9.3, 2.75, 3.4, "3 / 3", "row ends detected by the ultrasonic sensor", LEAF, 40);
    stat(s, 9.3, 4.05, 3.4, "≤ 2.7°", "body tilt; a servo at its limit 1.3 % of the time", SKY, 40);
    stat(s, 9.3, 5.35, 3.4, "535 ppb", "TVOC peak, 0.2 m from the source (sensor lag)", RED, 40);
  }
  {
    const s = contentSlide("04 Testing and Results", "Gait Stability and the Servo Speed Limit",
      "Two findings for the physical build. Without the centre-of-mass correction all 24 gait settings fell; with it, the trot is stable. Above 0.18 m/s the servos saturate and the robot falls at 0.22 m/s.");
    const labels = SWEEP.map((r) => r.v.toFixed(2));
    const achieved = SWEEP.map((r) => +(r.dx / r.t).toFixed(3));
    s.addChart(pres.charts.LINE, [
      { name: "Commanded", labels, values: SWEEP.map((r) => r.v) },
      { name: "Achieved", labels, values: achieved },
    ], Object.assign({}, chartText, {
      x: 0.6, y: 1.4, w: 4.6, h: 3.9, chartColors: [HEX.sage, HEX.leaf], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 6,
      showTitle: true, title: "Trot speed (m/s)", showLegend: true, legendPos: "b",
      catAxisTitle: "commanded speed (m/s)", showCatAxisTitle: true, valAxisMinVal: 0, valAxisMaxVal: 0.25, valAxisMajorUnit: 0.05,
      objectName: "speed-chart",
    }));
    s.addChart(pres.charts.BAR, [{ name: "Time at torque limit", labels, values: SWEEP.map((r) => Math.round(r.sat * 100)) }],
      Object.assign({}, chartText, {
        x: 5.35, y: 1.4, w: 4.6, h: 3.9, barDir: "col", barGapWidthPct: 45,
        chartColors: SWEEP.map((r) => (r.fallen ? HEX.red : r.v <= 0.18 ? HEX.leaf : HEX.amber)),
        showTitle: true, title: "Time a servo is at its torque limit (%)", showLegend: false,
        showValue: true, dataLabelPosition: "outEnd", dataLabelColor: HEX.ink, dataLabelFontSize: 11,
        catAxisTitle: "commanded speed (m/s)", showCatAxisTitle: true, valAxisMinVal: 0, valAxisMaxVal: 100,
        objectName: "saturation-chart",
      }));
    panel(s, 10.2, 1.4, 2.5, 3.9, FOREST);
    s.addText([{ text: "0.18 m/s", options: { bold: true, color: LIME, fontSize: 30, breakLine: true } },
      { text: "usable ceiling with MG996R servos; tracks the command within 7 % from 0.08 m/s up", options: { color: WHITE, fontSize: 14.5 } }],
    T({ x: 10.4, y: 1.6, w: 2.15, h: 3.5 }));
    panel(s, 0.6, 5.55, 12.1, 1.2, MIST);
    s.addText([{ text: "Centre of mass 12 mm aft  ", options: { bold: true, color: FOREST } },
      { text: "With footholds centred on the body, all 24 gait settings fell within 0.8–3.0 s. Centred on the measured centre of mass, the trot held tilt below 0.7°." }],
    T({ x: 0.85, y: 5.55, w: 11.6, h: 1.2, fontSize: 15.5, valign: "middle" }));
  }
  {
    const s = contentSlide("04 Testing and Results", "Outcome Against Review III Expectations",
      "Compare honestly with what was promised at Review III.");
    table(s, [
      ["Review III expectation", "Outcome", "Interpretation"],
      ["Onboard inference on a Jetson", "Inference on a laptop over Wi-Fi", "Cheaper and safer; depends on the network link"],
      ["Above 90 % disease accuracy (literature figure)", "Functional demonstration; field accuracy not measured", "Lab-trained models are expected to drop on field images"],
      ["Static torque margin is thin", "Confirmed in simulation (0.18 m/s ceiling) and on hardware", "Analysis, simulation and robot agree"],
      ["Walking robot with sensing", "Robot stands and moves its legs; walking shown in simulation", "Hardware walking is the next phase"],
      ["Environmental sensing payload", "Gas, dust, temperature live; ultrasonic firmware ready", "Sensing payload essentially complete"],
    ], { x: 0.6, y: 1.4, w: 12.1, colW: [3.6, 4.4, 4.1], rowH: [0.5, 0.85, 0.85, 0.85, 0.85, 0.85], fontSize: 15 });
  }
  close("results");

  // ================================================================ 05 innovation
  mark("innovation");
  await divider("05 Innovation and Relevance", "05", "Innovation and Relevance",
    "What is new, whether it is feasible and affordable, how it is used responsibly, and where it goes next", "bulb",
    "Criterion 5: innovation, technical merit and practical relevance.");
  {
    const s = contentSlide("05 Innovation and Relevance", "Contributions",
      "Four contributions, each backed by results shown earlier.");
    const cards = [
      ["robot", "Legged platform with a crop-sensing payload", "A printed 12-DOF quadruped carrying two Wi-Fi sensing nodes for gas, dust, temperature, range and video"],
      ["filter", "Vegetation gate for a closed-set classifier", "A simple, explainable leaf check that stops confident disease reports for frames without a plant"],
      ["flask", "Locomotion validated with real servo limits", "A MuJoCo model from measured geometry, torque capped at MG996R stall, completing an autonomous row survey"],
      ["bulb", "Design rules for printed quadrupeds", "Centre footholds on the measured centre of mass (12 mm aft); expect about 0.18 m/s from MG996R servos"],
    ];
    for (const [i, [ic, h, b]] of cards.entries()) {
      await card(s, 0.6 + (i % 2) * 6.15, 1.45 + Math.floor(i / 2) * 2.7, 5.95, 2.5, ic, h, b, { size: 16, headSize: 17.5 });
    }
  }
  {
    const s = contentSlide("05 Innovation and Relevance", "Cost and Feasibility",
      "Purchased and listed costs only; the XIAO, sensors and wiring were already available to the team. Research quadrupeds cost one to two orders of magnitude more, as reported in the surveyed papers.");
    const items = [
      ["Printed chassis, 35 parts", 5200], ["12 × MG996R servos (listed)", 3996], ["ESP32-CAM (OV3660)", 689],
      ["PCA9685 servo driver (listed)", 249], ["ESP32-CAM-MB adapter", 119],
    ];
    s.addChart(pres.charts.BAR, [{ name: "Cost (₹)", labels: items.map((r) => r[0]), values: items.map((r) => r[1]) }],
      Object.assign({}, chartText, {
        x: 0.6, y: 1.4, w: 7.2, h: 4.2, barDir: "bar", chartColors: [HEX.leaf], barGapWidthPct: 40,
        showTitle: true, title: "Purchased and listed component costs (₹)", showLegend: false,
        showValue: true, dataLabelPosition: "outEnd", dataLabelColor: HEX.ink, dataLabelFontSize: 12, dataLabelFormatCode: "#,##0",
        catAxisLabelFontSize: 13, valAxisHidden: true, valGridLine: { style: "none" }, catAxisOrientation: "maxMin",
        objectName: "cost-chart",
      }));
    panel(s, 8.1, 1.4, 4.6, 2.05, FOREST);
    s.addText([{ text: "≈ ₹10,250", options: { bold: true, color: LIME, fontSize: 40, breakLine: true } },
      { text: "total purchased and listed cost of the platform", options: { color: WHITE, fontSize: 15 } }],
    T({ x: 8.35, y: 1.55, w: 4.2, h: 1.8 }));
    s.addText("Reported cost of research quadrupeds", T({ x: 8.1, y: 3.7, w: 4.6, h: 0.4, fontSize: 15, bold: true, color: FOREST }));
    table(s, [
      ["Platform", "Reported cost"],
      ["Stanford Doggo [2]", "< US$3,000"],
      ["MIT Cheetah 3 [1]", "~US$50,000+"],
      ["ANYmal [4]", "US$100,000+"],
    ], { x: 8.1, y: 4.15, w: 4.6, colW: [2.6, 2.0], rowH: 0.42, fontSize: 14 });
    s.addText("The XIAO, sensors, resistors and cables were already available to the team and are not costed.",
      T({ x: 0.6, y: 5.85, w: 7.2, h: 0.6, fontSize: 13, italic: true, color: SAGE }));
  }
  {
    const s = contentSlide("05 Innovation and Relevance", "Ethical and Responsible Use",
      "The panel rubric asks for ethical responsibility. These are the concrete design choices that address it.");
    const cards = [
      ["lock", "Data stays local", "All readings and images stay on the laptop's own hotspot; no cloud service, no personal data, camera aimed at crops"],
      ["steth", "No false certainty", "Gate and 50 % threshold suppress unreliable labels; results are indications for an agronomist, not a spray decision"],
      ["shield", "Electrical and physical safety", "Low-voltage USB payload, no LiPo on board, slow-moving robot, separate servo supply"],
      ["scale", "Honest sensor claims", "eCO₂ is estimated and the dust sensor uncalibrated; used for trends and alerts, not regulatory values"],
      ["book", "Open source and attribution", "SpotMicro design credited under CC-BY; our code and print files are public"],
      ["heart", "Built for small farms", "Low-cost parts and no internet needed, so the approach is within reach of smallholders"],
    ];
    for (const [i, [ic, h, b]] of cards.entries()) {
      await card(s, 0.6 + (i % 3) * 4.08, 1.45 + Math.floor(i / 3) * 2.7, 3.86, 2.5, ic, h, b, { size: 14.5, headSize: 17 });
    }
  }
  {
    const s = contentSlide("05 Innovation and Relevance", "Practical Applicability",
      "Who would use it and how. The system needs only a laptop and its hotspot, so it works in a field with no internet.");
    const uses = [
      ["route", "Row-by-row scouting", "Walk the rows, log gas, dust and temperature, and scan suspicious leaves on the way"],
      ["map", "Early-warning hotspots", "Rising VOC readings along a row point to stressed plants before symptoms spread"],
      ["seedling", "Nurseries and greenhouses", "Repeated inspection of seedlings in narrow aisles where wheels struggle"],
      ["db", "Records for agronomists", "Tagged images with the conditions at capture give an evidence trail for advice"],
    ];
    for (const [i, [ic, h, t]] of uses.entries()) {
      const y = 1.45 + i * 1.32;
      await iconCircle(s, ic, 0.6, y, 0.66);
      s.addText(h, T({ x: 1.5, y: y - 0.02, w: 5.6, h: 0.45, fontSize: 18, bold: true, color: FOREST }));
      s.addText(t, T({ x: 1.5, y: y + 0.45, w: 5.6, h: 0.75, fontSize: 15 }));
    }
    panel(s, 7.55, 1.45, 5.15, 5.3, FOREST);
    s.addText("What a farm needs to run it", T({ x: 7.85, y: 1.7, w: 4.6, h: 0.5, fontSize: 19, bold: true, color: LIME }));
    s.addText([
      { text: "A laptop with Wi-Fi hotspot", options: { bullet: { indent: 18 }, breakLine: true } },
      { text: "The robot with its two nodes", options: { bullet: { indent: 18 }, breakLine: true } },
      { text: "A USB power bank", options: { bullet: { indent: 18 }, breakLine: true } },
      { text: "Any phone to view the dashboard", options: { bullet: { indent: 18 }, breakLine: true } },
      { text: "No internet, no cloud account", options: { bullet: { indent: 18 } } },
    ], T({ x: 7.85, y: 2.35, w: 4.6, h: 3.0, fontSize: 17, color: WHITE, paraSpaceAfter: 10 }));
    s.addText([{ text: "Dashboard address  ", options: { bold: true, color: LIME, breakLine: true } }, { text: "http://192.168.137.1:5000" }],
      T({ x: 7.85, y: 5.55, w: 4.6, h: 0.9, fontSize: 16, color: WHITE }));
  }
  {
    const s = contentSlide("05 Innovation and Relevance", "Limitations",
      "State these before the panel asks.");
    table(s, [
      ["Limitation", "Effect", "How it is handled"],
      ["Real servos lack torque reserve", "Robot stands and moves its legs but does not step", "Dedicated supply, CoM footholds, taller stance, stronger servos"],
      ["Classifier trained on lab photos, 14 crops", "Lower accuracy on field images; any plant passes the gate", "Gate and 50 % threshold; fine-tuning on field images"],
      ["Washed-out ESP32-CAM colours", "Some real foliage falls below the 12 % threshold", "Hold the leaf close; tune the threshold to this camera"],
      ["eCO₂ estimated; PPD42 uncalibrated", "Relative readings, not regulatory values", "Used for trends and alerts"],
      ["Simulated fields are modelled", "Simulation shows the method, not field data", "Hardware sensors validated on the bench"],
    ], { x: 0.6, y: 1.4, w: 12.1, colW: [3.7, 4.1, 4.3], rowH: [0.5, 0.85, 0.85, 0.85, 0.85, 0.85], fontSize: 15 });
  }
  {
    const s = contentSlide("05 Innovation and Relevance", "Future Work",
      "Ordered by what unlocks the most: walking on hardware first, then a complete sensor set, then acting on readings.");
    const steps = [
      ["walk", "Walking on hardware", "Dedicated 6 V servo supply; measure torque and voltage under load; CoM footholds and a taller stance; step in place, then walk below 0.18 m/s"],
      ["wind", "Complete the sensor set", "Wire both ultrasonic sensors; add a soil-moisture probe; calibrate gas and dust against reference instruments"],
      ["plug", "Act on measurements", "Grove relay to switch an irrigation pump or raise a gas alarm from the dashboard"],
      ["brain", "Field-ready classification", "Fine-tune on images from the robot's camera; replace the colour gate with a learned open-set detector"],
      ["map", "Mapping and autonomy", "Compensate for the SGP30's lag; log positions to build field maps; battery for untethered runs"],
    ];
    for (const [i, [ic, h, t]] of steps.entries()) {
      const y = 1.4 + i * 1.07;
      panel(s, 0.6, y, 12.1, 0.92, i % 2 ? WHITE : MIST);
      s.addText(String(i + 1).padStart(2, "0"), T({ x: 0.85, y, w: 0.8, h: 0.92, fontSize: 26, bold: true, color: LIME, fontFace: THEME.headFontFace, valign: "middle" }));
      await iconCircle(s, ic, 1.7, y + 0.18, 0.56);
      s.addText(h, T({ x: 2.5, y, w: 3.3, h: 0.92, fontSize: 18, bold: true, color: FOREST, valign: "middle" }));
      s.addText(t, T({ x: 5.85, y, w: 6.7, h: 0.92, fontSize: 15, valign: "middle" }));
    }
  }
  close("innovation");

  // ================================================================ 06 close
  mark("close");
  pres.addSection({ title: "06 Conclusion" });
  {
    const s = contentSlide("06 Conclusion", "Conclusion",
      "Close on what was demonstrated, then move to questions.");
    const pts = [
      ["check", "Sensing works end to end", "Two wireless nodes, a live dashboard with logging, and leaf-disease classification that refuses to guess without a leaf"],
      ["robot", "Locomotion validated in physics", "A full autonomous row survey without a fall, with servos capped at their real torque"],
      ["walk", "The printed robot moves", "All twelve servos drive the legs and it stands, with too little torque reserve to step, as predicted"],
      ["bulb", "Design rules for the next build", "Centre footholds on the centre of mass; expect about 0.18 m/s from MG996R servos"],
    ];
    for (const [i, [ic, h, t]] of pts.entries()) {
      const y = 1.45 + i * 1.18;
      await iconCircle(s, ic, 0.6, y, 0.66);
      s.addText(h, T({ x: 1.5, y: y - 0.02, w: 11, h: 0.45, fontSize: 19, bold: true, color: FOREST }));
      s.addText(t, T({ x: 1.5, y: y + 0.45, w: 11, h: 0.6, fontSize: 16 }));
    }
    panel(s, 0.6, 6.1, 12.1, 0.72, MIST);
    s.addText([{ text: "Repository  ", options: { bold: true, color: FOREST } },
      { text: "github.com/AdithyaSM31/Precision-Agriculture-Monitoring-Quadruped-Robot-Dog", options: { color: SKY } }],
    T({ x: 0.85, y: 6.1, w: 11.6, h: 0.72, fontSize: 16, valign: "middle" }));
  }
  {
    const surname = (a) => a.split(/[ ,]/)[0].normalize("NFD").replace(/[̀-ͯ]/g, "");
    const strip = (r) => r.replace(/^\[\d+\]\s*/, "");
    const refs = LIT.lit.map((row, i) => {
      const hit = LIT.refs.find((r) => surname(strip(r)) === surname(row[1]));
      if (!hit) throw new Error("no reference for " + row[1]);
      return `[${i + 1}] ${strip(hit)}`;
    });
    const extra = [
      "S. Savary et al. (2019). The global burden of pathogens and pests on major food crops. Nature Ecology & Evolution, 3(3), 430–439.",
      "D. P. Hughes and M. Salathé (2015). An open access repository of images on plant health to enable the development of mobile disease diagnostics. arXiv:1511.08060.",
      "M. Sandler et al. (2018). MobileNetV2: Inverted residuals and linear bottlenecks. Proc. IEEE/CVF CVPR, 4510–4520.",
      "E. Todorov, T. Erez and Y. Tassa (2012). MuJoCo: A physics engine for model-based control. Proc. IEEE/RSJ IROS, 5026–5033.",
      "D. M. Woebbecke et al. (1995). Color indices for weed identification under various soil, residue, and lighting conditions. Trans. ASAE, 38(1), 259–269.",
      "KDY0523 (2018). SpotMicro – robot dog. Thingiverse 3445283, CC-BY.",
    ].map((r, i) => `[${refs.length + i + 1}] ${r}`);
    const all = refs.concat(extra);
    const s = contentSlide("06 Conclusion", "References", "");
    const half = Math.ceil(all.length / 2);
    [all.slice(0, half), all.slice(half)].forEach((col, c) => {
      s.addText(col.map((r, i) => ({ text: r, options: { breakLine: i < col.length - 1 } })),
        T({ x: 0.6 + c * 6.15, y: 1.3, w: 5.95, h: 5.6, fontSize: 10.5, paraSpaceAfter: 4 }));
    });
  }
  {
    const s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "06 Conclusion" });
    s.addImage({ path: path.join(IMG, "photo_robot.jpg"), x: 7.35, y: 0, w: 5.983, h: 7.5,
      sizing: { type: "cover", w: 5.983, h: 7.5 }, objectName: "closing-photo", altText: "The assembled robot" });
    s.addText("Thank you", T({ x: 0.7, y: 2.2, w: 6.4, h: 1.3, fontSize: 60, bold: true, color: WHITE, fontFace: THEME.headFontFace }));
    s.addText("Questions and live demonstration", T({ x: 0.7, y: 3.55, w: 6.4, h: 0.6, fontSize: 22, color: LIME }));
    s.addText([
      { text: "Adithya Sankar Menon  ·  Siddhesh Pushkraj Shinde  ·  Rachit Gupta", options: { breakLine: true } },
      { text: "Guide: Dr. Lakshmanan K" },
    ], T({ x: 0.7, y: 5.4, w: 6.4, h: 0.9, fontSize: 15, color: MIST, lineSpacingMultiple: 1.2 }));
    s.addNotes(NOTES.__thanks);
  }
  close("close");

  // ================================================================ appendix: full literature table
  pres.addSection({ title: "Backup" });
  for (let i = 0; i < LIT.lit.length; i += 6) {
    const chunk = LIT.lit.slice(i, i + 6);
    const s = contentSlide("Backup", `Backup: Literature Review, Papers ${i + 1}–${i + chunk.length}`,
      i === 0 ? "Backup slides: the full 18-paper survey from Review III, for questions on prior work." : "");
    table(s, [["#", "Authors and year", "Title", "Key contribution", "Research gap"], ...chunk.map((r) => [r[0], r[1], r[2], r[4], r[5]])],
      { x: 0.6, y: 1.35, w: 12.1, colW: [0.45, 1.75, 2.9, 3.5, 3.5], rowH: [0.38, ...chunk.map(() => 0.84)], fontSize: 11, valign: "top", margin: [4, 6, 4, 6] });
  }

  // ---------------------------------------------------------------- agenda body
  for (const [i, [key, ic, head, body]] of AGENDA.entries()) {
    const y = 1.4 + i * 0.9;
    const [a, b] = agendaRanges[key];
    panel(agenda, 0.6, y, 12.1, 0.78, i % 2 ? WHITE : MIST);
    agenda.addText(String(i + 1).padStart(2, "0"), T({ x: 0.8, y, w: 0.7, h: 0.78, fontSize: 24, bold: true, color: LIME, fontFace: THEME.headFontFace, valign: "middle" }));
    await iconCircle(agenda, ic, 1.55, y + 0.12, 0.54);
    agenda.addText(head, T({ x: 2.3, y, w: 3.6, h: 0.78, fontSize: 18, bold: true, color: FOREST, valign: "middle" }));
    agenda.addText(body, T({ x: 5.95, y, w: 5.4, h: 0.78, fontSize: 14.5, valign: "middle" }));
    agenda.addText(`Slides ${a}–${b}`, T({ x: 11.3, y, w: 1.25, h: 0.78, fontSize: 13, color: SAGE, align: "right", valign: "middle" }));
  }

  await pres.writeFile({ fileName: OUT });
  if (APPLY_THEME) await require(APPLY_THEME).applyTheme(OUT, THEME);
  console.log("wrote", OUT, `(${pres.slides.length} slides)`);
}

build().catch((e) => { console.error(e); process.exit(1); });
