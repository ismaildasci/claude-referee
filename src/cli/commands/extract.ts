// extract: finds candidate user-visible strings in source files, offline and free, and writes them as judge items.
// Feed the file to: judge --pack i18n --question string.translatable --items <file>. A line scanner, not a parser.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { RefereeError } from "../../engine/errors.ts";
import { SOURCE_EXTENSIONS, extractPaths } from "../../engine/i18n-extract.ts";
import type { Command } from "../types.ts";
import { str } from "../shared.ts";

function count(context: { values: Record<string, unknown> }, key: string): number | undefined {
  const raw = context.values[key];
  if (typeof raw !== "string") return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || raw.trim() === "") throw new RefereeError("bad_input", `--${key} takes a whole number of 0 or more.`);
  return n;
}

export const extract: Command = {
  name: "extract",
  describe: {
    summary: "Find candidate user-visible strings in source files for the i18n pack's judge question. Offline and free.",
    inputs: {
      "<path>...": `Files or directories (shell globs work). Directories are walked for ${SOURCE_EXTENSIONS.join(" ")} files; node_modules, dist, build, coverage, vendor and hidden directories are skipped, and so are *.test, *.spec and *.stories files unless --include-tests.`,
      "--out <file>": "Write the candidates as JSON lines {id, text, context, kind} for judge --items. The id is path:line (#n for a second candidate on a line); the context names the file, line and where the string sits. Without --out nothing is written and the first 10 candidates are shown.",
      "--limit <n>": "At most n candidates after --offset (judge takes at most 500 items per call).",
      "--offset <n>": "Skip the first n candidates, to judge a large set in several calls.",
      "--include-tests": "Also scan test, spec and stories files.",
      "--keep-duplicates": "Keep a candidate whose kind, text and surrounding element or call equal one already found; by default only the first is kept.",
    },
    outputs: {
      verdict: "extracted, or none when no candidate was found",
      files: "Files scanned",
      candidates: "Candidates found after removing duplicates, before --offset and --limit",
      duplicates: "Candidates dropped as duplicates of an earlier one",
      written: "With --out: candidates written",
      by_kind: "Candidates per kind: jsx-text, jsx-attr, jsx-expr-string, vue-text, vue-attr, html-text, html-attr, ui-call, ui-prop, ui-assign",
      out: "With --out: the file written",
      preview: "Without --out: the first 10 candidates as id, kind and text",
      too_large: "Files over 1 MB that were skipped",
      missing: "Paths that do not exist",
    },
    errors: ["bad_input"],
    effects: "Reads the given files; writes only the --out file. No network, no key, no receipt.",
    cost: "Free. The judge step that follows costs one Jev request per item.",
  },
  options: { out: { type: "string" }, limit: { type: "string" }, offset: { type: "string" }, "include-tests": { type: "boolean" }, "keep-duplicates": { type: "boolean" } },
  async run(context) {
    if (context.positionals.length === 0) throw new RefereeError("bad_input", "Give one or more files or directories.", { next_step: "Example: extract src --out .claude/i18n-items.jsonl" });
    const found = extractPaths(context.io.cwd, context.positionals, { includeTests: context.values["include-tests"] === true, keepDuplicates: context.values["keep-duplicates"] === true });
    if (found.files === 0 && found.missing.length === context.positionals.length) throw new RefereeError("bad_input", `None of the paths exist: ${context.positionals.slice(0, 3).join(", ")}`);
    const offset = count(context, "offset") ?? 0;
    const limit = count(context, "limit");
    const chosen = found.candidates.slice(offset, limit === undefined ? undefined : offset + limit);
    const byKind: Record<string, number> = {};
    for (const c of chosen) byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
    const out = str(context, "out");
    if (out) {
      const path = resolve(context.io.cwd, out);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, chosen.map((c) => JSON.stringify({ id: c.id, text: c.text, context: c.context, kind: c.kind })).join("\n") + (chosen.length ? "\n" : ""));
    }
    return {
      ok: true,
      verdict: found.candidates.length === 0 ? "none" : "extracted",
      files: found.files,
      candidates: found.candidates.length,
      duplicates: found.duplicates,
      ...(out ? { written: chosen.length, out } : { preview: chosen.slice(0, 10).map((c) => ({ id: c.id, kind: c.kind, text: c.text.slice(0, 80) })) }),
      by_kind: byKind,
      ...(found.tooLarge.length ? { too_large: found.tooLarge.slice(0, 20) } : {}),
      ...(found.missing.length ? { missing: found.missing.slice(0, 20) } : {}),
      next_step: found.candidates.length === 0 ? undefined : out ? `Judge them: judge --pack i18n --question string.translatable --items ${out} --dry-run first to see the requests.` : "Add --out <file> to write the items for judge --items.",
    };
  },
};
