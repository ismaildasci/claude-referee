export function buildOrder(graph) {
  const deps = new Map();
  for (const [name, list] of Object.entries(graph)) {
    deps.set(name, new Set([...(deps.get(name) ?? []), ...list]));
    for (const dep of list) if (!deps.has(dep)) deps.set(dep, new Set());
  }
  const placed = new Set();
  const out = [];
  while (true) {
    const ready = [...deps.keys()].filter((n) => !placed.has(n) && [...deps.get(n)].every((d) => placed.has(d))).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (ready.length === 0) break;
    out.push(ready[0]);
    placed.add(ready[0]);
  }
  if (out.length < deps.size) {
    const stuck = [...deps.keys()].filter((n) => !placed.has(n)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    throw new Error(`cycle: ${stuck.join(", ")}`);
  }
  return out;
}
