// receipts: totals of the local receipts for this project (or all with --all), per day and command with --tokens,
// Claude-side CLI calls from session transcripts with --usage, "receipts export --out <file>" to copy every receipt,
// and --stops / --label to list and mark the Stop done-gate's shadow stops.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { projectId, resolveDataDir, tildify } from "../../engine/datadir.ts";
import { RefereeError } from "../../engine/errors.ts";
import { readReceipts, type Receipt } from "../../engine/receipts.ts";
import { labelStop, readStops, stopStats } from "../../engine/stopgate/stops.ts";
import { projectTranscriptDirs, scanUsage } from "../../engine/usage.ts";
import type { Command } from "../types.ts";
import { str } from "../shared.ts";

function sum(receipts: readonly Receipt[], key: "requests" | "cached" | "input_tokens" | "cost_usd"): number {
  return receipts.reduce((total, r) => total + (r[key] ?? 0), 0);
}

export const receipts: Command = {
  name: "receipts",
  describe: {
    summary: "Show totals from the local receipts, per day with --tokens, Claude-side calls with --usage, or export them.",
    inputs: {
      export: "Positional: write every receipt, all projects, to --out as JSON lines.",
      "--out <file>": "Target file for export.",
      "--tokens": "Rows per day and command: runs, requests, cache hits, input tokens and the share of --fresh runs.",
      "--usage": "Claude-side: claude-referee CLI calls per day and command, counted from this project's Claude Code transcripts (subagents included, each tool call once), with the size of what each call returned. Nothing from the transcripts is printed.",
      "--stops": "List the Stop done-gate's shadow stops of this project, newest first, at most 20, with stats (precision and false block rate over labelled would_block stops, p95 ms, skips per reason). Excerpts only; nothing else from the store is printed.",
      "--unlabelled": "With --stops: only would_block stops without a label.",
      "--label <id>": "Mark one stop with --right (the block would have been correct) or --wrong (a false block).",
      "--right": "With --label: the would-be block was correct.",
      "--wrong": "With --label: the would-be block was a false block.",
      "--all": "Every project instead of the current one.",
      "--days <n>": "How many days back to include; default 30, or 14 with --tokens or --usage. With --stops it limits the listed stops and their stats.",
    },
    outputs: {
      verdict: "summary, tokens, usage, exported, stops or labelled",
      runs: "Command runs in the window",
      requests: "Jev requests made",
      cached: "Answers served from the cache or merged with an identical request",
      input_tokens: "Input tokens billed",
      cost_usd: "Estimated cost at list price",
      by_command: "Runs per command",
      rows: "With --tokens: one row per day and command. With --usage: day, command, calls, subagent_calls and result_chars",
      transcripts: "With --usage: how many transcript files were read",
      stats: "With --stops: stops, skipped_by_reason, asked, would_block, labelled, right, wrong, precision, false_block_rate, p95_ms (answered calls only), errors, error_rate (Jev errors and breaker skips over asked plus errors), p95_all_ms (answered and failed calls), unlabelled_would_block",
      stops: "With --stops: id, ts, skipped, edits, checks, would_block, claims_done, claims_verified, task_excerpt, final_excerpt, label",
      label: "With --label: the id and the label that was stored",
    },
    errors: ["bad_input"],
    effects: "Reads the data directory, and with --usage this project's Claude Code transcripts; export writes one file; --label rewrites the stops file.",
    cost: "Free.",
  },
  options: {
    out: { type: "string" },
    tokens: { type: "boolean" },
    usage: { type: "boolean" },
    all: { type: "boolean" },
    days: { type: "string" },
    stops: { type: "boolean" },
    unlabelled: { type: "boolean" },
    label: { type: "string" },
    right: { type: "boolean" },
    wrong: { type: "boolean" },
  },
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
    const labelId = str(context, "label");
    if (labelId !== undefined) {
      const right = values["right"] === true;
      const wrong = values["wrong"] === true;
      if (right === wrong) throw new RefereeError("bad_input", "--label needs exactly one of --right or --wrong.", { next_step: "Run receipts --label <id> --right, or --wrong." });
      const label = right ? "right" : "wrong";
      if (!labelStop(dataDir, labelId, label, new Date(io.now()).toISOString())) {
        throw new RefereeError("bad_input", "No stop with that id.", { next_step: "Run receipts --stops to list the ids." });
      }
      return { ok: true, verdict: "labelled", id: labelId, label };
    }
    const tokens = values["tokens"] === true;
    const usage = values["usage"] === true;
    const days = Number(str(context, "days") ?? (tokens || usage ? 14 : 30));
    if (!Number.isInteger(days) || days < 1 || days > 366) throw new RefereeError("bad_input", "--days must be a whole number from 1 to 366.");
    const since = new Date(io.now() - days * 86_400_000).toISOString();
    if (values["stops"] === true) {
      const project = projectId(io.cwd);
      const scopedStops = readStops(dataDir).filter((r) => r.project === project && r.ts >= since);
      const shown = (values["unlabelled"] === true ? scopedStops.filter((r) => r.decision?.would_block === true && !r.label) : scopedStops)
        .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
        .slice(0, 20)
        .map((r) => ({
          id: r.id,
          ts: r.ts,
          skipped: r.skipped,
          edits: r.edits,
          checks: r.checks,
          would_block: r.decision?.would_block,
          claims_done: r.decision?.claims_done,
          claims_verified: r.decision?.claims_verified,
          task_excerpt: r.task_excerpt?.slice(0, 300),
          final_excerpt: r.final_excerpt?.slice(0, 300),
          label: r.label,
        }));
      return { ok: true, verdict: "stops", days, stats: stopStats(scopedStops), stops: shown, receipt: `stops-${io.now().toString(36)}` };
    }
    if (usage) {
      const { transcripts, rows } = scanUsage(projectTranscriptDirs(io.env, io.home, io.cwd), since);
      return { ok: true, verdict: "usage", days, project: projectId(io.cwd), transcripts, calls: rows.reduce((n, r) => n + r.calls, 0), rows };
    }
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
