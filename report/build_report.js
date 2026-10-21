// Builds the BCSE497J project report (.docx) to the school template's specification:
// A4; margins L 3.81 cm, R/T/B 2.54 cm; Times New Roman 12 pt, 1.5 line spacing;
// chapter heading 16 pt bold; section 14 pt caps; subsection 12 pt caps; page numbers
// bottom centre (roman for front matter, arabic from Chapter 1); APA references.
//   NODE_PATH=<dir with docx> node build_report.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  BorderStyle, TabStopType, VerticalAlign, Footer, PageNumber, NumberFormat, LevelFormat, PageBreak,
  HeadingLevel, ShadingType, UnderlineType,
} = require("docx");

const REFS = require("./refs");
const FRONT = require("./content/front");
const CHAPTERS = [
  ...require("./content/ch1_2"), ...require("./content/ch3_4"), ...require("./content/ch5_6"),
  ...require("./content/ch7"), ...require("./content/ch8_9"),
];
const APPENDICES = require("./content/appendices");

const FIG = path.join(__dirname, "figures");
const ASSETS = path.join(__dirname, "assets");
const OUT = path.join(__dirname, "Project_Report_Adithya_Sankar_Menon_23BRS1079.docx");
const FONT = "Times New Roman";
const MONO = "Courier New";
const TEXT_W = 11906 - 2160 - 1440; // 8306 DXA (5.77 in)
const PX_PER_IN = 96;

// ------------------------------------------------------------------ pass 1: number chapters, sections, figures, tables, equations
const labels = new Proxy({}, { set(t, k, v) { if (k in t) throw new Error("duplicate label " + k); t[k] = v; return true; } });
let chap = 0, sec = 0, sub = 0, figN = 0, tabN = 0, eqN = 0;
for (const b of CHAPTERS) {
  if (b.t === "chapter") { chap++; sec = sub = figN = tabN = eqN = 0; b.num = chap; }
  else if (b.t === "h2") { sec++; sub = 0; b.num = `${chap}.${sec}`; }
  else if (b.t === "h3") { sub++; b.num = `${chap}.${sec}.${sub}`; }
  else if (b.t === "fig") { b.num = `${chap}.${++figN}`; if (b.label) labels[b.label] = `Figure ${b.num}`; }
  else if (b.t === "table") { b.num = `${chap}.${++tabN}`; if (b.label) labels[b.label] = `Table ${b.num}`; }
  else if (b.t === "eq") { b.num = `${chap}.${++eqN}`; if (b.label) labels[b.label] = `(${b.num})`; }
  if (b.label && (b.t === "h2" || b.t === "h3")) labels[b.label] = `Section ${b.num}`;
}
let appN = 0, appFig = 0, appTab = 0;
for (const b of APPENDICES) {
  if (b.t === "appendix") { appN++; b.num = appN; appFig = appTab = 0; }
  else if (b.t === "fig") { b.num = `A${appN}.${++appFig}`; if (b.label) labels[b.label] = `Figure ${b.num}`; }
  else if (b.t === "table") { b.num = `A${appN}.${++appTab}`; if (b.label) labels[b.label] = `Table ${b.num}`; }
  if (b.label && b.t === "appendix") labels[b.label] = `Appendix ${appN}`;
}

