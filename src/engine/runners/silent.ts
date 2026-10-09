// Silent success: an npm script echo for eslint or oxlint, then nothing but exit lines of 0, is a clean run (docs/decisions/silent-success-reading.md).
// Every other shape stays on the exit-code reading: flags that hide or redirect output, shell operators, extra output, a second script, a non-zero exit.

import type { RunnerParser } from "./types.ts";
import { buildOnly, exitMatches, mk, prepare } from "./util.ts";

const TOOLS = new Set(["eslint", "oxlint"]);
const HEAD = /^> \S+@\S+ \S+\s*$/;
const COMMAND = /^> (.+?)\s*$/;
const SHELL = /[|&;<>$()`]/;
const HIDING = /^(?:--quiet|-q|--silent|--format(?:=.*)?|-f|--output-file(?:=.*)?|-o|--fix|--fix-dry-run|.*no-error.*)$/;

function silentRun(text: string): string | null {
  const lines = prepare(text);
  const heads = lines.flatMap((l, i) => (HEAD.test(l) ? [i] : []));
  if (heads.length !== 1) return null;
  const command = COMMAND.exec(lines[(heads[0] as number) + 1] ?? "")?.[1];
  if (command === undefined || SHELL.test(command)) return null;
  const words = command.split(/\s+/);
  if (!TOOLS.has(words[0] ?? "") || words.some((w) => HIDING.test(w))) return null;
  let exits = 0;
  for (const [i, line] of lines.entries()) {
    if (i === heads[0] || i === (heads[0] as number) + 1 || line.trim() === "") continue;
    const matches = exitMatches(line);
    if (matches.length === 0 || matches.some((m) => Number(m[2]) !== 0)) return null;
    exits += matches.length;
  }
  return exits > 0 ? command : null;
}

const silent: RunnerParser = {
  name: "silent",
  parse(text) {
    const command = silentRun(text);
    if (command === null) return null;
    const tool = command.split(/\s+/)[0] as string;
    return buildOnly(mk(tool, { errors: 0, warnings: 0 }, [], `${tool} printed no diagnostics and exited 0`, false));
  },
};

export const parsers: readonly RunnerParser[] = [silent];
