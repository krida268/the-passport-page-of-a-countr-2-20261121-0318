// The Passport Page of a Country That Isn't There
// Republic of Auralia — invented passport spread, drawn entirely procedurally.
// Node 22, stdlib only (zlib, fs, path). No network, no clock, no unseeded
// randomness: the same run always produces the same bytes.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const NAVY: RGB = [20, 38, 77];
const NAVY_DARK: RGB = [12, 24, 52];
const INK: RGB = [26, 26, 46];
const PAPER: RGB = [247, 242, 230];
const PAPER_EDGE: RGB = [232, 224, 205];
const GOLD: RGB = [176, 138, 62];
const MAROON: RGB = [122, 31, 43];
const TEAL: RGB = [15, 91, 82];
const BLUE_STAMP: RGB = [28, 62, 128];
const SKIN: RGB = [224, 184, 150];
const SKIN_SHADE: RGB = [203, 160, 124];
const HAIR: RGB = [38, 28, 24];
const PHOTO_BG: RGB = [168, 188, 205];
const PHOTO_BG2: RGB = [140, 165, 188];
const GREY: RGB = [110, 108, 100];
const LIGHT_LINE: RGB = [190, 180, 158];

type RGB = [number, number, number];

// ---------------------------------------------------------------- canvas
const buf = new Uint8Array(W * H * 3);
function px(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c);
}
function rect(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}
function hline(x0: number, x1: number, y: number, c: RGB, t = 1): void {
  for (let t0 = 0; t0 < t; t0++) for (let x = x0; x <= x1; x++) px(x, y + t0, c);
}
function vline(x: number, y0: number, y1: number, c: RGB, t = 1): void {
  for (let t0 = 0; t0 < t; t0++) for (let y = y0; y <= y1; y++) px(x + t0, y, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let s = 0; s <= steps; s++) {
    px(Math.round(x0 + (dx * s) / steps), Math.round(y0 + (dy * s) / steps), c);
  }
}
function circle(cx: number, cy: number, r: number, c: RGB, t = 1): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++) {
      px(Math.round(cx + (r - k) * Math.cos(rad)), Math.round(cy + (r - k) * Math.sin(rad)), c);
    }
  }
}
function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) px(cx + x, cy + y, c);
  }
}
function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let y = -ry; y <= ry; y++) {
    const half = Math.floor((rx * Math.sqrt(ry * ry - y * y)) / ry);
    for (let x = -half; x <= half; x++) px(cx + x, cy + y, c);
  }
}
// Scanline polygon fill (convex or concave, deterministic).
function fillPoly(pts: Array<[number, number]>, c: RGB): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) px(x, y, c);
    }
  }
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows, 5 bits each (bit 4 = leftmost column).
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 6, 8, 16, 31],
  "3": [31, 2, 4, 2, 1, 17, 14],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [6, 8, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 2, 12],
  " ": [0, 0, 0, 0, 0, 0, 0],
  "-": [0, 0, 0, 31, 0, 0, 0],
  "/": [1, 2, 2, 4, 8, 8, 16],
  ".": [0, 0, 0, 0, 0, 12, 12],
  ",": [0, 0, 0, 0, 12, 4, 8],
  ":": [0, 12, 12, 0, 12, 12, 0],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  "<": [2, 4, 8, 16, 8, 4, 2],
  ">": [8, 4, 2, 1, 2, 4, 8],
  "'": [4, 4, 8, 0, 0, 0, 0],
  "&": [12, 18, 20, 8, 21, 18, 13],
  "*": [0, 4, 21, 14, 21, 4, 0],
  "+": [0, 4, 4, 31, 4, 4, 0],
  "=": [0, 0, 31, 0, 31, 0, 0],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "\u2022": [0, 0, 4, 14, 14, 4, 0],
  "\u2014": [0, 0, 0, 31, 0, 0, 0],
  "\u2192": [0, 4, 2, 31, 2, 4, 0],
  "\u2190": [0, 8, 16, 31, 16, 8, 0],
};
function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT[" "];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row] & (1 << (4 - col))) {
          fillRect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}
