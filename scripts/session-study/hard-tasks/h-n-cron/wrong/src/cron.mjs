const LIMITS = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
];

function parseField(text, [lo, hi]) {
  const values = new Set();
  for (const item of text.split(",")) {
    const m = /^(?:(\*)|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(item);
    if (!m) throw new SyntaxError(`bad item ${item}`);
    let a;
    let b;
    if (m[1]) [a, b] = [lo, hi];
    else {
      a = Number(m[2]);
      b = m[3] === undefined ? (m[4] === undefined ? a : hi) : Number(m[3]);
    }
    const step = m[4] === undefined ? 1 : Number(m[4]);
    if (step === 0 || a < lo || b > hi || a > b) throw new SyntaxError(`bad range ${item}`);
    for (let v = a; v <= b; v += step) values.add(v);
  }
  return values;
}

export function nextRun(expression, from) {
  const parts = String(expression).trim().split(/\s+/);
  if (parts.length !== 5) throw new SyntaxError("need 5 fields");
  const [minutes, hours, doms, months, dows] = parts.map((p, i) => parseField(p, LIMITS[i]));
  if (dows.has(7)) dows.add(0);
  const domStar = parts[2] === "*";
  const dowStar = parts[4] === "*";
  const start = new Date(from instanceof Date ? from.getTime() : Date.parse(from));
  start.setUTCSeconds(0, 0);
  start.setUTCMinutes(start.getUTCMinutes() + 1);
  const day = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const lastDay = Date.UTC(start.getUTCFullYear() + 5, start.getUTCMonth(), start.getUTCDate());
  for (; day.getTime() <= lastDay; day.setUTCDate(day.getUTCDate() + 1)) {
    if (!months.has(day.getUTCMonth() + 1)) continue;
    const domOk = doms.has(day.getUTCDate());
    const dowOk = dows.has(day.getUTCDay());
    const dayOk = domOk && dowOk;
    if (!dayOk) continue;
    for (const h of [...hours].sort((x, y) => x - y)) {
      for (const mi of [...minutes].sort((x, y) => x - y)) {
        const t = day.getTime() + h * 3600000 + mi * 60000;
        if (t >= start.getTime()) return new Date(t).toISOString();
      }
    }
  }
  return null;
}
