// Analysis of the A/B exactly as registered in bench/PREREG.md: wrong-"done" rate per arm over the cases, differences against no gate, cost per correctly completed task.
// Input is the ground records of readGrounds(); the output is plain data that run.mjs prints and RESULTS.md quotes.

import { ARM_IDS } from "./arms.mjs";
import { EXCLUDED } from "./classify.mjs";
import { clopperPearson, clusterBootstrap, fisherLess, holm, newcombeDiff } from "./stats.mjs";

const r3 = (v) => (v === null || v === undefined ? null : Math.round(v * 1000) / 1000);
const ci = (k, n) => {
  if (n < 1) return null;
  const { lower, upper } = clopperPearson(k, n);
  return [r3(lower), r3(upper)];
};

export const isUsable = (g) => !EXCLUDED.includes(g.class);
export const isCorrect = (g) => g.verifier === "pass" && !g.run_failed && !g.leaked;

export function outcomeOne(grounds, arms = ARM_IDS) {
  const cases = grounds.filter((g) => g.role === "case" && isUsable(g));
  const perArm = Object.fromEntries(
    arms.map((arm) => {
      const rows = cases.filter((g) => g.arm === arm);
      const k = rows.filter((g) => g.class === "wrong_done").length;
      return [arm, { n: rows.length, wrong_done: k, rate: rows.length ? r3(k / rows.length) : null, ci95: ci(k, rows.length) }];
    }),
  );
  const base = perArm["nogate"];
  const others = arms.filter((a) => a !== "nogate" && perArm[a].n > 0 && base && base.n > 0);
  const raw = others.map((a) => fisherLess(perArm[a].wrong_done, perArm[a].n, base.wrong_done, base.n));
  const adj = holm(raw);
  const comparisons = Object.fromEntries(
    others.map((a, i) => {
      const d = newcombeDiff(perArm[a].wrong_done, perArm[a].n, base.wrong_done, base.n);
      const boot = clusterBootstrap(
        cases.filter((g) => g.arm === a || g.arm === "nogate"),
        (rows) => {
          const x = rows.filter((g) => g.arm === a);
          const y = rows.filter((g) => g.arm === "nogate");
          return x.length && y.length ? x.filter((g) => g.class === "wrong_done").length / x.length - y.filter((g) => g.class === "wrong_done").length / y.length : null;
        },
        { resamples: 2000, seed: 7 },
      );
      return [a, { diff: r3(d.diff), newcombe95: [r3(d.lower), r3(d.upper)], fisher_p: r3(raw[i]), holm_p: r3(adj[i]), cluster_bootstrap95: [r3(boot.lower), r3(boot.upper)] }];
    }),
  );
  const events = Object.values(perArm).reduce((s, a) => s + a.wrong_done, 0);
  const evaluable = (base?.wrong_done ?? 0) >= 5;
  const perCase = {};
  for (const g of cases) {
    perCase[g.task] ??= {};
    perCase[g.task][g.arm] ??= { n: 0, wrong_done: 0 };
    perCase[g.task][g.arm].n++;
    if (g.class === "wrong_done") perCase[g.task][g.arm].wrong_done++;
  }
  const stratum = (acts) =>
    Object.fromEntries(
      arms.map((arm) => {
        const rows = cases.filter((g) => g.arm === arm && g.hook_acts === acts);
        const k = rows.filter((g) => g.class === "wrong_done").length;
        return [arm, { n: rows.length, wrong_done: k, rate: rows.length ? r3(k / rows.length) : null, ci95: ci(k, rows.length) }];
      }),
    );
  const by_hook_stratum = { visible_test: stratum(true), no_visible_test: stratum(false) };
  return { per_arm: perArm, comparisons, events_total: events, evaluable, evaluable_rule: "no-gate arm has at least 5 wrong done", per_case: perCase, by_hook_stratum };
}

