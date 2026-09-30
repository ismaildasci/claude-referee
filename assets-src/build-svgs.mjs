// Builds the README SVGs (light + dark) into ../assets/.
//   node build-svgs.mjs
// Every string is measured before placement (see lib/svg.mjs); the build
// fails if any text would not fit with 12% slack or in the wide fallback font.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { THEMES, mix, esc, r } from "./lib/tokens.mjs";
import { markSVG, wordmarkSVG } from "./lib/brand.mjs";
import { svgDoc, text, fit, need, problems } from "./lib/svg.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "assets");
fs.mkdirSync(OUT, { recursive: true });
const MONO_ADV = 0.6021;
function hero(theme) {
  const t = THEMES[theme];
  const W = 1200, H = 400;
  const X0 = 44;
  const card = { x: 576, y: 80, w: 580, h: 240 };
  const colRight = card.x - 40;
  const colW = colRight - X0;
  const where = `hero-${theme}`;
  let b = "";
  const mark = { x: X0, y: 78, size: 68 };
  b += markSVG({ x: mark.x, y: mark.y, size: mark.size, bg: t.accent, fg: t.onAccent });
  const capH = 40;
  const wmX = mark.x + mark.size + 20;
  const wm = wordmarkSVG({ x: wmX, top: mark.y + (mark.size - capH) / 2 - 3, capHeight: capH, fill: t.text, fillHead: t.secondary });
  if (wmX + wm.width > colRight) problems.push(`${where}: wordmark ends at ${(wmX + wm.width).toFixed(1)}px, column ends at ${colRight}px`);
  b += wm.svg;
  const tag = "Evidence over eloquence.";
  fit(tag, { size: 30, weight: 600 }, colW, where);
  b += text(X0, 208, tag, { cls: "s t", size: 30, weight: 600 });
  const sub = ["Claude makes the big calls.", "The referee makes the small ones."];
  sub.forEach((s, i) => {
    fit(s, { size: 21 }, colW, where);
    b += text(X0, 250 + i * 29, s, { cls: "s t2", size: 21 });
  });
  const foot = "unofficial · built on TypeSafe Jev · MIT";
  fit(foot, { size: 15 }, colW, where);
  b += text(X0, 328, foot, { cls: "s t2", size: 15 });
  const fs_ = 16, ch = MONO_ADV * fs_, padX = 24;
  const col = (c) => card.x + padX + c * ch;
  b += `<rect class="box" x="${card.x + 0.5}" y="${card.y + 0.5}" width="${card.w - 1}" height="${card.h - 1}" rx="12" fill="${t.raised}" stroke="${t.border}"/>`;
  [0, 1, 2].forEach((i) => {
    b += `<circle cx="${card.x + 24 + i * 18}" cy="${card.y + 24}" r="5" fill="${t.dot}"/>`;
  });
  const L = [162, 208, 235, 282];
  const band = { x: card.x + 12, y: L[1] - 24, w: card.w - 24, h: L[2] - L[1] + 37 };
  b += `<rect class="box" x="${band.x}" y="${band.y}" width="${band.w}" height="${band.h}" rx="8" fill="${mix(t.accent, t.raised, theme === "light" ? 0.08 : 0.13)}"/>`;
  b += `<rect x="${band.x}" y="${band.y + 9}" width="3" height="${band.h - 18}" rx="1.5" fill="${t.accent}"/>`;
  const dot = (y, fill) => `<circle cx="${r(col(0.5))}" cy="${y - 5}" r="4.5" fill="${fill}"/>`;
  const diamond = (y, fill) => {
    const cx = col(0.5), cy = y - 5, k = 5.6;
    return `<path d="M${r(cx)} ${r(cy - k)}L${r(cx + k)} ${r(cy)}L${r(cx)} ${r(cy + k)}L${r(cx - k)} ${r(cy)}Z" fill="${fill}"/>`;
  };
  const msgMax = card.x + card.w - 12 - col(11);
  const labelMax = col(11) - col(2) - 8;
  const line = (y, who, msg, accent) => {
    let s = "";
    if (who) {
      fit(who, { size: fs_, mono: true }, labelMax, where);
      s += who === "referee" ? diamond(y, t.accent) : dot(y, t.secondary);
      s += text(col(2), y, who, { cls: `m ${accent ? "ac" : "t2"}`, size: fs_ });
    }
    fit(msg, { size: fs_, mono: true }, msgMax, where);
    s += text(col(11), y, msg, { cls: `m ${accent ? "ac" : "t"}`, size: fs_ });
    return s;
  };
  const cardTag = "Stop hook · done-gate (v0.2)";
  fit(cardTag, { size: 13.5 }, card.w - 24 - 3 * 18 - 40, where);
  b += text(card.x + card.w - 22, card.y + 29, cardTag, { cls: "s t2", anchor: "end", size: 13.5 });
  b += line(L[0], "claude", "All tests pass. Done.");
  b += line(L[1], "referee", "No passing check since your last edit.", true);
  b += line(L[2], "", "Run the check: cargo nextest run", true);
  b += line(L[3], "claude", "Ran it: 2 failures. Fixing them…");
  const css = `.t{fill:${t.text}}.t2{fill:${t.secondary}}.ac{fill:${t.accent}}`;
  return svgDoc({
    w: W,
    h: H,
    id: "referee-hero",
    css,
    body: b,
    title: "claude-referee: evidence over eloquence",
    desc: 'The claude-referee mark, a pennant on a pole, and wordmark with the slogan "Evidence over eloquence." and the line "Claude makes the big calls. The referee makes the small ones." A terminal card labelled "Stop hook, done-gate (v0.2)" shows Claude saying "All tests pass. Done.", the referee answering "No passing check since your last edit. Run the check: cargo nextest run", and Claude replying "Ran it: 2 failures. Fixing them". Footer: unofficial, built on TypeSafe Jev, MIT.'
  });
}
function how(theme) {
  const t = THEMES[theme];
  const W = 1200, H = 660;
  const where = `how-${theme}`;
  const TOP = 78, BOT = 500;
  const A = { x: 12, w: 376 }, B = { x: 424, w: 410 }, C = { x: 870, w: 318 };
  for (const c of [A, B, C]) c.r = c.x + c.w;
  const shaft = theme === "light" ? "#8c959f" : "#6e7681";
  let b = "";
  const frame = (c, accent) => `<rect class="box" x="${c.x + 0.75}" y="${TOP + 0.75}" width="${c.w - 1.5}" height="${BOT - TOP - 1.5}" rx="12" ` + (accent ? `fill="${mix(t.accent, t.page, theme === "light" ? 0.035 : 0.07)}" stroke="${t.accent}" stroke-width="1.5"/>` : `fill="none" stroke="${t.border}" stroke-width="1"/>`);
  b += frame(A) + frame(B, true) + frame(C);
  const divider = (c, color) => `<path d="M${c.x + 1} ${TOP + 56.5}H${c.r - 1}" stroke="${color}"/>`;
  b += divider(A, t.border) + divider(B, mix(t.accent, t.page, 0.35)) + divider(C, t.border);
  const HY = TOP + 36;
  fit("Claude Code session", { size: 19, weight: 600 }, A.w - 36, where);
  b += text(A.x + 18, HY, "Claude Code session", { cls: "s t", size: 19, weight: 600 });
  const bIn = B.x + 16, bW = B.w - 32;
  const hw = need("claude-referee", { size: 19, weight: 600 }) + need(" (runs on your machine)", { size: 16 });
  if (hw > bW) fit("claude-referee (runs on your machine)", { size: 19, weight: 600 }, bW, where);
  b += text(bIn, HY, '<tspan class="ac" font-size="19" font-weight="600">claude-referee</tspan><tspan class="t2" font-size="16"> (runs on your machine)</tspan>', { cls: "s", raw: true });
  fit("TypeSafe Jev API", { size: 19, weight: 600 }, C.w - 36, where);
  b += text(C.x + 18, HY, "TypeSafe Jev API", { cls: "s t", size: 19, weight: 600 });
  const aIn = A.x + 18, aW = A.w - 36;
  const aItems = [
    ["SessionStart", "→ short briefing (≤800 chars, local)"],
    ["Stop", "→ is it really done? (v0.2)"],
    ["Model switch", "→ cache guard (local, v0.2)"],
    ["Claude runs a command", "judge · decide · verify · done", true]
  ];
  aItems.forEach(([head2, detail, mono], i) => {
    const y = TOP + 104 + i * 80;
    fit(head2, { size: 16, weight: 600 }, aW, where);
    b += text(aIn, y, head2, { cls: "s t", size: 16, weight: 600 });
    if (mono) {
      fit(detail, { size: 14, mono: true }, aW, where);
      b += text(aIn, y + 25, detail, { cls: "m t", size: 14 });
    } else {
      fit(detail, { size: 15 }, aW, where);
      b += text(aIn, y + 24, detail, { cls: "s t2", size: 15 });
    }
  });
  const badge = (x, y, n) => `<circle cx="${x + 10.5}" cy="${y - 5.5}" r="10.5" fill="${t.chip}"/>` + text(x + 10.5, y - 1, String(n), { cls: "s t", anchor: "middle", size: 13, weight: 600 });
  const stepX = bIn + 30, stepW = B.r - 16 - stepX;
  const steps = [
    [1, ["Parse evidence in code", "(test runners, linters; v0.2)"], TOP + 104],
    [2, ["Stop secrets, redact personal data"], TOP + 172],
    [3, ["Batch the pack's questions", "into one request"], TOP + 216],
    [5, ["Threshold the probabilities"], TOP + 290]
  ];
  for (const [n, lines, y] of steps) {
    b += badge(bIn, y, n);
    lines.forEach((s, i) => {
      const secondary = s.startsWith("(");
      fit(s, { size: secondary ? 15 : 16 }, stepW, where);
      b += text(stepX, y + i * 23, s, { cls: `s ${secondary ? "t2" : "t"}`, size: secondary ? 15 : 16 });
    });
  }
  const chips = ["silent", "≤300-char note", "JSON verdict"];
  let cx = stepX;
  const chipY = TOP + 306, chipH = 28;
  const chipRow = [];
  for (const c of chips) {
    const w = need(c, { size: 13.5 }) + 16;
    chipRow.push([c, cx, w]);
    cx += w + 6;
  }
  const rowW = cx - 6 - stepX;
  if (rowW > stepW) problems.push(`${where}: chip row needs ${rowW.toFixed(1)}px, has ${stepW.toFixed(1)}px`);
  for (const [c, x, w] of chipRow) {
    b += `<rect class="box" x="${r(x + 0.5)}" y="${chipY + 0.5}" width="${r(w - 1)}" height="${chipH - 1}" rx="${chipH / 2}" fill="${t.page}" stroke="${t.border}"/>`;
    b += text(x + w / 2, chipY + 19, c, { cls: "s t", anchor: "middle", size: 13.5 });
  }
  const rc = { x: bIn, y: TOP + 356, w: bW, h: 54 };
  b += `<rect class="box" x="${rc.x + 0.5}" y="${rc.y + 0.5}" width="${rc.w - 1}" height="${rc.h - 1}" rx="8" fill="${t.page}" stroke="${t.border}"/>`;
  b += receiptIcon(rc.x + 14, rc.y + 14, t.secondary);
  const rtX = rc.x + 44, rtW = rc.x + rc.w - 12 - rtX;
  const r1 = "model · request id · tokens", r2 = "cost · latency (no request text)";
  fit("receipt: " + r1, { size: 14 }, rtW, where);
  fit(r2, { size: 14 }, rtW, where);
  b += text(rtX, rc.y + 22, `<tspan class="t" font-weight="600">receipt:</tspan> ${esc(r1)}`, { cls: "s t2", size: 14, raw: true });
  b += text(rtX, rc.y + 42, r2, { cls: "s t2", size: 14 });
  const cIn = C.x + 18, cTextX = cIn + 30, cW = C.r - 18 - cTextX;
  b += badge(cIn, TOP + 104, 4);
  ["POST /v1/systemone", "jev-1.13.0"].forEach((s, i) => {
    fit(s, { size: 14, mono: true }, cW, where);
    b += text(cTextX, TOP + 104 + i * 24, s, { cls: `m ${i ? "t2" : "t"}`, size: 14 });
  });
  const cFacts = [
    ["Noul · Choice · Score", "→ probabilities", TOP + 184],
    ["$0.042 per M input tokens", "output free", TOP + 264]
  ];
  for (const [l1, l2, y] of cFacts) {
    fit(l1, { size: 16 }, cW, where);
    fit(l2, { size: 15 }, cW, where);
    b += text(cTextX, y, l1, { cls: "s t", size: 16 });
    b += text(cTextX, y + 23, l2, { cls: "s t2", size: 15 });
  }
  const LANE_T = 50, LANE_B = 528, rad = 10, head = 10;
  const arrow = (x1, x2, down, label) => {
    const yEdge = down ? TOP : BOT, lane = down ? LANE_T : LANE_B;
    const s = down ? 1 : -1;
    const dir = Math.sign(x2 - x1);
    const tipY = yEdge, endY = yEdge - s * head;
    const d = `M${x1} ${yEdge}V${lane + s * rad}Q${x1} ${lane} ${x1 + dir * rad} ${lane}H${x2 - dir * rad}Q${x2} ${lane} ${x2} ${lane + s * rad}V${endY}`;
    let o = `<path class="arrow" d="${d}" fill="none" stroke="${shaft}" stroke-width="1.5"/>`;
    o += `<path d="M${x2} ${tipY}L${x2 - 5.5} ${endY - s * 1}L${x2 + 5.5} ${endY - s * 1}Z" fill="${t.accent}"/>`;
    const lx = (x1 + x2) / 2, ly = down ? lane - 11 : lane + 22;
    fit(label, { size: 14.5 }, 300, where);
    o += text(lx, ly, label, { cls: "s t2", anchor: "middle", size: 14.5 });
    return o;
  };
  const inset = 44;
  b += arrow(A.r - inset, B.x + inset, true, "hook events · CLI calls");
  b += arrow(B.r - inset, C.x + inset, true, "one batched request");
  b += arrow(C.x + inset, B.r - inset, false, "probabilities");
  b += arrow(B.x + inset, A.r - inset, false, "silent · note · JSON");
  const bandY = 574, bandH = 70;
  const halves = [
    { x: 12, w: 500, icon: lockIcon, lead: "Stays on your machine:", rest: " receipts · answer cache" },
    { x: 524, w: 664, icon: leaveIcon, lead: "Leaves your machine:", rest: " questions + redacted input (US-hosted API)" }
  ];
  for (const h of halves) {
    b += `<rect class="box" x="${h.x + 0.5}" y="${bandY + 0.5}" width="${h.w - 1}" height="${bandH - 1}" rx="12" fill="${t.raised}" stroke="${t.border}"/>`;
    b += h.icon(h.x + 20, bandY + 25, t.secondary);
    const tx = h.x + 52, tw = h.x + h.w - 18 - tx;
    const nw = need(h.lead, { size: 15.5, weight: 600 }) + need(h.rest, { size: 15.5 });
    if (nw > tw) problems.push(`${where}: band "${h.lead}${h.rest}" needs ${nw.toFixed(1)}px, has ${tw.toFixed(1)}px`);
    b += text(tx, bandY + 41, `<tspan class="t" font-weight="600">${esc(h.lead)}</tspan>${esc(h.rest)}`, { cls: "s t2", size: 15.5, raw: true });
  }
  const css = `.t{fill:${t.text}}.t2{fill:${t.secondary}}.ac{fill:${t.accent}}`;
  return svgDoc({
    w: W,
    h: H,
    id: "referee-how",
    css,
    body: b,
    title: "How claude-referee works",
    desc: "Three columns. Claude Code session: SessionStart gives a short local briefing of at most 800 characters; from v0.2, Stop asks whether the work is really done and a model switch triggers a local cache guard; Claude can run the judge, decide, verify or done commands. Hook events and CLI calls go to claude-referee, which runs on your machine: 1 parse evidence in code (test runners, linters; from v0.2), 2 stop requests that contain secrets and redact personal data, 3 batch the pack's questions into one request. One batched request goes to the TypeSafe Jev API: 4 POST /v1/systemone with model jev-1.13.0; Noul, Choice and Score questions return probabilities; $0.042 per million input tokens, output free. Probabilities come back to claude-referee: 5 threshold the probabilities, giving one of three outcomes: silent, a note of at most 300 characters, or a compact JSON verdict, which go back to Claude. Each call leaves a receipt with model, request id, tokens, cost and latency, and no request text. Stays on your machine: receipts and the answer cache. Leaves your machine: questions and redacted input (US-hosted API)."
  });
}
function receiptIcon(x, y, c) {
  return `<path d="M${x + 2} ${y + 1}h12v16l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z M${x + 5} ${y + 6}h6 M${x + 5} ${y + 10}h6" fill="none" stroke="${c}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`;
}
function lockIcon(x, y, c) {
  return `<rect x="${x + 1.5}" y="${y + 8}" width="15" height="11" rx="2.5" fill="none" stroke="${c}" stroke-width="1.6"/><path d="M${x + 5} ${y + 8}V${y + 5.5}a4 4 0 0 1 8 0V${y + 8}" fill="none" stroke="${c}" stroke-width="1.6"/>`;
}
function leaveIcon(x, y, c) {
  return `<path d="M${x + 8} ${y + 3}H${x + 3.5}a2 2 0 0 0-2 2V${y + 17}a2 2 0 0 0 2 2H${x + 15.5}a2 2 0 0 0 2-2V${y + 12.5}M${x + 11} ${y + 1.5}H${x + 19}V${y + 9.5}M${x + 19} ${y + 1.5}L${x + 9.5} ${y + 11}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
}
const COST_ROWS = [
  { label: "Hook, nothing found (stays silent)", value: 0, ours: true, text: "$0" },
  { label: "Hook adds a 300-char note", value: 4e-4, ours: true, text: "$0.0004" },
  { label: "Haiku prompt hook (for comparison)", value: 2e-3, ours: false, text: "$0.002" },
  { label: "CLI call, flags only", value: 0.012, ours: true, text: "$0.012" },
  { label: "CLI call, JSON via heredoc (decide)", value: 0.017, ours: true, text: "up to $0.017" },
  { label: "MCP tool call", value: 0.017, ours: false, text: "$0.017" },
  { label: "CLI call after writing a request file", value: 0.028, ours: false, text: "$0.028" }
];
function cost(theme) {
  const t = THEMES[theme];
  const W = 880, M = 24;
  const where = `cost-${theme}`;
  let b = "";
  const title = "What one judgement costs on the Claude side";
  const subtitle = "Modelled for Opus 5.5 with 50K tokens of cached context. The Jev request itself adds $0.0001–0.0003.";
  fit(title, { size: 19, weight: 600 }, W - 2 * M, where);
  fit(subtitle, { size: 14 }, W - 2 * M, where);
  b += text(M, 38, title, { cls: "s t", size: 19, weight: 600 });
  b += text(M, 62, subtitle, { cls: "s t2", size: 14 });
  const legend = [
    [t.accent, "claude-referee's default paths"],
    [t.other, "other ways to call a judge"]
  ];
  let lx = M;
  for (const [c, label] of legend) {
    b += `<rect x="${lx}" y="82" width="12" height="12" rx="3" fill="${c}"/>`;
    const lw = fit(label, { size: 13.5 }, 300, where);
    b += text(lx + 19, 92.5, label, { cls: "s t", size: 13.5 });
    lx += 19 + lw + 20;
  }
  const X0 = 314, X1 = 828, MAX = 0.03;
  const x = (v) => X0 + v / MAX * (X1 - X0);
  const PT = 120, PITCH = 40, BAR = 14;
  const PB = PT + PITCH * COST_ROWS.length;
  const H = PB + 80;
  const labelRight = X0 - 14;
  const gx = (v) => Math.round(x(v)) + 0.5;
  for (const v of [0.01, 0.02, 0.03]) b += `<path d="M${gx(v)} ${PT}V${PB}" stroke="${t.grid}"/>`;
  b += `<path d="M${X0 + 0.5} ${PT}V${PB}" stroke="${t.border}"/>`;
  const ticks = [[0, "$0"], [0.01, "$0.01"], [0.02, "$0.02"], [0.03, "$0.03"]];
  for (const [v, label] of ticks) {
    fit(label, { size: 13 }, 60, where);
    b += text(v === 0 ? X0 + 0.5 : gx(v), PB + 24, label, { cls: "s t2 num", anchor: "middle", size: 13 });
  }
  COST_ROWS.forEach((row, i) => {
    const cy = PT + PITCH * i + PITCH / 2;
    fit(row.label, { size: 14 }, labelRight - M, where);
    let g = `<g><title>${esc(`${row.label}: ${row.text} (${row.ours ? "claude-referee's default path" : "other way to call a judge"})`)}</title>`;
    g += text(labelRight, cy + 5, row.label, { cls: "s t", anchor: "end", size: 14 });
    let end = X0;
    if (row.value > 0) {
      end = x(row.value);
      const y = cy - BAR / 2, k = Math.min(4, end - X0, BAR / 2);
      g += `<path class="bar" d="M${X0 + 1} ${r(y)}H${r(end - k)}A${k} ${k} 0 0 1 ${r(end)} ${r(y + k)}V${r(y + BAR - k)}A${k} ${k} 0 0 1 ${r(end - k)} ${r(y + BAR)}H${X0 + 1}Z" fill="${row.ours ? t.accent : t.other}"/>`;
    }
    fit(row.text, { size: 14 }, W - M - (end + 8), where);
    g += text(end + 8, cy + 5, row.text, { cls: "s t halo", size: 14 });
    b += g + "</g>";
  });
  const fnLead = "Modelled, not measured. Measure yours: /usage in Claude Code; Jev side: ";
  const fnCmd = "npx claude-referee receipts --usage";
  const fnW = need(fnLead, { size: 13 }) + need(fnCmd, { size: 12.5, mono: true });
  if (fnW > W - 2 * M) problems.push(`${where}: footnote needs ${fnW.toFixed(1)}px`);
  b += text(M, PB + 62, `${esc(fnLead)}<tspan class="m" font-size="12.5">${esc(fnCmd)}</tspan>`, { cls: "s t2", size: 13, raw: true });
  const css = `.t{fill:${t.text}}.t2{fill:${t.secondary}}.num{font-variant-numeric:tabular-nums}.halo{paint-order:stroke;stroke:${t.page};stroke-width:5px;stroke-linejoin:round}`;
  return svgDoc({
    w: W,
    h: H,
    id: "referee-cost",
    css,
    body: b,
    title,
    desc: `${subtitle} Horizontal bar chart, US dollars per judgement on the Claude side. ` + COST_ROWS.map((row) => `${row.label}: ${row.text} (${row.ours ? "claude-referee's default path" : "other way to call a judge"}).`).join(" ") + ` ${fnLead}${fnCmd}.`
  });
}
const builders = { hero, how, cost };
const only = process.argv[2];
for (const [name, fn] of Object.entries(builders)) {
  if (only && only !== name) continue;
  for (const theme of ["light", "dark"]) {
    const file = path.join(OUT, `${name === "how" ? "how-it-works" : name}-${theme}.svg`);
    fs.writeFileSync(file, fn(theme));
    console.log(`wrote ${path.relative(path.join(here, ".."), file)} (${fs.statSync(file).size} bytes)`);
  }
}
if (problems.length) {
  console.error(`
${problems.length} text fit problem(s):
  ` + problems.join("\n  "));
  process.exit(1);
}
console.log("text fit: all strings fit with 12% slack and in DejaVu");
export {
  COST_ROWS
};
