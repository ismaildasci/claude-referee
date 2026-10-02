const toMin = (text) => {
  const m = /^(\d{2}):(\d{2})$/.exec(text);
  if (!m) throw new RangeError(`bad time ${text}`);
  return Number(m[1]) * 60 + Number(m[2]);
};
const toText = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function freeSlots(day, busy, minMinutes) {
  if (!Number.isInteger(minMinutes) || minMinutes < 1) throw new RangeError("minMinutes must be an integer of at least 1");
  const start = toMin(day.start);
  const end = toMin(day.end);
  const spans = busy.map((b) => {
    const s = toMin(b.start);
    const e = toMin(b.end);
    if (e <= s) throw new RangeError("busy interval must end after it starts");
    return [Math.max(s, start), Math.min(e, end)];
  }).filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out = [];
  let cursor = start;
  for (const [s, e] of spans) {
    if (s - cursor >= minMinutes) out.push({ start: toText(cursor), end: toText(s) });
    cursor = Math.max(cursor, e);
  }
  if (end - cursor >= minMinutes) out.push({ start: toText(cursor), end: toText(end) });
  return out;
}