function drawTextCenter(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}
// Tight rendering for the MRZ: no inter-character gap, so 44 chars at
// scale 2 (440 px) fit the data page.
function drawTextTight(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT[" "];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row] & (1 << (4 - col))) {
          fillRect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 5 * scale;
  }
}

// ---------------------------------------------------------------- MRZ (ICAO)
// Check digit: weights 7,3,1; '<' = 0, digits as-is, letters A=10 .. Z=35.
function mrzValue(ch: string): number {
  if (ch === "<") return 0;
  if (ch >= "0" && ch <= "9") return ch.charCodeAt(0) - 48;
  return ch.charCodeAt(0) - 55;
}
function mrzCheck(s: string): string {
  const w = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += mrzValue(s[i]) * w[i % 3];
  return String(sum % 10);
}
function padRight(s: string, n: number): string {
  return (s + "<".repeat(n)).slice(0, n);
}
function buildMrz(): [string, string] {
  const line1 = padRight("P<AURVENN<<MARA", 44);
  const docNo = "AU0048217";
  const nat = "AUR";
  const dob = "910602"; // 02 JUN 1991
  const sex = "F";
  const exp = "340313"; // 13 MAR 2034
  const personal = "<".repeat(14);
  const body =
    docNo + mrzCheck(docNo) + nat + dob + mrzCheck(dob) + sex + exp + mrzCheck(exp) +
    personal + mrzCheck(personal);
  const line2 = body + mrzCheck(body);
  return [line1, line2];
}

// ---------------------------------------------------------------- emblem
// White gull over a five-pointed star on a navy roundel.
function starPoints(cx: number, cy: number, rOuter: number, rInner: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]);
  }
  return pts;
}
function drawEmblem(cx: number, cy: number, r: number): void {
  fillCircle(cx, cy, r, NAVY);
  circle(cx, cy, r, GOLD, 2);
  circle(cx, cy, r - 4, [247, 242, 230], 1);
  // five-pointed star
  fillPoly(starPoints(cx, cy + 3, r - 12, Math.round((r - 12) * 0.42)), [247, 242, 230]);
  // gull: two sweeping arcs above the star
  const gy = cy - r + 12;
  line(cx - 16, gy + 6, cx - 6, gy, [247, 242, 230]);
  line(cx - 6, gy, cx, gy + 5, [247, 242, 230]);
  line(cx, gy + 5, cx + 6, gy, [247, 242, 230]);
  line(cx + 6, gy, cx + 16, gy + 6, [247, 242, 230]);
}

// ---------------------------------------------------------------- portrait
// Procedural portrait: dark hair, simple face, shoulders, in a photo box.
function drawPortrait(x: number, y: number, w: number, h: number): void {
  // photo background: vertical bands of cool blue-grey
  for (let j = 0; j < h; j++) {
    const t = j / h;
    const c: RGB = [
      Math.round(PHOTO_BG[0] + (PHOTO_BG2[0] - PHOTO_BG[0]) * t),
      Math.round(PHOTO_BG[1] + (PHOTO_BG2[1] - PHOTO_BG[1]) * t),
      Math.round(PHOTO_BG[2] + (PHOTO_BG2[2] - PHOTO_BG[2]) * t),
    ];
    hline(x, x + w - 1, y + j, c);
  }
  const cx = x + Math.floor(w / 2);
  const headCy = y + 78;
  // shoulders / jacket
  fillPoly(
    [
      [x + 8, y + h],
      [x + 18, y + 168],
      [cx - 34, y + 152],
      [cx - 26, y + 138],
      [cx + 26, y + 138],
      [cx + 34, y + 152],
      [x + w - 18, y + 168],
      [x + w - 8, y + h],
    ],
    NAVY_DARK,
  );
  // shirt V
  fillPoly(
    [
      [cx - 18, y + 140],
      [cx + 18, y + 140],
      [cx, y + 172],
    ],
    PAPER,
  );
  // neck
  fillRect(cx - 13, y + 118, 26, 26, SKIN_SHADE);
  // head
  fillEllipse(cx, headCy, 40, 50, SKIN);
  // hair: dark cap over the top of the head, side sweeps
  fillPoly(
    [
      [cx - 41, headCy - 6],
      [cx - 40, headCy - 34],
      [cx - 24, headCy - 52],
      [cx, headCy - 54],
      [cx + 24, headCy - 52],
      [cx + 40, headCy - 34],
      [cx + 41, headCy - 6],
      [cx + 34, headCy - 26],
      [cx + 18, headCy - 40],
      [cx, headCy - 42],
      [cx - 18, headCy - 40],
      [cx - 34, headCy - 26],
    ],
    HAIR,
  );
  // hair side strands
  fillRect(cx - 42, headCy - 8, 8, 34, HAIR);
  fillRect(cx + 34, headCy - 8, 8, 34, HAIR);
  // brows
  fillRect(cx - 26, headCy - 8, 16, 3, HAIR);
  fillRect(cx + 10, headCy - 8, 16, 3, HAIR);
  // eyes
  fillRect(cx - 22, headCy - 1, 9, 3, INK);
  fillRect(cx + 13, headCy - 1, 9, 3, INK);
  // nose
  vline(cx, headCy + 4, headCy + 18, SKIN_SHADE, 2);
  hline(cx - 4, cx + 4, headCy + 19, SKIN_SHADE, 2);
  // mouth
  hline(cx - 11, cx + 11, headCy + 32, [150, 80, 70], 2);
  // cheek shading
  fillEllipse(cx - 28, headCy + 18, 7, 4, SKIN_SHADE);
  fillEllipse(cx + 28, headCy + 18, 7, 4, SKIN_SHADE);
}