// ------------------------------------------------------------------ inline markup
const cited = new Set();
function expand(text) {
  return text
    .replace(/\{c:([^}]+)\}/g, (_, keys) => "(" + keys.split(";").map((k) => {
      k = k.trim(); if (!REFS[k]) throw new Error("unknown ref " + k); cited.add(k); return REFS[k].cite;
    }).join("; ") + ")")
    .replace(/\{cn:([^}]+)\}/g, (_, k) => {
      k = k.trim(); if (!REFS[k]) throw new Error("unknown ref " + k); cited.add(k);
      const c = REFS[k].cite; const i = c.lastIndexOf(", "); return `${c.slice(0, i)} (${c.slice(i + 2)})`;
    })
    .replace(/\{(fig|tab|eq|sec|app):([^}]+)\}/g, (_, kind, l) => {
      if (!labels[l]) throw new Error(`unknown ${kind} label ${l}`); return labels[l];
    });
}
function runs(text, base = {}) {
  text = expand(text);
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|~[^~\s][^~]*~|\^[^^\s][^^]*\^|`[^`]+`)/g;
  let last = 0, m;
  const push = (t, o = {}) => t && out.push(new TextRun(Object.assign({ text: t, font: FONT, size: 24 }, base, o)));
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) push(tok.slice(2, -2), { bold: true });
    else if (tok.startsWith("*")) push(tok.slice(1, -1), { italics: true });
    else if (tok.startsWith("~")) push(tok.slice(1, -1), { subScript: true });
    else if (tok.startsWith("^")) push(tok.slice(1, -1), { superScript: true });
    else push(tok.slice(1, -1), { font: MONO, size: (base.size || 24) - 2 });
    last = m.index + tok.length;
  }
  push(text.slice(last));
  return out;
}

const BODY = { alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, after: 120 } };
const para = (text, o = {}) => new Paragraph(Object.assign({}, BODY, {
  children: runs(text, o.run), indent: o.noIndent ? undefined : { firstLine: 720 },
}, o.extra || {}));

function figure(b) {
  const file = path.join(FIG, b.file);
  const buf = fs.readFileSync(file);
  const { w, h } = imageSize(buf);
  const widthIn = Math.min(b.width || 5.6, 5.75);
  let px = Math.round(widthIn * PX_PER_IN), py = Math.round(px * h / w);
  const maxH = (b.maxH || 7.2) * PX_PER_IN;
  if (py > maxH) { py = Math.round(maxH); px = Math.round(py * w / h); }
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true, children: [
      new ImageRun({ type: file.endsWith(".png") ? "png" : "jpg", data: buf, transformation: { width: px, height: py },
        altText: { title: `Figure ${b.num}`, description: b.caption, name: b.file } })] }),
    new Paragraph({ style: "FigureCaption", children: runs(`Figure ${b.num}: ${b.caption}`, { size: 22 }) }),
  ];
}

function imageSize(buf) {
  if (buf[0] === 0x89) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error("cannot size image");
}

const line = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
function table(b) {
  const total = b.widths.reduce((a, c) => a + c, 0);
  const cols = b.widths.map((w) => Math.round(w / total * TEXT_W));
  const width = cols.reduce((a, c) => a + c, 0);
  return [
    new Paragraph({ style: "TableCaption", keepNext: true, children: runs(`Table ${b.num}: ${b.caption}`, { size: 22 }) }),
    new Table({
      width: { size: width, type: WidthType.DXA }, columnWidths: cols,
      rows: b.rows.map((r, ri) => new TableRow({ cantSplit: true, tableHeader: ri === 0, children: r.map((c, ci) => new TableCell({
        width: { size: cols[ci], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
        margins: { top: 50, bottom: 50, left: 100, right: 100 },
        shading: ri === 0 ? { fill: "E8E8E8", type: ShadingType.CLEAR, color: "auto" } : undefined,
        borders: { top: line, bottom: line, left: line, right: line },
        children: [new Paragraph({ alignment: b.align?.[ci] === "c" ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { line: 260 }, children: runs(c, { size: 22, bold: ri === 0 }) })],
      })) })),
    }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ];
}

function equation(b) {
  return new Paragraph({
    tabStops: [{ type: TabStopType.CENTER, position: Math.round(TEXT_W / 2) }, { type: TabStopType.RIGHT, position: TEXT_W }],
    spacing: { before: 120, after: 120, line: 360 }, keepLines: true,
    children: [new TextRun({ text: "\t", font: FONT, size: 24 }), ...runs(b.text), new TextRun({ text: `\t(${b.num})`, font: FONT, size: 24 })],
  });
}

function code(b) {
  const out = [];
  if (b.caption) out.push(new Paragraph({ style: "ListingCaption", keepNext: true, children: runs(b.caption, { size: 22 }) }));
  b.lines.forEach((l, i) => out.push(new Paragraph({
    spacing: { line: 240, before: i === 0 ? 60 : 0, after: i === b.lines.length - 1 ? 180 : 0 },
    shading: { fill: "F3F3F3", type: ShadingType.CLEAR, color: "auto" }, keepLines: true,
    indent: { left: 200 },
    children: [new TextRun({ text: l.length ? l : " ", font: MONO, size: 19 })],
  })));
  return out;
}

const bulletList = (items, ref = "bullets") => items.map((t) => new Paragraph({
  numbering: { reference: ref, level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, after: 60 }, children: runs(t),
}));
let listId = 0;
const numberedList = (items) => { const ref = `num${listId++}`; numberingConfigs.push(numCfg(ref)); return bulletList(items, ref); };
const numberingConfigs = [{
  reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
}];
function numCfg(ref) {
  return { reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] };
}

function render(blocks) {
  const out = [];
  for (const b of blocks) {
    switch (b.t) {
      case "chapter":
        out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, alignment: AlignmentType.CENTER,
          spacing: { after: 360 }, children: [
            new TextRun({ text: `Chapter ${b.num}`, font: FONT, size: 24, bold: true }),
            new TextRun({ text: b.title, font: FONT, size: 32, bold: true, break: 1 })] }));
        break;
      case "appendix":
        out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, alignment: AlignmentType.CENTER,
          spacing: { after: 360 }, children: [
            new TextRun({ text: `Appendix ${b.num}`, font: FONT, size: 24, bold: true }),
            new TextRun({ text: b.title, font: FONT, size: 32, bold: true, break: 1 })] }));
        break;
      case "unnumbered":
        out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, alignment: AlignmentType.CENTER,
          spacing: { after: 360 }, children: [new TextRun({ text: b.title, font: FONT, size: 32, bold: true, allCaps: !!b.caps })] }));
        break;
      case "h2":
        out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 240, after: 120, line: 360 },
          children: [new TextRun({ text: `${b.num}\t${b.text}`, font: FONT, size: 28, allCaps: true })],
          tabStops: [{ type: TabStopType.LEFT, position: 720 }] }));
        break;
      case "h3":
        out.push(new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, spacing: { before: 180, after: 100, line: 360 },
          children: [new TextRun({ text: `${b.num}\t${b.text}`, font: FONT, size: 24, allCaps: true })],
          tabStops: [{ type: TabStopType.LEFT, position: 720 }] }));
        break;
      case "p": out.push(para(b.text, b)); break;
      case "pn": out.push(para(b.text, { noIndent: true })); break;
      case "bullets": out.push(...bulletList(b.items)); break;
      case "numbered": out.push(...numberedList(b.items)); break;
      case "fig": out.push(...figure(b)); break;
      case "table": out.push(...table(b)); break;
      case "eq": out.push(equation(b)); break;
      case "code": out.push(...code(b)); break;
      case "pagebreak": out.push(new Paragraph({ children: [new PageBreak()] })); break;
      default: throw new Error("unknown block " + b.t);
    }
  }
  return out;
}

// ------------------------------------------------------------------ front matter
const center = (text, size, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: o.after ?? 120, before: o.before ?? 0, line: o.line ?? 276 },
  children: [new TextRun(Object.assign({ text, font: FONT, size }, o.run || {}))] });
const logo = (w = 2.9) => {
  const buf = fs.readFileSync(path.join(ASSETS, "tpl_image2.jpg"));
  const { w: iw, h: ih } = imageSize(buf);
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 120 }, children: [
    new ImageRun({ type: "jpg", data: buf, transformation: { width: Math.round(w * 96), height: Math.round(w * 96 * ih / iw) },
      altText: { title: "VIT logo", description: "Vellore Institute of Technology, Chennai", name: "vit_logo" } })] });
};

function titlePage(withPreamble) {
  const f = FRONT;
  const out = [];
  if (withPreamble) out.push(center("A project report on", 24, { run: { italics: true }, after: 240 }));
  else out.push(center("", 24, { after: 240 }));
  out.push(center(f.title.toUpperCase(), 40, { run: { bold: true }, after: 300, line: 300 }));
  out.push(center("Submitted in partial fulfillment for the award of the degree of", 28, { run: { italics: true }, after: 240 }));
  out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360, line: 300 }, children: [
    new TextRun({ text: "Bachelor of Technology in ", font: FONT, size: 44, bold: true }),
    new TextRun({ text: f.programme, font: FONT, size: 44, bold: true })] }));
  out.push(center("by", 28, { run: { italics: true }, after: 240 }));
  f.members.forEach((m) => out.push(center(`${m.name} (${m.reg})`.toUpperCase(), 32, { run: { bold: true }, after: 80 })));
  out.push(logo());
  out.push(center("SCHOOL OF COMPUTER SCIENCE AND ENGINEERING", 32, { run: { bold: true }, after: 160 }));
  out.push(center(f.date, 24, { after: 0 }));
  return out;
}

function declaration() {
  const f = FRONT, me = f.members[0];
  return [
    logo(2.6),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 480 }, children: [
      new TextRun({ text: "DECLARATION", font: FONT, size: 28, bold: true, underline: { type: UnderlineType.SINGLE } })] }),
    new Paragraph(Object.assign({}, BODY, { indent: { firstLine: 720 }, spacing: { line: 360, after: 240 }, children: [
      new TextRun({ text: `I hereby declare that the thesis entitled “${f.title}” submitted by ${me.name} (${me.reg}), for the award of the degree of Bachelor of Technology in ${f.programme}, Vellore Institute of Technology, Chennai is a record of bonafide work carried out by me under the supervision of ${f.guide}.`, font: FONT, size: 24 })] })),
    new Paragraph(Object.assign({}, BODY, { indent: { firstLine: 720 }, spacing: { line: 360, after: 1200 }, children: [
      new TextRun({ text: "I further declare that the work reported in this thesis has not been submitted and will not be submitted, either in part or in full, for the award of any other degree or diploma in this institute or any other institute or university.", font: FONT, size: 24 })] })),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: "Place: Chennai", font: FONT, size: 24 })] }),
    new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: TEXT_W }], children: [
      new TextRun({ text: "Date:", font: FONT, size: 24 }), new TextRun({ text: "\tSignature of the Candidate", font: FONT, size: 24, bold: true })] }),
  ];
}

function certificate() {
  const f = FRONT, me = f.members[0];
  const p = (text, o = {}) => new Paragraph({ spacing: { after: o.after ?? 120, line: 300 }, alignment: o.align, tabStops: o.tabs,
    children: Array.isArray(text) ? text : [new TextRun({ text, font: FONT, size: 24, bold: o.bold })] });
  const tabs = [{ type: TabStopType.LEFT, position: 4800 }];
  return [
    logo(2.6),
    center("School of Computer Science and Engineering", 28, { run: { bold: true }, before: 120, after: 240 }),
    center("CERTIFICATE", 28, { after: 360 }),
    new Paragraph(Object.assign({}, BODY, { indent: { firstLine: 720 }, spacing: { line: 300, after: 480 }, children: [
      new TextRun({ text: `This is to certify that the report entitled “${f.title}” is prepared and submitted by ${me.name} (${me.reg}) to Vellore Institute of Technology, Chennai, in partial fulfillment of the requirement for the award of the degree of `, font: FONT, size: 24 }),
      new TextRun({ text: `Bachelor of Technology in ${f.programme}`, font: FONT, size: 24, bold: true }),
      new TextRun({ text: " is a bonafide record carried out under my guidance. The project fulfills the requirements as per the regulations of this University and in my opinion meets the necessary standards for submission. The contents of this report have not been submitted and will not be submitted either in part or in full, for the award of any other degree or diploma and the same is certified.", font: FONT, size: 24 })] })),
    p("Signature of the Guide:", { after: 240 }),
    p(`Name: ${f.guide}`, { after: 240 }),
    p("Date:", { after: 600 }),
    p([new TextRun({ text: "Signature of the Examiner", font: FONT, size: 24 }), new TextRun({ text: "\tSignature of the Examiner", font: FONT, size: 24 })], { tabs, after: 200 }),
    p([new TextRun({ text: "Name:", font: FONT, size: 24 }), new TextRun({ text: "\tName:", font: FONT, size: 24 })], { tabs, after: 200 }),
    p([new TextRun({ text: "Date:", font: FONT, size: 24 }), new TextRun({ text: "\tDate:", font: FONT, size: 24 })], { tabs, after: 600 }),
    center("Approved by the Head of Department,", 24, { after: 60 }),
    center(`B.Tech. ${f.programme}`, 24, { run: { bold: true }, after: 240 }),
    center(`Name: ${f.hod}`, 24, { after: 120 }),
    center("Date:", 24, { after: 480 }),
    center("(Seal of the School of Computer Science and Engineering)", 22, { run: { italics: true }, after: 0 }),
  ];
}

function frontHeading(text) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [
    new TextRun({ text, font: FONT, size: 28, bold: true, underline: { type: UnderlineType.SINGLE } })] });
}

function abstractPage() {
  return [frontHeading("ABSTRACT"), ...FRONT.abstract.map((t) => para(t))];
}

function acknowledgement() {
  const f = FRONT;
  const p = (t) => new Paragraph(Object.assign({}, BODY, { indent: { firstLine: 720 }, children: [new TextRun({ text: t, font: FONT, size: 24 })] }));
  return [
    frontHeading("ACKNOWLEDGEMENT"),
    ...f.acknowledgement.map(p),
    new Paragraph({ spacing: { before: 360, after: 120 }, children: [new TextRun({ text: "Place: Chennai", font: FONT, size: 24 })] }),
    new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: TEXT_W }], children: [
      new TextRun({ text: "Date:", font: FONT, size: 24 }), new TextRun({ text: `\t${f.members[0].name}`, font: FONT, size: 24, bold: true })] }),
  ];
}

const placeholder = (heading, marker) => [
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [
    new TextRun({ text: heading, font: FONT, size: 28, bold: true })] }),
  new Paragraph({ children: [new TextRun({ text: marker, font: FONT, size: 24 })] }),
];

function acronyms() {
  return [
    new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [
      new TextRun({ text: "LIST OF ACRONYMS", font: FONT, size: 28, bold: true })] }),
    ...FRONT.acronyms.map(([a, d]) => new Paragraph({ tabStops: [{ type: TabStopType.LEFT, position: 1800 }], spacing: { after: 60, line: 300 },
      children: [new TextRun({ text: a, font: FONT, size: 24, bold: true }), new TextRun({ text: `\t${d}`, font: FONT, size: 24 })] })),
  ];
}

function references() {
  const keys = [...cited].sort((a, b) => REFS[a].apa.localeCompare(REFS[b].apa));
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { after: 360 },
      children: [new TextRun({ text: "REFERENCES", font: FONT, size: 32, bold: true })] }),
    ...keys.map((k, i) => new Paragraph({ alignment: AlignmentType.LEFT, indent: { left: 720, hanging: 720 }, spacing: { after: 160, line: 300 },
      tabStops: [{ type: TabStopType.LEFT, position: 720 }], children: runs(`[${i + 1}]\t${REFS[k].apa}`) })),
  ];
}

// ------------------------------------------------------------------ assemble
const chapterBody = render(CHAPTERS);
const appendixBody = render(APPENDICES);
const refBody = references();
const unused = Object.keys(REFS).filter((k) => !cited.has(k));
if (unused.length) console.warn("uncited references (left out of the list):", unused.join(", "));

const page = (fmt, start) => ({
  size: { width: 11906, height: 16838 },
  margin: { top: 1440, bottom: 1440, left: 2160, right: 1440, footer: 708 },
  pageNumbers: fmt ? { start, formatType: fmt } : undefined,
});
const pageFooter = () => ({ default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 24 })] })] }) });
const blankFooter = () => ({ default: new Footer({ children: [new Paragraph({ children: [] })] }) });
const pb = () => new Paragraph({ children: [new PageBreak()] });

const doc = new Document({
  creator: FRONT.members[0].name,
  title: FRONT.title,
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 32, bold: true, color: "000000" }, paragraph: { outlineLevel: 0, alignment: AlignmentType.CENTER } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 28, color: "000000" }, paragraph: { outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 24, color: "000000" }, paragraph: { outlineLevel: 2 } },
      { id: "FigureCaption", name: "Figure Caption", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 22 }, paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 240, line: 276 } } },
      { id: "ListingCaption", name: "Listing Caption", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 22, italics: true }, paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 200, after: 60, line: 276 } } },
      { id: "TableCaption", name: "Table Caption", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 22 }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100, line: 276 } } },
    ],
  },
  numbering: { config: numberingConfigs },
  features: { updateFields: true },
  sections: [
    { properties: { page: page() }, footers: blankFooter(),
      children: [...titlePage(true), pb(), ...titlePage(false), pb(), ...declaration(), pb(), ...certificate()] },
    { properties: { page: page(NumberFormat.LOWER_ROMAN, 1) }, footers: pageFooter(),
      children: [...abstractPage(), pb(), ...acknowledgement(),
        ...placeholder("CONTENTS", "[[TOC]]"), ...placeholder("LIST OF FIGURES", "[[LOF]]"),
        ...placeholder("LIST OF TABLES", "[[LOT]]"), ...acronyms()] },
    { properties: { page: page(NumberFormat.DECIMAL, 1) }, footers: pageFooter(),
      children: [...chapterBody, ...refBody, ...appendixBody] },
  ],
});
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  const figs = [...CHAPTERS, ...APPENDICES].filter((b) => b.t === "fig").length;
  const tabs = [...CHAPTERS, ...APPENDICES].filter((b) => b.t === "table").length;
  const words = [...CHAPTERS, ...APPENDICES].reduce((n, b) => n + (b.text ? b.text.split(/\s+/).length : 0)
    + (b.items ? b.items.join(" ").split(/\s+/).length : 0), 0);
  console.log(`wrote ${OUT}\n  chapters ${chap}, figures ${figs}, tables ${tabs}, references ${cited.size}, body words ~${words}`);
});
