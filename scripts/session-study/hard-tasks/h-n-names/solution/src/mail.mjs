import { displayName } from "./person.mjs";

export function greeting(p) {
  return `Dear ${p.first},`;
}

export function signature(p) {
  return `-- ${displayName(p)}`;
}
