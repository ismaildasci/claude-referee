const MODES = new Set(["half-even", "half-up", "half-down", "floor", "ceil", "trunc"]);

export function roundDecimal(value, scale, mode) {
  const m = typeof value === "string" ? /^(-?)(\d+)(?:\.(\d+))?$/.exec(value) : null;
  if (!m) throw new TypeError(`bad decimal ${value}`);
  if (!Number.isInteger(scale) || scale < 0 || !MODES.has(mode)) throw new RangeError("bad scale or mode");
  const sign = m[1];
  const frac = m[3] ?? "";
  let digits = BigInt(m[2] + frac);
  const drop = frac.length - scale;
  if (drop > 0) {
    const divisor = 10n ** BigInt(drop);
    let q = digits / divisor;
    const r = digits % divisor;
    const twice = r * 2n;
    let up = false;
    if (mode === "half-even") up = twice > divisor || (twice === divisor && q % 2n === 1n);
    else if (mode === "half-up") up = twice >= divisor;
    else if (mode === "half-down") up = twice > divisor;
    else if (mode === "ceil") up = r > 0n;
    if (up) q += 1n;
    digits = q;
  } else digits *= 10n ** BigInt(-drop);
  let text = digits.toString().padStart(scale + 1, "0");
  if (scale > 0) text = `${text.slice(0, -scale)}.${text.slice(-scale)}`;
  return `${sign}${text}`;
}
