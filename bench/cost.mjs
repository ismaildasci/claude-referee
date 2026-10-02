// Transcript cost accountant of the A/B: usage grouped by request id (one request is written as one transcript line per content block), 1h and 5m cache writes priced apart.
// Pure functions. Rules are registered in bench/PREREG.md; every assumption made on odd input is returned as a warning, never hidden.

import { priceFor } from "./pricing.mjs";

const FIELDS = ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"];
const num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
const round = (v, digits = 6) => Math.round(v * 10 ** digits) / 10 ** digits;

// One entry per request: the largest value of each usage field over the lines that carry the same request id (earlier lines of a streamed
// request may hold partial counts). Key order: requestId, message.id, line uuid; the last is flagged because it cannot be de-duplicated.
export function collectRequests(transcript) {
  const byKey = new Map();
  const warnings = new Set();
  let lines = 0;
  for (const raw of String(transcript).split("\n")) {
    if (!raw.includes('"usage"')) continue;
    let entry;
    try {
      entry = JSON.parse(raw);
    } catch {
      warnings.add("unparsable_line");
      continue;
    }
    const message = entry?.message;
    const usage = message?.usage;
    if (entry?.type !== "assistant" || !usage || typeof usage !== "object") continue;
    lines++;
    const keyed = typeof entry.requestId === "string" && entry.requestId ? `r:${entry.requestId}` : typeof message.id === "string" && message.id ? `m:${message.id}` : null;
    if (!keyed) warnings.add("request_without_id");
    const key = keyed ?? `u:${entry.uuid ?? byKey.size}`;
    const cur = byKey.get(key) ?? { key, model: message.model, sidechain: entry.isSidechain === true, input: 0, output: 0, cacheRead: 0, cacheCreation: 0, cache5m: 0, cache1h: 0, splitSeen: false, webSearch: 0, geo: usage.inference_geo, fast: usage.speed === "fast", iterations: 0, lines: 0 };
    cur.lines++;
    cur.input = Math.max(cur.input, num(usage.input_tokens));
    cur.output = Math.max(cur.output, num(usage.output_tokens));
    cur.cacheRead = Math.max(cur.cacheRead, num(usage.cache_read_input_tokens));
    cur.cacheCreation = Math.max(cur.cacheCreation, num(usage.cache_creation_input_tokens));
    const split = usage.cache_creation;
    if (split && typeof split === "object") {
      cur.splitSeen = true;
      cur.cache5m = Math.max(cur.cache5m, num(split.ephemeral_5m_input_tokens));
      cur.cache1h = Math.max(cur.cache1h, num(split.ephemeral_1h_input_tokens));
    }
    cur.webSearch = Math.max(cur.webSearch, num(usage.server_tool_use?.web_search_requests));
    if (Array.isArray(usage.iterations)) cur.iterations = Math.max(cur.iterations, usage.iterations.length);
    if (!cur.model && message.model) cur.model = message.model;
    byKey.set(key, cur);
  }
  return { requests: [...byKey.values()], lines, warnings: [...warnings] };
}

// The cache-write split: both parts present is taken as is; a total with no split is priced as 5-minute writes (the cheaper rate) and flagged.
export function resolveCacheWrites(r) {
  if (r.splitSeen) {
    const parts = r.cache5m + r.cache1h;
    return { cache5m: r.cache5m, cache1h: r.cache1h, warning: parts === r.cacheCreation || r.cacheCreation === 0 ? null : "cache_split_mismatch" };
  }
  return { cache5m: r.cacheCreation, cache1h: 0, warning: r.cacheCreation > 0 ? "cache_split_assumed_5m" : null };
}

