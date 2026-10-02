// Price table of the A/B cost accountant, USD per million tokens, copied by hand from https://platform.claude.com/docs/en/about-claude/pricing
// Fetched 2026-10-02 (the page carries no date). An unknown model id throws: a silent zero would hide a cost.

export const PRICING_SOURCE = { url: "https://platform.claude.com/docs/en/about-claude/pricing", fetched: "2026-10-02" };

// [input, 5m cache write, 1h cache write, cache read, output]
const ROWS = {
  "claude-fable-5-1": [10, 12.5, 20, 0.25, 50],
  "claude-mythos-5-1": [10, 12.5, 20, 0.25, 50],
  "claude-fable-5": [10, 12.5, 20, 1, 50],
  "claude-mythos-5": [10, 12.5, 20, 1, 50],
  "claude-opus-5-5": [4, 5, 8, 0.2, 20],
  "claude-opus-5": [5, 6.25, 10, 0.5, 25],
  "claude-opus-4-8": [5, 6.25, 10, 0.5, 25],
  "claude-opus-4-7": [5, 6.25, 10, 0.5, 25],
  "claude-opus-4-6": [5, 6.25, 10, 0.5, 25],
  "claude-opus-4-5": [5, 6.25, 10, 0.5, 25],
  "claude-opus-4-1": [15, 18.75, 30, 1.5, 75],
  "claude-opus-4": [15, 18.75, 30, 1.5, 75],
  "claude-sonnet-5-5": [2, 2.5, 4, 0.2, 10],
  "claude-sonnet-5": [2, 2.5, 4, 0.2, 10],
  "claude-sonnet-4-6": [3, 3.75, 6, 0.3, 15],
  "claude-sonnet-4-5": [3, 3.75, 6, 0.3, 15],
  "claude-sonnet-4": [3, 3.75, 6, 0.3, 15],
  "claude-haiku-4-5": [1, 1.25, 2, 0.1, 5],
  "claude-haiku-3-5": [0.8, 1, 1.6, 0.08, 4],
};

export const PRICES = Object.fromEntries(
  Object.entries(ROWS).map(([id, [input, cacheWrite5m, cacheWrite1h, cacheRead, output]]) => [id, { input, cacheWrite5m, cacheWrite1h, cacheRead, output }]),
);

const SORTED = Object.keys(PRICES).sort((a, b) => b.length - a.length);

export class UnknownModelError extends Error {
  constructor(model) {
    super(`no price for model id "${model}"; add it to bench/pricing.mjs from ${PRICING_SOURCE.url}`);
    this.model = model;
  }
}

// Longest known id that the model id equals or extends at a hyphen boundary ("claude-haiku-4-5-20251001" -> claude-haiku-4-5).
export function priceFor(model) {
  const id = String(model ?? "");
  const hit = SORTED.find((known) => id === known || id.startsWith(`${known}-`));
  if (!hit) throw new UnknownModelError(id);
  return { key: hit, ...PRICES[hit] };
}
