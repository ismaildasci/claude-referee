// Session plans of the A/B: the pilot (no-gate arm only) and the full run, counterbalanced with a Williams square of arm orders and a seeded shuffle of blocks.
// A block is one task and one repetition with every arm run back to back in the row's order; the registered seed is in bench/PREREG.md.

import { ARM_IDS } from "./arms.mjs";
import { mulberry32 } from "./stats.mjs";

export const SEED = 20261002;
export const MODEL = "haiku";
export const PILOT_REPS = 2;
export const WILLIAMS_4 = [
  [0, 1, 3, 2],
  [1, 2, 0, 3],
  [2, 3, 1, 0],
  [3, 0, 2, 1],
];

export const sessionId = (task, arm, rep) => `${task}__${arm}__r${rep}`;

export function shuffle(items, rand) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Every task once per repetition, in a seeded order, all on the no-gate arm. The pilot measures the rate that sizes the full run.
export function planPilot({ taskIds, reps = PILOT_REPS, seed = SEED }) {
  const blocks = [];
  for (let rep = 1; rep <= reps; rep++) for (const task of taskIds) blocks.push({ task, rep });
  return shuffle(blocks, mulberry32(seed)).map((b, i) => ({ id: sessionId(b.task, "nogate", b.rep), task: b.task, arm: "nogate", rep: b.rep, model: MODEL, block: i, position: 0, stage: "pilot" }));
}

// Row of the Williams square for block (task index, rep): (rep + task index) mod 4, so each task meets different orders across repetitions and every row is used equally often.
export function planFull({ taskIds, reps, seed = SEED, arms = ARM_IDS }) {
  if (arms.length !== 4) throw new Error("the Williams square here is for exactly 4 arms");
  const blocks = [];
  for (let rep = 1; rep <= reps; rep++) taskIds.forEach((task, ti) => blocks.push({ task, rep, row: (rep + ti) % 4 }));
  const out = [];
  shuffle(blocks, mulberry32(seed)).forEach((b, block) => {
    (WILLIAMS_4[b.row] ?? []).forEach((armIndex, position) => {
      const arm = arms[armIndex];
      out.push({ id: sessionId(b.task, arm, b.rep), task: b.task, arm, rep: b.rep, model: MODEL, block, position, row: b.row, stage: "full" });
    });
  });
  return out;
}

// How often each arm sits at each position of a block; a balanced design gives every arm every position equally often.
export function positionCounts(plan) {
  const counts = {};
  for (const s of plan) {
    counts[s.arm] ??= [0, 0, 0, 0];
    counts[s.arm][s.position]++;
  }
  return counts;
}

// The harness dry run: one session per arm on one control task, in the registered arm order. It proves the plumbing and is never part of the data.
export function planDry({ task = "n-clamp", arms = ARM_IDS }) {
  return arms.map((arm, position) => ({ id: sessionId(task, arm, 1), task, arm, rep: 1, model: MODEL, block: 0, position, stage: "dry" }));
}
