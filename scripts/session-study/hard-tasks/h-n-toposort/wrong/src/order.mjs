export function buildOrder(graph) {
  const names = new Set(Object.keys(graph));
  for (const list of Object.values(graph)) for (const dep of list) names.add(dep);
  const state = new Map();
  const out = [];
  const stuck = new Set();
  const visit = (name, path) => {
    if (state.get(name) === "done") return;
    if (state.get(name) === "open") {
      for (const n of path.slice(path.indexOf(name))) stuck.add(n);
      return;
    }
    state.set(name, "open");
    for (const dep of [...new Set(graph[name] ?? [])].sort()) visit(dep, [...path, name]);
    state.set(name, "done");
    out.push(name);
  };
  for (const name of [...names].sort()) visit(name, []);
  if (stuck.size) {
    for (const name of out) if ((graph[name] ?? []).some((d) => stuck.has(d))) stuck.add(name);
    throw new Error(`cycle: ${[...stuck].sort().join(", ")}`);
  }
  return out;
}