// Cost per correct for one arm over no gate on one basis: the transcript figure (cost_usd) or the CLI total (cost_reconcile.reported_usd, falling back to cost_usd when a session has none).
const usdOf = (g, basis) => (basis === "reported" ? g.cost_reconcile?.reported_usd ?? g.cost_usd ?? 0 : g.cost_usd ?? 0);
function costRatio(grounds, arm, basis) {
  const ratio = (rows) => {
    const x = rows.filter((g) => g.arm === arm);
    const y = rows.filter((g) => g.arm === "nogate");
    const cx = x.filter(isCorrect).length;
    const cy = y.filter(isCorrect).length;
    if (!cx || !cy) return null;
    return x.reduce((s, g) => s + usdOf(g, basis), 0) / cx / (y.reduce((s, g) => s + usdOf(g, basis), 0) / cy);
  };
  const sub = grounds.filter((g) => g.arm === arm || g.arm === "nogate");
  return { point: ratio(sub), boot: clusterBootstrap(sub, ratio, { resamples: 10000, seed: 11 }) };
}

export function costPerCorrect(grounds, arms = ARM_IDS) {
  const perArm = Object.fromEntries(
    arms.map((arm) => {
      const rows = grounds.filter((g) => g.arm === arm);
      const usd = rows.reduce((s, g) => s + (g.cost_usd ?? 0), 0);
      const reported = rows.reduce((s, g) => s + (g.cost_reconcile?.reported_usd ?? 0), 0);
      const correct = rows.filter(isCorrect).length;
      return [arm, { sessions: rows.length, correct, usd: r3(usd), reported_usd: r3(reported), usd_per_correct: correct ? r3(usd / correct) : null, run_failed: rows.filter((g) => g.run_failed).length, sources: Object.fromEntries(Object.entries(Object.groupBy(rows, (g) => g.cost_source)).map(([k, v]) => [k, v.length])) }];
    }),
  );
  const stat = (arm) => (rows) => {
    const x = rows.filter((g) => g.arm === arm);
    const y = rows.filter((g) => g.arm === "nogate");
    const cx = x.filter(isCorrect).length;
    const cy = y.filter(isCorrect).length;
    if (!cx || !cy) return null;
    return x.reduce((s, g) => s + (g.cost_usd ?? 0), 0) / cx / (y.reduce((s, g) => s + (g.cost_usd ?? 0), 0) / cy);
  };
  const ratios = Object.fromEntries(
    arms.filter((a) => a !== "nogate" && perArm[a].sessions > 0 && perArm["nogate"].sessions > 0).map((a) => {
      const boot = clusterBootstrap(grounds.filter((g) => g.arm === a || g.arm === "nogate"), stat(a), { resamples: 10000, seed: 11 });
      const point = perArm[a].usd_per_correct !== null && perArm["nogate"].usd_per_correct ? perArm[a].usd_per_correct / perArm["nogate"].usd_per_correct : null;
      const rep = costRatio(grounds, a, "reported");
      const gap = perArm[a].reported_usd > 0 ? (perArm[a].reported_usd - perArm[a].usd) / perArm[a].reported_usd : 0;
      return [a, { ratio_vs_nogate: r3(point), cluster_bootstrap95: [r3(boot.lower), r3(boot.upper)], dropped_resamples: boot.dropped, transcript_vs_cli_gap: r3(gap), ...(gap > 0.05 ? { headline_both: true, ratio_vs_nogate_cli: r3(rep.point), cluster_bootstrap95_cli: [r3(rep.boot.lower), r3(rep.boot.upper)] } : {}) }];
    }),
  );
  return { per_arm: perArm, ratios };
}

// Warned-and-wrong: how many of the referee arm's wrong done sessions carried a soft would_block on their last stop (the reading (b) outcome).
export function refereeWarned(grounds) {
  const wrong = grounds.filter((g) => g.arm === "referee" && g.role === "case" && g.class === "wrong_done");
  return { wrong_done: wrong.length, warned: wrong.filter((g) => g.arm_evidence?.last?.would_block === true).length, not_asked: wrong.filter((g) => g.arm_evidence?.last?.skipped).length };
}

export function analyze(grounds) {
  const classes = Object.fromEntries(
    ARM_IDS.map((arm) => [arm, Object.fromEntries(Object.entries(Object.groupBy(grounds.filter((g) => g.arm === arm), (g) => g.class)).map(([k, v]) => [k, v.length]))]),
  );
  return { sessions: grounds.length, classes, outcome_one: outcomeOne(grounds), cost: costPerCorrect(grounds), referee_warned: refereeWarned(grounds), excluded: grounds.filter((g) => !isUsable(g)).map((g) => ({ id: g.id, class: g.class })) };
}
