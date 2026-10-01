// Parsers for biome, next build and nix build. Errors and warnings come from anchored diagnostic lines, never free text.
// A build with no completion marker, a lint of zero files or a nix log without an exit code line never counts as a clean result.

import type { RunnerParser } from "./types.ts";
import { exitCodes, mk, prepare } from "./util.ts";

const BIOME_CHECKED = /^(?:Checked|Formatted|Linted) (\d+) files? in \S+?\.(?:\s+(.*))?$/;
const BIOME_FOUND = /^Found (\d+) (errors?|warnings?|infos?|diagnostics?)\.?\s*$/;
const BIOME_HEADER = /^(\S+?)(?::\d+:\d+)? (\S+)(?:\s+(?:FIXABLE|INTERNAL|DEPRECATED|UNUSED))*\s+━{3,}/;
const BIOME_CMD = /\bbiome (?:check|lint|ci|format)\b/;

const biome: RunnerParser = {
  name: "biome",
  parse(text) {
    const lines = prepare(text);
    let checked: RegExpExecArray | null = null;
    let foundErrors = 0;
    let foundWarnings = 0;
    let bodyErrors = 0;
    let bodyWarnings = 0;
    let fixed = 0;
    let headers = 0;
    let cmd = false;
    let own = false;
    const failing = new Set<string>();
    for (const line of lines) {
      const c = BIOME_CHECKED.exec(line);
      if (c) {
        checked = c;
        if (/^(?:No fixes applied\.|Fixed \d+ files?\.?)/.test(c[2] ?? "")) own = true;
        fixed += Number(/Fixed (\d+) files?/.exec(c[2] ?? "")?.[1] ?? 0);
        continue;
      }
      const f = BIOME_FOUND.exec(line);
      if (f) {
        const n = Number(f[1]);
        if (/^error/.test(f[2] as string)) foundErrors += n;
        else foundWarnings += n;
        continue;
      }
      const h = BIOME_HEADER.exec(line);
      if (h) {
        headers++;
        failing.add(`${h[1]} ${h[2]}`);
        continue;
      }
      if (/^ {2}× (?!Some errors were emitted)/.test(line)) bodyErrors++;
      else if (/^ {2}! /.test(line)) bodyWarnings++;
      else if (BIOME_CMD.test(line)) cmd = true;
    }
    if (!own && headers === 0 && !cmd) return null;
    const errors = Math.max(foundErrors, bodyErrors);
    const warnings = Math.max(foundWarnings, bodyWarnings);
    const files = Number(checked?.[1] ?? 0);
    const summary = checked === null ? null : checked[0];
    return mk("biome", { passed: files, errors, warnings }, errors > 0 ? failing : [], summary, checked === null || files === 0 || fixed > 0);
  },
};

const NEXT_MARK = /^\s*\S{0,2}\s*Next\.js \d+\.\d+|Creating an optimized production build|^Route \((?:app|pages)\)|\bnext build\b/;
const NEXT_ROUTE = /^Route \((?:app|pages)\)/;
const NEXT_ERROR = /^(?:Failed to compile\.|> Build error occurred|Failed to type check\.|Type error: |> Build failed because of webpack errors|Error occurred prerendering page|Export encountered errors|Error: (?:Turbopack|Build|Export)\b|Next\.js build worker exited with code: [1-9]|\d+:\d+\s+Error: )|\berror TS\d+:|^Module not found: /;
const NEXT_WARNING = /^(?:\d+:\d+\s+Warning: |\s*⚠ )|Compiled with warnings/;

const nextBuild: RunnerParser = {
  name: "next build",
  parse(text) {
    const lines = prepare(text);
    if (!lines.some((l) => NEXT_MARK.test(l))) return null;
    let errors = 0;
    let warnings = 0;
    let route: string | null = null;
    let compiled: string | null = null;
    for (const line of lines) {
      if (NEXT_ROUTE.test(line)) route = line;
      else if (NEXT_ERROR.test(line)) errors++;
      else if (NEXT_WARNING.test(line)) warnings++;
      else if (/Compiled successfully/.test(line)) compiled = line;
    }
    return mk("next build", { errors, warnings }, [], errors > 0 ? null : (route ?? compiled), route === null && errors === 0);
  },
};

const NIX_CMD = /\bnix(?:-build| build| flake check| flake build| develop)\b|\bnixos-rebuild\b/;
const NIX_FAILURE = /^error: (?:builder for '|Cannot build '|build of '|\d+ dependencies of derivation)/;

const nix: RunnerParser = {
  name: "nix build",
  parse(text) {
    const lines = prepare(text);
    const cmd = lines.some((l) => NIX_CMD.test(l));
    if (!cmd && !lines.some((l) => NIX_FAILURE.test(l))) return null;
    const errorLines = lines.filter((l) => /^\s*error:(?:\s|$)/.test(l));
    const warnings = lines.filter((l) => /^warning: /.test(l)).length;
    const codes = exitCodes(lines);
    return mk("nix build", { errors: errorLines.length, warnings }, [], errorLines[0] ?? null, errorLines.length === 0 && codes.length === 0);
  },
};

export const parsers: readonly RunnerParser[] = [biome, nextBuild, nix];