// ---------------------------------------------------------------- stamps
// Tight centered text (no inter-character gap).
function drawTextTightCenter(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawTextTight(cx - Math.floor((s.length * 5 * scale) / 2), y, s, scale, c);
}
function drawRoundStamp(
  cx: number,
  cy: number,
  r: number,
  c: RGB,
  lines: Array<{ text: string; scale: number }>,
): void {
  circle(cx, cy, r, c, 3);
  circle(cx, cy, r - 7, c, 1);
  let y = cy - Math.floor((lines.length * 9) / 2) - 8;
  for (const ln of lines) {
    // The date line is the widest; render it tight so it stays inside the ring.
    if (ln.scale === 2 && /[0-9]/.test(ln.text) && ln.text.length > 9) {
      drawTextTightCenter(cx, y, ln.text, ln.scale, c);
    } else {
      drawTextCenter(cx, y, ln.text, ln.scale, c);
    }
    y += ln.scale === 2 ? 20 : 14;
  }
  // small star under the text
  fillPoly(starPoints(cx, cy + r - 20, 6, 3), c);
}

// ---------------------------------------------------------------- page setup
fillRect(0, 0, W, H, NAVY_DARK);
// two ivory pages with a gutter
const PAGE_Y = 14;
const PAGE_H = 996;
const LEFT_X = 14;
const LEFT_W = 488;
const RIGHT_X = 522;
const RIGHT_W = 488;
fillRect(LEFT_X, PAGE_Y, LEFT_W, PAGE_H, PAPER);
fillRect(RIGHT_X, PAGE_Y, RIGHT_W, PAGE_H, PAPER);
// page edge shading + borders
fillRect(LEFT_X, PAGE_Y, LEFT_W, 4, PAPER_EDGE);
fillRect(RIGHT_X, PAGE_Y, RIGHT_W, 4, PAPER_EDGE);
rect(LEFT_X + 6, PAGE_Y + 6, LEFT_W - 12, PAGE_H - 12, NAVY, 2);
rect(RIGHT_X + 6, PAGE_Y + 6, RIGHT_W - 12, PAGE_H - 12, NAVY, 2);
// gutter shadow
fillRect(508, PAGE_Y, 6, PAGE_H, [8, 16, 36]);
fillRect(502, PAGE_Y, 6, PAGE_H, [40, 52, 84]);

