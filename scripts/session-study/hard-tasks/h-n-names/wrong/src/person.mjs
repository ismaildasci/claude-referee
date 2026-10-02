export function displayName(p) {
  const middle = typeof p.middle === "string" && p.middle !== "" ? ` ${[...p.middle][0].toUpperCase()}.` : "";
  const suffix = typeof p.suffix === "string" && p.suffix !== "" ? `, ${p.suffix}` : "";
  return `${p.first}${middle} ${p.last}${suffix}`;
}
