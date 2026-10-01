// Offline, seeded Monte Carlo that calibrates the K3 breach cutoff c(n) through the real analyzeDecision/evaluateK3 pipeline; --emit writes the table into order-analysis.mjs, --power measures power.
// Assumes independent Gaussian noise, equal noise in all arms and independent decisions. No API, no network.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { K3_ALPHA, K3_CAL_MAX_N, K3_CAL_MIN_N, analyzeDecision, breachCutoff, evaluateK3, le, permutations } from "./order-analysis.mjs";

export const TABLE_LINE = /^export const K3_CUTOFFS = .*$/gm;
export const NAMES = ["a", "b", "c", "d"];
export const LEADER_MAX = 0.6;
export const DEFAULTS = {
  seed: 20261001,
  trials: 2000,
  nMin: K3_CAL_MIN_N,
  nMax: K3_CAL_MAX_N,
  sigmas: [0.01, 0.02, 0.03],
  alphas: [1.5, 3, 8],
  powerN: 39,
  shifts: [0, 0.05, 0.1],
};

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const ANALYSIS = resolve(here, "order-analysis.mjs");
const CUTOFFS_JSON = resolve(repoRoot, "jev-evals/decide-close/k3-cutoffs.json");
const POWER_JSON = resolve(repoRoot, "jev-evals/decide-close/k3-power.json");
const ORDERS = permutations(NAMES);

