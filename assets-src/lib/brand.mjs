// The claude-referee mark and wordmark as plain SVG paths.
// Wordmark: "claude-referee" in Space Grotesk Bold (SIL OFL 1.1, via @fontsource), outlined with opentype.js
// so it renders the same through <img>, where web fonts never load. The "claude-" prefix can take a quieter colour.
// Mark: a rounded square holding a referee's pennant on a pole; an interim mark until a designed one replaces it.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { r } from "./tokens.mjs";
const require2 = createRequire(import.meta.url);
const opentype = require2("opentype.js");
const here = path.dirname(fileURLToPath(import.meta.url));
const FONT_FILE = path.join(
  here,
  "..",
  "node_modules",
  "@fontsource",
  "space-grotesk",
  "files",
  "space-grotesk-latin-700-normal.woff"
);
const NAME = "claude-referee";
const NAME_SPLIT = "claude-".length;
let _font;
function brandFont() {
  _font ??= opentype.loadSync(FONT_FILE);
  return _font;
}
function wordmark(text = NAME, { tracking = -12, split = 0 } = {}) {
  const font = brandFont();
  const glyphs = font.stringToGlyphs(text);
  const head = [], tail = [];
  const box = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
  let x = 0;
  glyphs.forEach((g, i) => {
    const p = g.getPath(x, 0, font.unitsPerEm);
    (i < split ? head : tail).push(p.toPathData(0));
    const b = p.getBoundingBox();
    if (b.x2 > b.x1) {
      box.x1 = Math.min(box.x1, b.x1);
      box.y1 = Math.min(box.y1, b.y1);
      box.x2 = Math.max(box.x2, b.x2);
      box.y2 = Math.max(box.y2, b.y2);
    }
    const next = glyphs[i + 1];
    x += g.advanceWidth + (next ? font.getKerningValue(g, next) + tracking : 0);
  });
  return { dHead: head.join(""), dTail: tail.join(""), box, upm: font.unitsPerEm };
}
function wordmarkSVG({ x, top, capHeight, fill, fillHead, text = NAME, split = NAME_SPLIT, tracking }) {
  const w = wordmark(text, { tracking, split: fillHead ? split : 0 });
  const s = capHeight / 700;
  const tx = x - w.box.x1 * s;
  const ty = top + 700 * s;
  const width = (w.box.x2 - w.box.x1) * s;
  const m = `matrix(${r(s, 5)} 0 0 ${r(s, 5)} ${r(tx)} ${r(ty)})`;
  let svg = "";
  if (w.dHead) svg += `<path fill="${fillHead}" transform="${m}" d="${w.dHead}"/>`;
  svg += `<path fill="${fill}" transform="${m}" d="${w.dTail}"/>`;
  return { svg, width, height: capHeight, baseline: ty, descent: w.box.y2 * s };
}
const POLE = { x: 300, w: 96, top: 130, bottom: 880 };
const PENNANT = { len: 440, h: 330 };
function markGlyph() {
  const { x, w, top, bottom } = POLE;
  const pole = `M${x} ${top}H${x + w}V${bottom}H${x}Z`;
  const x0 = x + w;
  const flag = `M${x0} ${top}L${x0 + PENNANT.len} ${top + PENNANT.h / 2}L${x0} ${top + PENNANT.h}Z`;
  const box = { x1: x, x2: x0 + PENNANT.len, y1: top, y2: bottom };
  return { d: pole + flag, box };
}
function markSVG({ x, y, size, bg, fg, glyphScale = 0.62 }) {
  const g = markGlyph();
  const gh = g.box.y2 - g.box.y1;
  const s = size * glyphScale / gh;
  const cx = (g.box.x1 + g.box.x2) / 2 - 40;
  const cy = (g.box.y1 + g.box.y2) / 2;
  const tx = x + size / 2 - cx * s;
  const ty = y + size / 2 - cy * s;
  const m = `matrix(${r(s, 5)} 0 0 ${r(s, 5)} ${r(tx)} ${r(ty)})`;
  const rx = r(size * 0.23);
  return `<rect x="${r(x)}" y="${r(y)}" width="${r(size)}" height="${r(size)}" rx="${rx}" fill="${bg}"/><path fill="${fg}" transform="${m}" d="${g.d}"/>`;
}
export {
  FONT_FILE,
  NAME,
  NAME_SPLIT,
  brandFont,
  markSVG,
  wordmark,
  wordmarkSVG
};
