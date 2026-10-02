export function pageList(totalItems, perPage, current, siblings = 1) {
  if (!Number.isInteger(totalItems) || totalItems < 0 || !Number.isInteger(perPage) || perPage < 1) throw new RangeError("bad totals");
  if (!Number.isInteger(current) || !Number.isInteger(siblings) || siblings < 0) throw new RangeError("bad page or siblings");
  const last = Math.max(1, Math.ceil(totalItems / perPage));
  const page = Math.min(Math.max(current, 1), last);
  const shown = new Set([1, last]);
  for (let p = page - siblings; p <= page + siblings; p++) if (p >= 1 && p <= last) shown.add(p);
  const sorted = [...shown].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0) {
      const gap = p - sorted[i - 1] - 1;
      if (gap === 1) out.push(p - 1);
      else if (gap > 1) out.push("…");
    }
    out.push(p);
  });
  return out;
}
