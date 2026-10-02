export function allocate(total, weights) {
  const ok = (n) => Number.isInteger(n) && n >= 0;
  if (!ok(total) || !Array.isArray(weights) || weights.length === 0 || !weights.every(ok)) throw new RangeError("bad input");
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) throw new RangeError("weights sum to zero");
  const parts = weights.map((w) => Math.round((total * w) / sum));
  const diff = total - parts.reduce((a, b) => a + b, 0);
  parts[parts.length - 1] += diff;
  return parts;
}
