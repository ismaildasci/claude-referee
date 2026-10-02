// The pilot rule of the A/B: from the no-gate pilot sessions it picks the repetitions per task of the full run, or says the full run must not start.
// Formula and limits are registered in bench/PREREG.md; nothing here is tuned after the data.

import { isUsable } from "./report.mjs";
import { requiredN } from "./stats.mjs";

export const FULL_CAP_USD = 40;
export const PILOT_CAP_USD = 8;
export const DRY_CAP_USD = 2;
export const REPS_MAX = 6;
export const COST_SAFETY = 1.5;
export const MIN_PILOT_EVENTS = 1;

export function sizeFromPilot(grounds, { cases = 16, tasks = 20, arms = 4, capUsd = FULL_CAP_USD, repsMax = REPS_MAX } = {}) {
  const rows = grounds.filter((g) => g.arm === "nogate" && isUsable(g));
  const caseRows = rows.filter((g) => g.role === "case");
  const events = caseRows.filter((g) => g.class === "wrong_done").length;
  const p0 = caseRows.length ? events / caseRows.length : 0;
  const meanCost = grounds.length ? grounds.reduce((s, g) => s + (g.cost_usd ?? 0), 0) / grounds.length : 0;
  const repsAffordable = meanCost > 0 ? Math.min(repsMax, Math.floor(capUsd / (arms * tasks * meanCost * COST_SAFETY))) : 0;
  const nNeeded = requiredN(p0, cases * repsMax);
  const repsNeeded = nNeeded === null ? null : Math.ceil(nNeeded / cases);
  const base = { pilot_case_sessions: caseRows.length, pilot_events: events, p0: Math.round(p0 * 1000) / 1000, mean_cost_usd: Math.round(meanCost * 10000) / 10000, reps_affordable: repsAffordable, n_per_arm_needed: nNeeded, reps_needed: repsNeeded };
  if (events < MIN_PILOT_EVENTS) return { ...base, decision: "stop", reason: `fewer than ${MIN_PILOT_EVENTS} wrong done in the pilot: the case set cannot show a difference at an affordable size; publish the pilot as the result` };
  if (repsAffordable < 2) return { ...base, decision: "stop", reason: "fewer than 2 repetitions fit the cost cap" };
  if (repsNeeded === null || repsNeeded > repsAffordable) return { ...base, reps: repsAffordable, decision: "run_underpowered", reason: "the needed N does not fit the cap or the repetition limit; run the affordable repetitions and report the primary outcome as underpowered with its minimum detectable difference" };
  return { ...base, reps: Math.max(2, repsNeeded), decision: "run", reason: "the needed N fits the cap" };
}
