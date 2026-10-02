function initial(p) {
  return typeof p.middle === "string" && p.middle !== "" ? ` ${[...p.middle][0].toUpperCase()}.` : "";
}

const suffix = (p) => (typeof p.suffix === "string" && p.suffix !== "" ? `, ${p.suffix}` : "");

export function displayName(p) {
  return `${p.first}${initial(p)} ${p.last}${suffix(p)}`;
}

export function listName(p) {
  return `${p.last}, ${p.first}${initial(p)}${suffix(p)}`;
}
