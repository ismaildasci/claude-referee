// oxlint parser, from real oxlint 1.87 output (default and github formats, piped and on a terminal): `Found N warnings and M errors.` and `Finished in Xms on N files with R rules using T threads.`, after npm's spinner frames or `script`'s `^D` when captured on a terminal.
// A log with neither line is not claimed (agent, unix and stylish formats; stylish is eslint's), nor a clean one (every Found 0 and 0, no diagnostic heads), which keeps its exit-code reading like bun's, so other tools' warnings in it still reach the cap.
// Diagnostic heads (`  !`/`  ⚠` warning, `  x`/`  ×` error) are a floor; no `Found` line, or 0 files, is incomplete; facts are build_only (no test results).

import type { RunnerParser } from "./types.ts";
import { buildOnly, mk, prepare } from "./util.ts";

const OX_LEAD = String.raw`^(?:\^D)?[\u0000-\u0008\u2800-\u28ff\\|/-]*`;
const OX_FOUND = new RegExp(String.raw`${OX_LEAD}(Found (\d+) warnings? and (\d+) errors?\.)\s*$`);
const OX_FINISHED = new RegExp(String.raw`${OX_LEAD}(Finished in \S+ on (\d+) files? with \d+ rules? using \d+ threads?\.)\s*$`);
const OX_HEAD = /^ {2}([!x⚠×]) (.+)$/;
const OX_RULE = /^([\w@/-]+\([\w@/.-]+\)): /;
const OX_FRAME = /^\s+(?:,-|╭─)\[(.+?)\]\s*$/;

const oxlint: RunnerParser = {
  name: "oxlint",
  parse(text) {
    const lines = prepare(text);
    let found = 0;
    let finished = 0;
    let files = 0;
    let summaryErrors = 0;
    let summaryWarnings = 0;
    let headErrors = 0;
    let headWarnings = 0;
    let summary: string | null = null;
    let pending: { error: boolean; rule: string } | null = null;
    const failing: string[] = [];
    for (const [i, line] of lines.entries()) {
      const f = OX_FOUND.exec(line);
      if (f) {
        found++;
        summaryWarnings += Number(f[2]);
        summaryErrors += Number(f[3]);
        summary = f[1] as string;
        continue;
      }
      const d = OX_FINISHED.exec(line);
      if (d) {
        finished++;
        files += Number(d[2]);
        if (found === 0) summary = d[1] as string;
        continue;
      }
      const frame = OX_FRAME.exec(line);
      if (frame && pending) {
        if (pending.error) failing.push(`${frame[1]} ${pending.rule}`);
        pending = null;
        continue;
      }
      const h = OX_HEAD.exec(line);
      if (!h) continue;
      const rule = OX_RULE.exec(h[2] as string)?.[1];
      if (rule === undefined && !OX_FRAME.test(lines[i + 1] ?? "")) continue;
      const error = h[1] === "x" || h[1] === "×";
      if (error) headErrors++;
      else headWarnings++;
      pending = { error, rule: rule ?? "error" };
    }
    if (found === 0 && finished === 0) return null;
    const incomplete = found === 0 || (finished > 0 && files === 0);
    if (!incomplete && summaryWarnings + summaryErrors + headWarnings + headErrors === 0) return null;
    const errors = Math.max(summaryErrors, headErrors);
    return buildOnly(mk("oxlint", { passed: files, errors, warnings: Math.max(summaryWarnings, headWarnings) }, errors > 0 ? failing : [], summary, incomplete));
  },
};

export const parsers: readonly RunnerParser[] = [oxlint];
