// Pure helpers of the i18n real-code hold-out (docs/decisions/i18n-pack-eval.md, amendment of 2026-10-06).
// Tested in test/i18n-real-lib.test.ts.

export const LICENSES = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD"]);
export const MIN_STARS = 25;
export const PUSHED_SINCE = "2023-10-06T00:00:00Z";

export function metadataVerdict(m) {
  if (!m || m.gone) return { pass: false, why: "gone" };
  if (m.fork) return { pass: false, why: "fork" };
  if (m.archived) return { pass: false, why: "archived" };
  if (!LICENSES.has(m.license)) return { pass: false, why: "license" };
  if (!(m.stars >= MIN_STARS)) return { pass: false, why: "stars" };
  if (!(m.pushed_at >= PUSHED_SINCE)) return { pass: false, why: "pushed" };
  return { pass: true, why: "ok" };
}
