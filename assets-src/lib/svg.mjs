// Helpers for hand-built SVG: document wrapper, text, and a build-time fit check for every string.
// Fit rule: a box must hold max(DejaVu width, 1.12 x Inter width). Inter stands in for system UI fonts;
// DejaVu is the widest common Linux fallback. Mono text uses JetBrains Mono and DejaVu Sans Mono the same way.
// Missing DejaVu files skip that half of the check.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { SANS, MONO, esc, r } from "./tokens.mjs";
const require2 = createRequire(import.meta.url);
const opentype = require2("opentype.js");
const here = path.dirname(fileURLToPath(import.meta.url));
const nm = (...p) => path.join(here, "..", "node_modules", ...p);
const FONT_FILES = {
  sans400: nm("@fontsource", "inter", "files", "inter-latin-400-normal.woff"),
  sans600: nm("@fontsource", "inter", "files", "inter-latin-600-normal.woff"),
  mono400: nm("@fontsource", "jetbrains-mono", "files", "jetbrains-mono-latin-400-normal.woff"),
  wide400: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  wide600: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  wideMono: "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
};
const cache = {};
function font(key) {
  if (!(key in cache)) cache[key] = fs.existsSync(FONT_FILES[key]) ? opentype.loadSync(FONT_FILES[key]) : null;
  return cache[key];
}
const SLACK = 1.12;
function need(str, { size, weight = 400, mono = false }) {
  const bold = weight >= 600;
  const base = font(mono ? "mono400" : bold ? "sans600" : "sans400");
  const wide = font(mono ? "wideMono" : bold ? "wide600" : "wide400");
  const adv = (f) => f ? f.getAdvanceWidth(str, size, { kerning: true }) : 0;
  return Math.max(adv(wide), SLACK * adv(base));
}
const problems = [];
function fit(str, style, max, where = "") {
  const n = need(str, style);
  if (n > max + 0.01) problems.push(`${where}: "${str}" needs ${n.toFixed(1)}px, has ${max.toFixed(1)}px`);
  return n;
}
function text(x, y, content, { cls = "", anchor, size, weight, raw = false, extra = "" } = {}) {
  const a = [`x="${r(x)}"`, `y="${r(y)}"`];
  if (cls) a.push(`class="${cls}"`);
  if (anchor && anchor !== "start") a.push(`text-anchor="${anchor}"`);
  if (size) a.push(`font-size="${size}"`);
  if (weight) a.push(`font-weight="${weight}"`);
  if (extra) a.push(extra);
  return `<text ${a.join(" ")}>${raw ? content : esc(content)}</text>`;
}
function svgDoc({ w, h, title, desc, css = "", body, id }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}-title ${id}-desc">
<title id="${id}-title">${esc(title)}</title>
<desc id="${id}-desc">${esc(desc)}</desc>
<style>
.s{font-family:${SANS}}
.m{font-family:${MONO}}
${css.trim()}
</style>
${body}
</svg>
`;
}
export {
  SLACK,
  esc,
  fit,
  need,
  problems,
  r,
  svgDoc,
  text
};