// faint guilloche waves on both pages
for (let k = 0; k < 3; k++) {
  for (let x = 0; x < W; x += 2) {
    const y = 700 + k * 6 + Math.round(3 * Math.sin(x / 46 + k));
    if (x > LEFT_X + 10 && x < LEFT_X + LEFT_W - 10) px(x, y, LIGHT_LINE);
    if (x > RIGHT_X + 10 && x < RIGHT_X + RIGHT_W - 10) px(x, y, LIGHT_LINE);
  }
}

// ================================================================ LEFT PAGE
// header
drawEmblem(78, 66, 34);
drawTextCenter(300, 34, "REPUBLIC OF AURALIA", 2, NAVY);
drawTextCenter(300, 56, "REPUBLIKO DI AURALIA", 1, GREY);
drawTextCenter(300, 84, "PASSPORT", 3, NAVY);
drawTextCenter(300, 112, "PASPORT  \u2022  BY SEA AND STAR", 1, GOLD);

// photo + data
const PHOTO_X = 34;
const PHOTO_Y = 146;
const PHOTO_W = 168;
const PHOTO_H = 208;
drawPortrait(PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H);
rect(PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H, NAVY, 2);
drawTextCenter(PHOTO_X + PHOTO_W / 2, PHOTO_Y + PHOTO_H + 8, "PHOTO \u2022 FOTO", 1, GREY);

interface Field {
  label: string;
  labelAu: string;
  value: string;
}
const FIELDS: Field[] = [
  { label: "SURNAME", labelAu: "FAMILINOMO", value: "VENN" },
  { label: "GIVEN NAMES", labelAu: "NOMO", value: "MARA" },
  { label: "SEX", labelAu: "SEXO", value: "F" },
  { label: "DATE OF BIRTH", labelAu: "NASKODATO", value: "02 JUN 1991" },
  { label: "PLACE OF BIRTH", labelAu: "NASKOLOKO", value: "PORT VENN" },
  { label: "NATIONALITY", labelAu: "NACIECO", value: "AURALIAN" },
  { label: "PASSPORT NO.", labelAu: "PASPORT NO.", value: "AU-0048217" },
  { label: "DATE OF ISSUE", labelAu: "ELDONDATO", value: "14 MAR 2024" },
  { label: "DATE OF EXPIRY", labelAu: "FINODATO", value: "13 MAR 2034" },
  { label: "ISSUING AUTHORITY", labelAu: "ELDONANTO", value: "PORT VENN" },
];
let fy = 150;
for (const f of FIELDS) {
  drawText(220, fy, `${f.label} / ${f.labelAu}`, 1, GREY);
  drawText(220, fy + 11, f.value, 2, INK);
  fy += 30;
}
// signature
hline(220, 470, 452, INK, 1);
drawText(220, 458, "MARA VENN", 2, NAVY);
drawText(220, 480, "HOLDER'S SIGNATURE / SUBSKRIBO", 1, GREY);

// type / code strip
drawText(34, 420, "TYPE / TIPO", 1, GREY);
drawText(34, 431, "P", 2, INK);
drawText(120, 420, "CODE / KODO", 1, GREY);
drawText(120, 431, "AUR", 2, INK);

// MRZ band
const [MRZ1, MRZ2] = buildMrz();
fillRect(LEFT_X + 14, 520, LEFT_W - 28, 96, [238, 232, 216]);
rect(LEFT_X + 14, 520, LEFT_W - 28, 96, NAVY, 1);
drawText(LEFT_X + 26, 532, "MACHINE READABLE ZONE", 1, GREY);
drawTextTight(LEFT_X + 24, 556, MRZ1, 2, INK);
drawTextTight(LEFT_X + 24, 580, MRZ2, 2, INK);
drawTextCenter(LEFT_X + LEFT_W / 2, 640, "THIS PASSPORT REMAINS THE PROPERTY OF", 1, GREY);
drawTextCenter(LEFT_X + LEFT_W / 2, 654, "THE REPUBLIC OF AURALIA", 1, GREY);

