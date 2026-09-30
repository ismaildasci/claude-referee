// receipts: totals of the local receipts for this project (or all with --all), per day and command with --tokens,
// and "receipts export --out <file>" to copy every receipt as JSON lines.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { projectId, resolveDataDir, tildify } from "../../engine/datadir.ts";
import { RefereeError } from "../../engine/errors.ts";
import { readReceipts, type Receipt } from "../../engine/receipts.ts";
import type { Command } from "../types.ts";
import { str } from "../shared.ts";

function sum(receipts: readonly Receipt[], key: "requests" | "cached" | "input_tokens" | "cost_usd"): number {
  return receipts.reduce((total, r) => total + (r[key] ?? 0), 0);
}

export const receipts: Command = {
  name: "receipts",
  describe: {
    summary: "Show totals from the local receipts, per day with --tokens, or export them.",
    inputs: {
      export: "Positional: write every receipt, all projects, to --out as JSON lines.",
      "--out <file>": "Target file for export.",
      "--tokens": "Rows per day and command: runs, requests, cache hits, input tokens and the share of --fresh runs.",
      "--all": "Every project instead of the current one.",
      "--days <n>": "How many days back to include; default 30, or 14 with --tokens.",
    },
    outputs: {
      verdict: "summary, tokens or exported",
      runs: "Command runs in the window",
      requests: "Jev requests made",
      cached: "Answers served from the cache or merged with an identical request",
      input_tokens: "Input tokens billed",
      cost_usd: "Estimated cost at list price",
      by_command: "Runs per command",
      rows: "With --tokens: one row per day and command",
    },
    errors: ["bad_input"],
    effects: "Reads the data directory; export writes one file.",
    cost: "Free.",
  },
  options: { out: { type: "string" }, tokens: { type: "boolean" }, all: { type: "boolean" }, days: { type: "string" } },
  async run(context) {
    const { io, flags, values, positionals } = context;
    const dataDir = resolveDataDir(io.env, io.home, io.cwd, flags.dataDir);
    if (positionals[0] === "export") {
      const out = str(context, "out");
      if (!out) throw new RefereeError("bad_input", "export needs --out <file>.");
      const all = readReceipts(dataDir);
      const path = resolve(io.cwd, out);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, all.map((r) => JSON.stringify(r)).join("\n") + (all.length ? "\n" : ""));
      return { ok: true, verdict: "exported", receipts: all.length, out: tildify(path, io.home) };
    }
    if (positionals.length > 0) throw new RefereeError("bad_input", `Unknown receipts action: ${positionals[0]}`);
    const tokens = values["tokens"] === true;
    const days = Number(str(context, "days") ?? (tokens ? 14 : 30));
    if (!Number.isInteger(days) || days < 1 || days > 366) throw new RefereeError("bad_input", "--days must be a whole number from 1 to 366.");
    const since = new Date(io.now() - days * 86_400_000).toISOString();
    const scoped = readReceipts(dataDir, values["all"] === true ? undefined : projectId(io.cwd)).filter((r) => r.ts >= since);

    if (tokens) {
      const groups = new Map<string, Receipt[]>();
      for (const r of scoped) {
        const key = `${r.ts.slice(0, 10)}|${r.command}`;
        groups.set(key, [...(groups.get(key) ?? []), r]);
      }
      const rows = [...groups.entries()].sort().map(([key, rs]) => {
        const [day, command] = key.split("|");
        return {
          day,
          command,
          runs: rs.length,
          requests: sum(rs, "requests"),
          cached: sum(rs, "cached"),
          input_tokens: sum(rs, "input_tokens"),
          fresh_share: rs.filter((r) => r.fresh).length / rs.length,
        };
      });
      return { ok: true, verdict: "tokens", days, rows };
    }

    const byCommand: Record<string, number> = {};
    for (const r of scoped) byCommand[r.command] = (byCommand[r.command] ?? 0) + 1;
    return {
      ok: true,
      verdict: "summary",
      days,
      runs: scoped.length,
      requests: sum(scoped, "requests"),
      cached: sum(scoped, "cached"),
      input_tokens: sum(scoped, "input_tokens"),
      cost_usd: sum(scoped, "cost_usd"),
      by_command: byCommand,
    };
  },
};
