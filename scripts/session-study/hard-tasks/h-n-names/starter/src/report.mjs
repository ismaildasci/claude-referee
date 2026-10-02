import { displayName } from "./person.mjs";

export function reportLines(people) {
  return people.map((p, i) => `${i + 1}. ${displayName(p)}`);
}