export function priceRequest(r) {
  if (r.model === "<synthetic>") return { usd: 0, tokens: { input: 0, output: 0, cache5m: 0, cache1h: 0, cacheRead: 0 }, warnings: [] };
  const price = priceFor(r.model);
  const writes = resolveCacheWrites(r);
  const warnings = [];
  if (writes.warning) warnings.push(writes.warning);
  if (r.iterations > 1) warnings.push("multi_iteration_top_level_used");
  if (r.fast) warnings.push("fast_mode_not_priced");
  const geo = r.geo === "us" ? 1.1 : 1;
  const usd =
    ((r.input * price.input + writes.cache5m * price.cacheWrite5m + writes.cache1h * price.cacheWrite1h + r.cacheRead * price.cacheRead + r.output * price.output) / 1e6) * geo +
    (r.webSearch * 10) / 1000;
  return { usd, tokens: { input: r.input, output: r.output, cache5m: writes.cache5m, cache1h: writes.cache1h, cacheRead: r.cacheRead }, warnings };
}

// Whole-session figure from a transcript. Failed runs are priced like any other: whatever usage was written is counted.
export function accountTranscript(transcript) {
  const { requests, lines, warnings } = collectRequests(transcript);
  const total = { usd: 0, tokens: { input: 0, output: 0, cache5m: 0, cache1h: 0, cacheRead: 0 }, byModel: {}, usdBy: { input: 0, output: 0, cache5m: 0, cache1h: 0, cacheRead: 0 } };
  const all = new Set(warnings);
  for (const r of requests) {
    const p = priceRequest(r);
    for (const w of p.warnings) all.add(w);
    total.usd += p.usd;
    for (const k of Object.keys(total.tokens)) total.tokens[k] += p.tokens[k];
    const m = (total.byModel[r.model] ??= { requests: 0, usd: 0 });
    m.requests++;
    m.usd += p.usd;
    if (r.model !== "<synthetic>") {
      const price = priceFor(r.model);
      const w = resolveCacheWrites(r);
      total.usdBy.input += (r.input * price.input) / 1e6;
      total.usdBy.output += (r.output * price.output) / 1e6;
      total.usdBy.cache5m += (w.cache5m * price.cacheWrite5m) / 1e6;
      total.usdBy.cache1h += (w.cache1h * price.cacheWrite1h) / 1e6;
      total.usdBy.cacheRead += (r.cacheRead * price.cacheRead) / 1e6;
    }
  }
  for (const m of Object.values(total.byModel)) m.usd = round(m.usd);
  for (const k of Object.keys(total.usdBy)) total.usdBy[k] = round(total.usdBy[k]);
  return { requests: requests.length, lines, usd: round(total.usd), tokens: total.tokens, usdBy: total.usdBy, byModel: total.byModel, warnings: [...all].sort() };
}

// Sets the transcript figure beside what `claude -p --output-format json` reported. A positive gap is spend that no assistant line carries
// (for example a /goal evaluator on the small model); the accountant reports it and never folds it in.
export function reconcile(account, result) {
  const reported = Number.isFinite(result?.total_cost_usd) ? result.total_cost_usd : null;
  const models = result?.modelUsage && typeof result.modelUsage === "object" ? Object.keys(result.modelUsage) : [];
  const gap = reported === null ? null : round(reported - account.usd);
  const norm = (m) => {
    try {
      return priceFor(m).key;
    } catch {
      return m;
    }
  };
  const seen = new Set(Object.keys(account.byModel).map(norm));
  return { transcript_usd: account.usd, reported_usd: reported, gap_usd: gap, gap_ratio: reported && gap !== null ? round(gap / reported, 4) : null, reported_models: models, extra_models: models.filter((m) => !seen.has(norm(m))) };
}

// The cost of one session for the analysis, with where it came from: the transcript, else the CLI's own total, else the per-session cap as an upper bound.
export function sessionCost({ account, result, capUsd }) {
  if (account && account.requests > 0) return { usd: account.usd, source: "transcript" };
  if (Number.isFinite(result?.total_cost_usd)) return { usd: result.total_cost_usd, source: "result_json" };
  return { usd: capUsd, source: "cap_upper_bound" };
}