// --- schematic map of the Meridian Sea, filling the lower data page:
// Auralia between Norvask (north) and Telmara (east), with Mara Venn's
// two recorded voyages drawn as dashed routes.
function dashedLine(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.floor(len / 5);
  for (let s = 0; s < steps; s += 2) {
    const t0 = s / steps;
    const t1 = Math.min(1, (s + 1) / steps);
    line(
      Math.round(x0 + dx * t0),
      Math.round(y0 + dy * t0),
      Math.round(x0 + dx * t1),
      Math.round(y0 + dy * t1),
      c,
    );
  }
}
const MAP_X = LEFT_X + 20;
const MAP_Y = 690;
const MAP_W = LEFT_W - 40;
const MAP_H = 280;
fillRect(MAP_X, MAP_Y, MAP_W, MAP_H, [216, 230, 240]);
rect(MAP_X, MAP_Y, MAP_W, MAP_H, NAVY, 1);
drawTextCenter(MAP_X + MAP_W / 2, MAP_Y + 10, "MERIDIAN SEA \u2022 ROUTES OF MARA VENN", 1, NAVY);
// compass rose
circle(MAP_X + 34, MAP_Y + 44, 14, NAVY, 1);
fillPoly(
  [
    [MAP_X + 34, MAP_Y + 32],
    [MAP_X + 38, MAP_Y + 44],
    [MAP_X + 30, MAP_Y + 44],
  ],
  MAROON,
);
drawText(MAP_X + 31, MAP_Y + 48, "N", 1, NAVY);
// islands: Norvask (north), Auralia (centre), Telmara (east)
fillEllipse(MAP_X + 330, MAP_Y + 92, 62, 26, [196, 214, 176]);
drawTextCenter(MAP_X + 330, MAP_Y + 66, "NORVASK", 1, INK);
drawTextCenter(MAP_X + 330, MAP_Y + 122, "KALDVIK", 1, GREY);
fillEllipse(MAP_X + 130, MAP_Y + 168, 74, 32, [196, 214, 176]);
drawTextCenter(MAP_X + 130, MAP_Y + 140, "AURALIA", 2, NAVY);
drawTextCenter(MAP_X + 130, MAP_Y + 204, "PORT VENN \u2022", 1, INK);
fillEllipse(MAP_X + 330, MAP_Y + 216, 66, 28, [196, 214, 176]);
drawTextCenter(MAP_X + 330, MAP_Y + 190, "TELMARA", 1, INK);
drawTextCenter(MAP_X + 330, MAP_Y + 248, "SORREL BAY", 1, GREY);
// routes: Port Venn -> Kaldvik -> Port Venn (May 2024), Port Venn ->
// Sorrel Bay -> Port Venn (Sep 2025)
dashedLine(MAP_X + 150, MAP_Y + 160, MAP_X + 310, MAP_Y + 96, BLUE_STAMP);
dashedLine(MAP_X + 310, MAP_Y + 96, MAP_X + 150, MAP_Y + 160, BLUE_STAMP);
dashedLine(MAP_X + 160, MAP_Y + 176, MAP_X + 300, MAP_Y + 212, TEAL);
dashedLine(MAP_X + 300, MAP_Y + 212, MAP_X + 160, MAP_Y + 176, TEAL);
fillCircle(MAP_X + 150, MAP_Y + 160, 4, MAROON);
fillCircle(MAP_X + 310, MAP_Y + 96, 4, BLUE_STAMP);
fillCircle(MAP_X + 300, MAP_Y + 212, 4, TEAL);
drawText(MAP_X + 10, MAP_Y + MAP_H - 14, "SCALE: NOT TO SCALE \u2022 MERIDIAN SEA, SOUTH", 1, GREY);

// =============================================================== RIGHT PAGE
drawTextCenter(RIGHT_X + RIGHT_W / 2, 34, "VISAS", 3, NAVY);
drawTextCenter(RIGHT_X + RIGHT_W / 2, 62, "VIZOJ KAJ STAMPOJ \u2022 ENTRY AND EXIT STAMPS", 1, GREY);