export function seededRandom(seed) {
  let s = seed >>> 0;
  const u = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
  const gamma = (a) => {
    if (a < 1) return gamma(a + 1) * Math.pow(u(), 1 / a);
    const d = a - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x;
      let v;
      do {
        x = normal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const r = u();
      if (Math.log(r) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
    }
  };
  return { u, normal, gamma };
}

export function cellSeed(seed, ...parts) {
  let h = 0x811c9dc5;
  for (const ch of [seed, ...parts].join("|")) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return h;
}

const renormalise = (v) => {
  const clipped = v.map((x) => Math.min(1, Math.max(0, x)));
  const total = clipped.reduce((a, b) => a + b, 0);
  return Object.fromEntries(NAMES.map((n, i) => [n, clipped[i] / total]));
};

function trueVector(R, alpha) {
  for (;;) {
    const g = NAMES.map(() => R.gamma(alpha));
    const total = g.reduce((a, b) => a + b, 0);
    const t = g.map((x) => x / total);
    if (Math.max(...t) < LEADER_MAX) return t;
  }
}

function answer(R, truth, sigma, shift = 0) {
  const noisy = truth.map((x) => x + sigma * R.normal());
  return renormalise(shift ? noisy.map((x, i) => (i === 1 ? x + shift : x - shift / 3)) : noisy);
}

export function simulateDecisions(R, count, sigma, alpha, shift = 0) {
  return Array.from({ length: count }, (_, i) => {
    const truth = trueVector(R, alpha);
    return analyzeDecision(`d${i}`, NAMES, {
      orders: ORDERS.map((order) => ({ order, p: answer(R, truth, sigma) })),
      reask: answer(R, truth, sigma),
      pair: { written: answer(R, truth, sigma, shift), reversed: answer(R, truth, sigma, shift) },
    });
  });
}

export function simulateCell({ seed, sigma, alpha, trials, nMin, nMax, shift = 0 }) {
  const R = seededRandom(cellSeed(seed, "cal", sigma, alpha));
  const byN = new Map();
  for (let n = nMin; n <= nMax; n++) byN.set(n, { conclusive: 0, hist: new Array(n + 1).fill(0), leaderFailHist: new Array(n + 1).fill(0) });
  for (let t = 0; t < trials; t++) {
    const decisions = simulateDecisions(R, nMax, sigma, alpha, shift);
    for (let n = nMin; n <= nMax; n++) {
      const k3 = evaluateK3(decisions.slice(0, n));
      if (k3.noisy) continue;
      const cell = byN.get(n);
      cell.conclusive++;
      cell.hist[k3.breach_condition.breaches]++;
      if (k3.leader_condition.status === "fail") cell.leaderFailHist[k3.breach_condition.breaches]++;
    }
  }
  return byN;
}

const sum = (xs, from, to) => xs.slice(from, to).reduce((a, b) => a + b, 0);
const tailCount = (cell, c) => sum(cell.hist, c + 1);
export const tailRate = (cell, c) => (cell.conclusive ? tailCount(cell, c) / cell.conclusive : 0);
export const verdictFailRate = (cell, c) => (cell.conclusive ? (tailCount(cell, c) + sum(cell.leaderFailHist, 0, c + 1)) / cell.conclusive : 0);
const r6 = (x) => Number(x.toFixed(6));

export function chooseCutoff(cells, n) {
  const usable = cells.filter((cell) => cell.byN.get(n).conclusive > 0);
  for (let c = 0; c <= n; c++) if (usable.every((cell) => le(tailRate(cell.byN.get(n), c), K3_ALPHA))) return c;
  return n;
}

export function fingerprint(file = ANALYSIS) {
  const text = readFileSync(file, "utf8").replace(TABLE_LINE, "");
  return { file: "scripts/order-analysis.mjs", excludes: "the K3_CUTOFFS line", bytes: Buffer.byteLength(text), sha256: createHash("sha256").update(text).digest("hex") };
}

export function calibrate(opts) {
  const { seed, trials, nMin, nMax, sigmas, alphas } = opts;
  const cells = [];
  for (const alpha of alphas) for (const sigma of sigmas) cells.push({ sigma, alpha, byN: simulateCell({ seed, sigma, alpha, trials, nMin, nMax }) });
  const cutoffs = {};
  const worstBreachTail = {};
  const worstVerdictFail = {};
  const worstCell = {};
  const minConclusive = {};
  for (let n = nMin; n <= nMax; n++) {
    const c = chooseCutoff(cells, n);
    cutoffs[n] = c;
    let worst = null;
    for (const cell of cells) {
      const stats = cell.byN.get(n);
      const tail = tailRate(stats, c);
      if (!worst || tail > worst.tail) worst = { tail, sigma: cell.sigma, alpha: cell.alpha };
    }
    worstBreachTail[n] = r6(worst.tail);
    worstCell[n] = { sigma: worst.sigma, alpha: worst.alpha };
    worstVerdictFail[n] = r6(Math.max(...cells.map((cell) => verdictFailRate(cell.byN.get(n), c))));
    minConclusive[n] = Math.min(...cells.map((cell) => cell.byN.get(n).conclusive));
  }
  return {
    purpose: "K3 breach cutoff c(n): smallest c with P(X > c | conclusive) <= 0.05 in every grid cell, X = breach count from evaluateK3",
    seed,
    trials_per_cell: trials,
    grid: { n: [nMin, nMax], sigma: sigmas, alpha: alphas, leader_max: LEADER_MAX },
    model: "true vector Dirichlet(alpha) with leader below leader_max by rejection; 24 order answers, re-ask and two same-request answers = true vector plus independent N(0, sigma) per option, clipped to [0, 1] and renormalised; no systematic shift",
    conclusive: "re-ask p95 not above 0.10 (evaluateK3 noisy = false)",
    sampling: "each trial draws n_max decisions once; n uses the first n of them, so each n is exactly distributed but cutoffs for different n share random numbers",
    selection: "worst case over all sigma and alpha cells, estimated in-sample; the estimate has Monte Carlo error of roughly 0.005 per cell",
    analysis: fingerprint(),
    cutoffs,
    worst_case_breach_tail: worstBreachTail,
    worst_case_verdict_fail: worstVerdictFail,
    worst_case_cell: worstCell,
    min_conclusive: minConclusive,
    cells: cells.map((cell) => ({
      sigma: cell.sigma,
      alpha: cell.alpha,
      conclusive: Object.fromEntries([...cell.byN].map(([n, s]) => [n, s.conclusive])),
      breach_tail_at_cutoff: Object.fromEntries([...cell.byN].map(([n, s]) => [n, r6(tailRate(s, cutoffs[n]))])),
    })),
  };
}

export function emitLine(cutoffs) {
  return `export const K3_CUTOFFS = { ${Object.entries(cutoffs).map(([n, c]) => `${n}: ${c}`).join(", ")} };`;
}

export function emit(jsonFile, target = ANALYSIS) {
  const { cutoffs } = JSON.parse(readFileSync(jsonFile, "utf8"));
  const source = readFileSync(target, "utf8");
  const matches = source.match(TABLE_LINE) ?? [];
  if (matches.length !== 1) throw new Error(`${target}: expected exactly one K3_CUTOFFS line, found ${matches.length}`);
  const line = emitLine(cutoffs);
  writeFileSync(target, source.replace(TABLE_LINE, () => line));
  return line;
}

export function power({ seed, trials, sigmas, alphas, shifts, n }) {
  if (breachCutoff(n) === null) throw new Error(`no cutoff for n = ${n} in order-analysis.mjs; run --emit first`);
  const rows = [];
  for (const shift of shifts) {
    for (const alpha of alphas) {
      for (const sigma of sigmas) {
        const R = seededRandom(cellSeed(seed, "power", sigma, alpha, shift));
        let fail = 0;
        let inconclusive = 0;
        let breachFail = 0;
        let leaderFail = 0;
        for (let t = 0; t < trials; t++) {
          const k3 = evaluateK3(simulateDecisions(R, n, sigma, alpha, shift));
          if (k3.noisy) {
            inconclusive++;
            continue;
          }
          if (k3.verdict === "fail") fail++;
          if (k3.breach_condition.pass === false) breachFail++;
          if (k3.leader_condition.status === "fail") leaderFail++;
        }
        const conclusive = trials - inconclusive;
        rows.push({
          shift,
          alpha,
          sigma,
          trials,
          conclusive,
          inconclusive_rate: r6(inconclusive / trials),
          fail_given_conclusive: conclusive ? r6(fail / conclusive) : null,
          breach_fail_given_conclusive: conclusive ? r6(breachFail / conclusive) : null,
          leader_fail_given_conclusive: conclusive ? r6(leaderFail / conclusive) : null,
          fail_over_all_trials: r6(fail / trials),
        });
      }
    }
  }
  return {
    purpose: "K3 power: rate of verdict fail at a systematic shift on option b of the same-request answers (+shift on b, -shift/3 on the others, before clipping); shift 0 is the false-FAIL check of the whole rule",
    seed,
    trials_per_cell: trials,
    n,
    cutoff_used: breachCutoff(n),
    grid: { shift: shifts, sigma: sigmas, alpha: alphas },
    analysis: fingerprint(),
    rows,
  };
}

const list = (s) => s.split(",").map(Number);

function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      seed: { type: "string" },
      trials: { type: "string" },
      "n-min": { type: "string" },
      "n-max": { type: "string" },
      sigmas: { type: "string" },
      alphas: { type: "string" },
      shifts: { type: "string" },
      n: { type: "string" },
      out: { type: "string" },
      in: { type: "string" },
      target: { type: "string" },
      emit: { type: "boolean", default: false },
      power: { type: "boolean", default: false },
    },
    strict: true,
  });
  if (values.emit && values.power) throw new Error("--emit and --power are separate modes");
  const seed = values.seed === undefined ? DEFAULTS.seed : Number(values.seed);
  const trials = values.trials === undefined ? DEFAULTS.trials : Number(values.trials);
  const sigmas = values.sigmas ? list(values.sigmas) : DEFAULTS.sigmas;
  const alphas = values.alphas ? list(values.alphas) : DEFAULTS.alphas;
  if (![seed, trials, ...sigmas, ...alphas].every(Number.isFinite) || !Number.isInteger(trials) || trials < 1) throw new Error("bad numeric flag");
  if (values.emit) {
    const line = emit(resolve(values.in ?? CUTOFFS_JSON), values.target ? resolve(values.target) : ANALYSIS);
    console.log(line);
    return;
  }
  if (values.power) {
    const result = power({ seed, trials, sigmas, alphas, shifts: values.shifts ? list(values.shifts) : DEFAULTS.shifts, n: values.n === undefined ? DEFAULTS.powerN : Number(values.n) });
    writeFileSync(resolve(values.out ?? POWER_JSON), `${JSON.stringify(result, null, 2)}\n`);
    for (const r of result.rows) console.log(`shift ${r.shift}  alpha ${r.alpha}  sigma ${r.sigma}  FAIL|conclusive ${r.fail_given_conclusive}  (breach ${r.breach_fail_given_conclusive}, leader ${r.leader_fail_given_conclusive})  inconclusive ${r.inconclusive_rate}`);
    return;
  }
  const nMin = values["n-min"] === undefined ? DEFAULTS.nMin : Number(values["n-min"]);
  const nMax = values["n-max"] === undefined ? DEFAULTS.nMax : Number(values["n-max"]);
  if (!Number.isInteger(nMin) || !Number.isInteger(nMax) || nMin < 1 || nMax < nMin) throw new Error("bad n range");
  const result = calibrate({ seed, trials, nMin, nMax, sigmas, alphas });
  writeFileSync(resolve(values.out ?? CUTOFFS_JSON), `${JSON.stringify(result, null, 2)}\n`);
  console.log("n   c   worst P(X>c | conclusive)   worst P(FAIL | conclusive)   min conclusive   worst cell (sigma, alpha)");
  for (const n of Object.keys(result.cutoffs)) {
    const cell = result.worst_case_cell[n];
    console.log(`${n}  ${result.cutoffs[n]}   ${result.worst_case_breach_tail[n]}   ${result.worst_case_verdict_fail[n]}   ${result.min_conclusive[n]}   (${cell.sigma}, ${cell.alpha})`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
