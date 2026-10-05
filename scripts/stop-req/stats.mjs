// Statistics of the stop-requirements study (docs/decisions/stop-requirements-question.md): seeded summaries, paired AUC difference against A, within-task AUC, adoption rule.
// Builds on scripts/stop-state/stats.mjs; scores are oriented higher = more likely wrong done, rows look like {task, cls, score, model}.

import { auc, bootstrap, mulberry32, permutationP, rowsAuc } from "../stop-state/stats.mjs";

export { devThreshold, frac, tally } from "../stop-state/stats.mjs";
export const SEED = 20261006;
const r3 = (v) => (v === null || v === undefined ? null : Math.round(v * 1000) / 1000);

export function summarize(rows, { withBootstrap = true } = {}) {
  const wrong = rows.filter((r) => r.cls === "wrong_done").map((r) => r.score);
  const right = rows.filter((r) => r.cls === "true_done").map((r) => r.score);
  const a = auc(wrong, right);
  const out = { wrong: wrong.length, true: right.length, tasks: new Set(rows.map((r) => r.task)).size, auc: r3(a), perm_p: wrong.length && right.length ? permutationP(wrong, right) : null };
  if (withBootstrap && a !== null) {
    const t = bootstrap(rows, "task", { seed: SEED });
    const s = bootstrap(rows, "session", { seed: SEED });
    out.boot_task_ci95 = t.ci95?.map(r3) ?? null;
    out.boot_task_discarded = t.discarded;
    out.boot_session_ci95 = s.ci95?.map(r3) ?? null;
  }
  return out;
}

// Mean over tasks that hold both classes of the share of wrong-versus-true pairs of that task ranked correctly (ties half).
export function withinTaskAuc(rows) {
  const per = [];
  for (const task of new Set(rows.map((r) => r.task))) {
    const part = rows.filter((r) => r.task === task);
    const a = rowsAuc(part);
    if (a !== null) per.push(a);
  }
  return { tasks: per.length, auc: per.length ? r3(per.reduce((x, y) => x + y, 0) / per.length) : null };
}

// Paired task-bootstrap interval of AUC(rows) - AUC(base) over the sessions both have; `base` rows carry the same ids.
export function pairedDiff(rows, base, { resamples = 10000, seed = SEED } = {}) {
  const baseById = new Map(base.map((r) => [r.id, r.score]));
  const joined = rows.filter((r) => baseById.has(r.id)).map((r) => ({ ...r, other: baseById.get(r.id) }));
  const tasks = [...new Set(joined.map((r) => r.task))].sort();
  const byTask = new Map(tasks.map((t) => [t, joined.filter((r) => r.task === t)]));
  const rand = mulberry32(seed);
  const point = (list) => {
    const a = rowsAuc(list);
    const b = rowsAuc(list.map((r) => ({ ...r, score: r.other })));
    return a === null || b === null ? null : a - b;
  };
  const values = [];
  for (let i = 0; i < resamples; i++) {
    const d = point(Array.from({ length: tasks.length }, () => byTask.get(tasks[Math.floor(rand() * tasks.length)])).flat());
    if (d !== null) values.push(d);
  }
  values.sort((x, y) => x - y);
  const p = point(joined);
  return { diff: r3(p), ci95: values.length ? [r3(values[Math.floor(0.025 * values.length)]), r3(values[Math.ceil(0.975 * values.length) - 1])] : null };
}

// P1 to P4 on the fresh set; `sig` is 0.05 for the primary candidate and 0.025 for the secondary (two frozen candidates).
export function adoption({ summary, tally, baselineAuc, keywordB, sig = 0.05 }) {
  const wrong = summary.wrong;
  const right = summary.true;
  if (wrong < 5 || right < 15) return { judged: false, rules: {}, verdict: "not judged: underpowered" };
  const p1 = summary.boot_task_ci95 !== null && summary.boot_task_ci95[0] > 0.5;
  const p2 = summary.perm_p !== null && summary.perm_p <= sig;
  const p3 = tally.recall.value >= 0.7 && tally.false_block.value <= 0.5;
  const p4 = summary.auc > baselineAuc && tally.false_block.value < keywordB.false_block.value;
  const verdict = !(p1 && p2) ? "does not separate on this state: the signal of the contents study needed the code" : p3 && p4 ? "supported on this synthetic data: a proposal document may be written" : "separates, but not usefully";
  return { judged: true, rules: { P1: p1, P2: p2, P3: p3, P4: p4 }, verdict };
}
