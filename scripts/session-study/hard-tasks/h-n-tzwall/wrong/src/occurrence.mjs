const formatters = new Map();

function formatter(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(timeZone, new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }));
  }
  return formatters.get(timeZone);
}

function wallParts(timeZone, ms) {
  const p = Object.fromEntries(formatter(timeZone).formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]));
  return p;
}

function offsetAt(timeZone, ms) {
  const p = wallParts(timeZone, ms);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

function instantsFor(timeZone, wall) {
  return [wall - offsetAt(timeZone, wall)];
}

export function nextOccurrence(time, timeZone, from) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!m) throw new RangeError(`bad time ${time}`);
  const start = from instanceof Date ? from.getTime() : Date.parse(from);
  if (!Number.isFinite(start)) throw new RangeError("bad from");
  formatter(timeZone);
  const local = wallParts(timeZone, start);
  for (let i = -1; i <= 3; i++) {
    const wall = Date.UTC(local.year, local.month - 1, local.day + i, Number(m[1]), Number(m[2]));
    const first = instantsFor(timeZone, wall)[0];
    if (first > start) return new Date(first).toISOString();
  }
  throw new RangeError("no occurrence found");
}
