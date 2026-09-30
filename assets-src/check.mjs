// Quality checks for the README assets: node check.mjs [assets-dir]
// Static: well-formed XML, title/desc, viewBox, size; no rasters, scripts, external references or orange hues.
// Geometric, in Chromium with widened system fonts and again with DejaVu: text stays inside its box,
// nothing overlaps, arrows start and end on box edges. Contrast: WCAG ratio of every text/background pair.
// PNG: the social preview is exactly 1280 x 640 and under 1 MB.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { launch, forceWide } from "./render-previews.mjs";
import { THEMES, mix } from "./lib/tokens.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = process.argv[2] ? path.resolve(process.argv[2]) : path.join(here, "..", "assets");
const EXPECT = { hero: [1200, 400], "how-it-works": [1200, 660], cost: [880, 480] };
let failures = 0;
const fail = (m) => {
  failures++;
  console.log(`  FAIL ${m}`);
};
const ok = (m) => console.log(`  ok   ${m}`);
const lin = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (h) => {
  const [r, g, b] = lin(h);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
function oklch(h) {
  const [r, g, b] = lin(h);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { C: Math.hypot(A, B), H: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 };
}
const svgs = fs.readdirSync(ASSETS).filter((f) => f.endsWith(".svg")).sort();
const hasXmllint = (() => {
  try {
    execFileSync("xmllint", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
console.log(`Static checks (${svgs.length} SVGs${hasXmllint ? ", xmllint" : ""})`);
for (const f of svgs) {
  const file = path.join(ASSETS, f);
  const svg = fs.readFileSync(file, "utf8");
  const kind = Object.keys(EXPECT).find((k) => f.startsWith(k + "-"));
  const errs = [];
  if (hasXmllint) {
    try {
      execFileSync("xmllint", ["--noout", file], { stdio: "pipe" });
    } catch (e) {
      errs.push("xmllint: " + e.stderr);
    }
  }
  const size = Buffer.byteLength(svg);
  if (size > 60 * 1024) errs.push(`size ${size} B > 60 KB`);
  const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
  if (!/role="img"/.test(root)) errs.push('missing role="img"');
  if (!/aria-labelledby="/.test(root)) errs.push("missing aria-labelledby");
  if (!/<title\b[^>]*>[^<]+<\/title>/.test(svg)) errs.push("missing <title>");
  if (!/<desc\b[^>]*>[^<]+<\/desc>/.test(svg)) errs.push("missing <desc>");
  const vb = root.match(/viewBox="0 0 (\d+) (\d+)"/);
  if (!vb || +vb[1] !== EXPECT[kind][0] || +vb[2] !== EXPECT[kind][1]) errs.push(`viewBox ${vb?.slice(1)} != ${EXPECT[kind]}`);
  if (/<(image|script|foreignObject)\b/.test(svg)) errs.push("contains image/script/foreignObject");
  if (/(href|src)="(https?:|data:)/.test(svg) || /url\((https?:|data:)/.test(svg)) errs.push("external or data reference");
  const hues = [...new Set(svg.match(/#[0-9a-f]{6}\b/gi))].filter((h) => {
    const { C, H } = oklch(h.toLowerCase());
    return C > 0.04 && H >= 15 && H <= 85;
  });
  if (hues.length) errs.push(`orange-ish colours: ${hues.join(", ")}`);
  if (errs.length) errs.forEach((e) => fail(`${f}: ${e}`));
  else ok(`${f.padEnd(26)} ${(size / 1024).toFixed(1)} KB, well-formed, a11y ok, viewBox ${vb[1]}x${vb[2]}`);
}
const inter = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
const inside = (a, b, pad) => a.x1 >= b.x1 + pad && a.x2 <= b.x2 - pad && a.y1 >= b.y1 + pad && a.y2 <= b.y2 - pad;
const grow = (b, d) => ({ x1: b.x1 - d, y1: b.y1 - d, x2: b.x2 + d, y2: b.y2 + d });
const area = (b) => (b.x2 - b.x1) * (b.y2 - b.y1);
function widen(b, anchor, k) {
  const d = (b.x2 - b.x1) * k;
  if (anchor === "middle") return { ...b, x1: b.x1 - d / 2, x2: b.x2 + d / 2 };
  if (anchor === "end") return { ...b, x1: b.x1 - d };
  return { ...b, x2: b.x2 + d };
}
function edgeDist([px, py], b) {
  const dx = Math.max(b.x1 - px, 0, px - b.x2), dy = Math.max(b.y1 - py, 0, py - b.y2);
  if (dx || dy) return Math.hypot(dx, dy);
  return Math.min(px - b.x1, b.x2 - px, py - b.y1, b.y2 - py);
}
function analyse(d, k) {
  const issues = [];
  const [vx, vy, vw, vh] = d.vb;
  const canvas = { x1: vx, y1: vy, x2: vx + vw, y2: vy + vh };
  const T = d.texts.map((t) => ({ ...t, w: widen(t.b, t.anchor, k) }));
  for (const t of T) {
    const home = d.boxes.filter((b) => t.x >= b.x1 && t.x <= b.x2 && t.y >= b.y1 && t.y <= b.y2).sort((a, b) => area(a) - area(b))[0];
    if (home && !inside(t.w, home, 2)) issues.push(`"${t.s}" spills out of its box`);
    if (!inside(t.w, canvas, 2)) issues.push(`"${t.s}" leaves the canvas`);
    for (const b of d.boxes) {
      const contains = t.x >= b.x1 && t.x <= b.x2 && t.y >= b.y1 && t.y <= b.y2;
      if (!contains && inter(grow(t.w, 6), b)) issues.push(`"${t.s}" is within 6px of a box it is not in`);
    }
    for (const bar of d.bars) if (inter(t.w, bar)) issues.push(`"${t.s}" overlaps a bar`);
    for (const pts of d.arrows) if (pts.some(([x, y]) => x > t.w.x1 - 3 && x < t.w.x2 + 3 && y > t.w.y1 - 3 && y < t.w.y2 + 3)) issues.push(`arrow crosses "${t.s}"`);
  }
  for (let i = 0; i < T.length; i++)
    for (let j = i + 1; j < T.length; j++)
      if (inter(T[i].w, T[j].w)) issues.push(`"${T[i].s}" overlaps "${T[j].s}"`);
  for (const pts of d.arrows) {
    const s = Math.min(...d.boxes.map((b) => edgeDist(pts[0], b)));
    const e = Math.min(...d.boxes.map((b) => edgeDist(pts[pts.length - 1], b)));
    if (s > 1.5) issues.push(`arrow starts ${s.toFixed(1)}px off a box edge`);
    if (e > 12) issues.push(`arrow ends ${e.toFixed(1)}px from a box edge`);
  }
  return { issues: [...new Set(issues)], n: T.length, arrows: d.arrows.length };
}
const browser = await launch();
const page = await browser.newPage();
console.log("\nGeometric checks (system fonts +12% width, then forced DejaVu)");
for (const f of svgs) {
  const svg = fs.readFileSync(path.join(ASSETS, f), "utf8");
  for (const [mode, src, k] of [["system+12%", svg, 0.12], ["DejaVu", forceWide(svg), 0]]) {
    await page.setContent(`<!doctype html><html><body style="margin:0">${src}</body></html>`);
    const wellFormed = await page.evaluate((s) => !new DOMParser().parseFromString(s, "image/svg+xml").querySelector("parsererror"), src);
    if (!wellFormed) fail(`${f}: DOMParser reports a parse error`);
    const d = await page.evaluate(() => {
      const svg2 = document.querySelector("svg");
      const bb = (e) => {
        const b = e.getBBox();
        return { x1: b.x, y1: b.y, x2: b.x + b.width, y2: b.y + b.height };
      };
      const vb = svg2.viewBox.baseVal;
      return {
        vb: [vb.x, vb.y, vb.width, vb.height],
        texts: [...svg2.querySelectorAll("text")].map((t) => ({
          s: t.textContent,
          x: +t.getAttribute("x"),
          y: +t.getAttribute("y"),
          anchor: t.getAttribute("text-anchor") || "start",
          b: bb(t)
        })),
        boxes: [...svg2.querySelectorAll("rect.box")].map(bb),
        bars: [...svg2.querySelectorAll("path.bar")].map(bb),
        arrows: [...svg2.querySelectorAll("path.arrow")].map((p) => {
          const L = p.getTotalLength(), pts = [];
          for (let s = 0; s < L; s += 2) {
            const q = p.getPointAtLength(s);
            pts.push([q.x, q.y]);
          }
          const e = p.getPointAtLength(L);
          pts.push([e.x, e.y]);
          return pts;
        })
      };
    });
    const res = analyse(d, k);
    if (res.issues.length) res.issues.forEach((i) => fail(`${f} [${mode}]: ${i}`));
    else ok(`${f.padEnd(26)} [${mode}] ${res.n} texts, ${res.arrows} arrows: no clipping, overlap or crossing`);
  }
}
await browser.close();
console.log("\nContrast (WCAG 2.x; text >= 4.5:1, marks/graphics >= 3:1)");
for (const theme of ["light", "dark"]) {
  const t = THEMES[theme];
  const heroBand = mix(t.accent, t.raised, theme === "light" ? 0.08 : 0.13);
  const bTint = mix(t.accent, t.page, theme === "light" ? 0.035 : 0.07);
  const shaft = theme === "light" ? "#8c959f" : "#6e7681";
  const pairs = [
    ["text on page", t.text, t.page, 4.5],
    ["secondary on page", t.secondary, t.page, 4.5],
    ["text on raised panel", t.text, t.raised, 4.5],
    ["secondary on raised panel", t.secondary, t.raised, 4.5],
    ["accent text on hero highlight", t.accent, heroBand, 4.5],
    ["accent header on referee column", t.accent, bTint, 4.5],
    ["text on referee column", t.text, bTint, 4.5],
    ["secondary on referee column", t.secondary, bTint, 4.5],
    ["badge number on badge", t.text, t.chip, 4.5],
    ["mark glyph on accent", t.onAccent, t.accent, 3],
    ["accent bar on page", t.accent, t.page, 3],
    ["grey bar on page", t.other, t.page, 3],
    ["arrow shaft on page", shaft, t.page, 3]
  ];
  if (theme === "dark") pairs.push(["social: accent on transcript band", t.accent, mix(t.accent, t.raised, 0.13), 4.5]);
  for (const [name, fg, bg, min] of pairs) {
    const c = contrast(fg, bg);
    (c >= min ? ok : fail)(`${theme.padEnd(5)} ${name.padEnd(36)} ${fg} on ${bg}  ${c.toFixed(2)}:1 (min ${min})`);
  }
}
console.log("\nPNG");
const png = fs.readFileSync(path.join(ASSETS, "social-preview.png"));
const [pw, ph] = [png.readUInt32BE(16), png.readUInt32BE(20)];
const pngOk = png.subarray(1, 4).toString() === "PNG" && pw === 1280 && ph === 640 && png.length < 1024 * 1024;
(pngOk ? ok : fail)(`social-preview.png ${pw}x${ph}, ${(png.length / 1024).toFixed(1)} KB (needs 1280x640, < 1 MB)`);
console.log(failures ? `
${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
