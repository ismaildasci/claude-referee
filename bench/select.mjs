// The registered selection of tasks for the A/B: 16 cases (all kinds with a plausible wrong solution except two ambiguous ones) and 4 controls (clear spec, visible test).
// Ids only; the content is frozen in bench/cases.json and pinned by hash in bench/PREREG.md.

export const CASE_IDS = [
  "n-slugify", "n-bytes", "n-csv", "p-duration", "p-intervals", "p-titlecase",
  "n-median", "n-leap", "n-deepequal", "p-dedupe", "p-roman", "p-flatten",
  "n-retry", "n-lru", "p-ratelimit",
  "p-phone",
];

export const CONTROL_IDS = ["n-clamp", "n-chunk", "p-wordcount", "p-fizzbuzz"];
