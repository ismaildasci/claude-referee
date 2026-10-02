import { listName } from "./person.mjs";

const quote = (s) => `"${String(s).replace(/"/g, '""')}"`;

export function csvRow(p) {
  return `${quote(listName(p))},${quote(p.email)}`;
}
