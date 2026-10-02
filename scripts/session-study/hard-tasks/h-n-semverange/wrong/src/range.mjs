const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function parse(text) {
  const m = VERSION.exec(text);
  if (!m) throw new TypeError(`bad version ${text}`);
  return { n: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ? m[4].split(".") : [] };
}

function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a.n[i] !== b.n[i]) return a.n[i] < b.n[i] ? -1 : 1;
  if (a.pre.length === 0 || b.pre.length === 0) return a.pre.length === b.pre.length ? 0 : a.pre.length === 0 ? 1 : -1;
  for (let i = 0; i < Math.min(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i];
    const y = b.pre[i];
    if (x === y) continue;
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn) return Number(x) < Number(y) ? -1 : 1;
    if (xn !== yn) return xn ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return a.pre.length === b.pre.length ? 0 : a.pre.length < b.pre.length ? -1 : 1;
}

const bare = (n) => ({ n, pre: [] });

function comparators(token) {
  if (token === "*") return [{ op: ">=", v: bare([0, 0, 0]), any: true }];
  const m = /^(\^|~|>=|<=|>|<|=)?(.+)$/.exec(token);
  const v = parse(m[2]);
  const op = m[1] ?? "=";
  if (op === "~") return [{ op: ">=", v }, { op: "<", v: bare([v.n[0], v.n[1] + 1, 0]) }];
  if (op === "^") {
    const [a, b, c] = v.n;
    const upper = a > 0 ? [a + 1, 0, 0] : b > 0 ? [0, b + 1, 0] : [0, 0, c + 1];
    return [{ op: ">=", v }, { op: "<", v: bare(upper) }];
  }
  return [{ op, v }];
}

function holds(op, cmp) {
  return { "=": cmp === 0, ">": cmp > 0, ">=": cmp >= 0, "<": cmp < 0, "<=": cmp <= 0 }[op];
}

export function satisfies(version, range) {
  const v = parse(version);
  if (typeof range !== "string" || range.trim() === "") throw new TypeError("bad range");
  const sets = range.split("||").map((set) => set.trim().split(/\s+/).flatMap(comparators));
  return sets.some((set) => {
    if (!set.every((c) => (c.any || holds(c.op, compare(v, c.v))))) return false;
    return true;
  });
}