// --- Telmara visa box
const VISA_X = RIGHT_X + 24;
const VISA_Y = 88;
const VISA_W = RIGHT_W - 48;
const VISA_H = 190;
fillRect(VISA_X, VISA_Y, VISA_W, VISA_H, [250, 246, 236]);
rect(VISA_X, VISA_Y, VISA_W, VISA_H, TEAL, 3);
rect(VISA_X + 6, VISA_Y + 6, VISA_W - 12, VISA_H - 12, TEAL, 1);
drawTextCenter(VISA_X + VISA_W / 2, VISA_Y + 16, "VISA \u2014 TELMARA", 2, TEAL);
drawTextCenter(VISA_X + VISA_W / 2, VISA_Y + 40, "TOURIST \u2022 30 DAYS \u2022 SINGLE ENTRY", 1, INK);
drawTextCenter(VISA_X + VISA_W / 2, VISA_Y + 58, "ISSUED 28 AUG 2025 \u2022 SORREL BAY", 1, INK);
drawTextCenter(VISA_X + VISA_W / 2, VISA_Y + 76, "HOLDER: MARA VENN \u2022 AU-0048217", 1, INK);
drawTextCenter(VISA_X + VISA_W / 2, VISA_Y + 100, "EMPLOYMENT PROHIBITED", 2, MAROON);
drawTextCenter(VISA_X + VISA_W / 2, VISA_Y + 124, "\u2014 TOURIST ONLY \u2014", 1, MAROON);
// fee stamp inside the visa
const FEE_X = VISA_X + 118;
const FEE_Y = VISA_Y + 142;
rect(FEE_X, FEE_Y, 204, 34, MAROON, 2);
drawTextCenter(VISA_X + VISA_W / 2, FEE_Y + 10, "VISA FEE 40 AUR PAID", 1, MAROON);

// --- entry / exit stamps, two columns
interface Stamp {
  country: string;
  kind: string;
  place: string;
  date: string;
  color: RGB;
}
const STAMPS: Stamp[] = [
  { country: "NORVASK", kind: "ARRIVAL", place: "KALDVIK", date: "03 MAY 2024", color: BLUE_STAMP },
  { country: "NORVASK", kind: "DEPARTURE", place: "KALDVIK", date: "18 MAY 2024", color: BLUE_STAMP },
  { country: "AURALIA", kind: "ARRIVAL", place: "PORT VENN", date: "18 MAY 2024", color: MAROON },
  { country: "TELMARA", kind: "ARRIVAL", place: "SORREL BAY", date: "09 SEP 2025", color: TEAL },
  { country: "TELMARA", kind: "DEPARTURE", place: "SORREL BAY", date: "22 SEP 2025", color: TEAL },
  { country: "AURALIA", kind: "ARRIVAL", place: "PORT VENN", date: "22 SEP 2025", color: MAROON },
];
const STAMP_W = 216;
const STAMP_H = 196;
const STAMP_X0 = RIGHT_X + 24;
const STAMP_Y0 = 300;
for (let i = 0; i < STAMPS.length; i++) {
  const st = STAMPS[i];
  const col = i % 2;
  const row = Math.floor(i / 2);
  const cx = STAMP_X0 + col * (STAMP_W + 8) + STAMP_W / 2;
  const cy = STAMP_Y0 + row * (STAMP_H + 8) + STAMP_H / 2;
  drawRoundStamp(cx, cy, 78, st.color, [
    { text: st.country, scale: 2 },
    { text: st.kind, scale: 2 },
    { text: st.place, scale: 1 },
    { text: st.date, scale: 2 },
  ]);
  // tiny route arrow under each stamp
  drawTextCenter(cx, cy + 84, st.kind === "ARRIVAL" ? "IN \u2192" : "OUT \u2190", 1, st.color);
}

// footer note on right page
drawTextCenter(RIGHT_X + RIGHT_W / 2, 950, "PORT VENN \u2022 KALDVIK \u2022 SORREL BAY", 1, GREY);
drawTextCenter(RIGHT_X + RIGHT_W / 2, 966, "BY SEA AND STAR", 1, GOLD);

// ---------------------------------------------------------------- PNG write
function crc32(data: Buffer): number {
  let table = (crc32 as unknown as { t?: Int32Array }).t;
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    (crc32 as unknown as { t: Int32Array }).t = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}
function encodePng(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    Buffer.from(buf.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "entry.png");
fs.writeFileSync(outPath, encodePng());
console.log(`wrote ${outPath}`);
