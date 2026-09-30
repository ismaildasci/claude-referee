// Renders every SVG in ../assets to PNG in ../_previews/ for review: node render-previews.mjs [name-filter]
// Each SVG loads through <img> on its page colour at 2x, then again with the wider DejaVu fonts to prove nothing clips.
// Uses Playwright's Chromium; set CHROMIUM_PATH to use a specific build.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { THEMES } from "./lib/tokens.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(here, "..", "assets");
const OUT = path.join(here, "..", "_previews");
fs.mkdirSync(OUT, { recursive: true });
function forceWide(svg) {
  return svg.replace(/\.s\{font-family:[^}]*\}/, '.s{font-family:"DejaVu Sans"}').replace(/\.m\{font-family:[^}]*\}/, '.m{font-family:"DejaVu Sans Mono"}');
}
async function launch() {
  const executablePath = process.env.CHROMIUM_PATH || void 0;
  return chromium.launch({ executablePath });
}
async function renderSvg(page, svg, { bg, out, scale = 2 }) {
  const [, , w, h] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  await page.setViewportSize({ width: Math.ceil(w), height: Math.ceil(h) });
  const src = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:${bg}"><img id="i" src="${src}" width="${w}" height="${h}" style="display:block"></body></html>`
  );
  await page.evaluate(() => document.getElementById("i").decode());
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h }, scale: scale === 1 ? "css" : "device" });
}
async function main() {
  const filter = process.argv[2] || "";
  const browser = await launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  const files = fs.readdirSync(ASSETS).filter((f) => f.endsWith(".svg") && f.includes(filter)).sort();
  for (const f of files) {
    const svg = fs.readFileSync(path.join(ASSETS, f), "utf8");
    const bg = THEMES[f.includes("-dark") ? "dark" : "light"].page;
    const base = f.replace(/\.svg$/, "");
    await renderSvg(page, svg, { bg, out: path.join(OUT, `${base}.png`) });
    await renderSvg(page, forceWide(svg), { bg, out: path.join(OUT, `${base}.wide-font.png`) });
    console.log(`rendered ${base}.png + ${base}.wide-font.png`);
  }
  await browser.close();
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
export {
  forceWide,
  launch,
  renderSvg
};
