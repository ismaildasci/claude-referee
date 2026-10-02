export function allocate(total, weights) {
  const ok = (n) => Number.isInteger(n) && n >= 0;
  if (!ok(total) || !Array.isArray(weights) || weights.length === 0 || !weights.every(ok)) throw new RangeError("bad input");
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) throw new RangeError("weights sum to zero");
  const parts = weights.map((w) => Math.floor((total * w) / sum));
  const order = weights
    .map((w, i) => ({ i, rem: (total * w) % sum }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  let left = total - parts.reduce((a, b) => a + b, 0);
  for (const { i } of order) {
    if (left === 0) break;
    parts[i] += 1;
    left -= 1;
  }
  return parts;
}
