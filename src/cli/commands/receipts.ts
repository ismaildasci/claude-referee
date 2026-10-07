// receipts: totals of the local receipts for this project (or all with --all), per day and command with --tokens,
// Claude-side CLI calls from session transcripts with --usage, "receipts export --out <file>" to copy every receipt,
// and --stops / --label to list and mark the Stop done-gate's shadow stops.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { projectId, resolveDataDir, tildify } from "../../engine/datadir.ts";
import { RefereeError } from "../../engine/errors.ts";
import { overruleReceipt, readReceipts, verifyChain, type Receipt } from "../../engine/receipts.ts";
import { loadPack, packDirs, threshold } from "../../engine/pack.ts";
import { loadProject } from "../../engine/project.ts";
import { suggestThreshold } from "../../engine/stopgate/interval.ts";
import { labelStop, readStops, stopStats } from "../../engine/stopgate/stops.ts";
import { suggestForStops } from "../../engine/stopgate/weak.ts";
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
      verify: "Positional: check the hash chain of every project's receipts (add --project-only for the current one). Receipts written before chaining existed are counted as unchained.",
      overrule: "Positional: \"overrule <id>\" voids one decision: it is recorded in overruled.jsonl and the cached answers it used are deleted, so the next run asks again. The receipt itself is not rewritten.",
      "--out <file>": "Target file for export.",
      "--tokens": "Rows per day and command: runs, requests, cache hits, input tokens and the share of --fresh runs.",
      "--usage": "Claude-side: claude-referee CLI calls per day and command, counted from this project's Claude Code transcripts (subagents included, each tool call once, also behind env, timeout, nohup or xargs), with the size of what each call returned. Nothing from the transcripts is printed.",
      "--stops": "List the Stop done-gate's shadow stops of this project, newest first, at most 20, with stats (precision and false block rate over labelled would_block stops, p95 ms, skips per reason). Excerpts only; nothing else from the store is printed.",
      "--unlabelled": "With --stops: only would_block stops without a label.",
      "--label <id>": "Mark one stop with --right (the block would have been correct) or --wrong (a false block).",
      "--right": "With --label: the would-be block was correct.",
      "--wrong": "With --label: the would-be block was a false block.",
      "--project-only": "With verify: only this project's chain.",
      "--all": "Every project instead of the current one.",
      "--days <n>": "How many days back to include; default 30, or 14 with --tokens or --usage. With --stops it limits the listed stops and their stats.",
    },
    outputs: {
      verdict: "summary, tokens, usage, exported, stops, labelled, chain_ok, chain_broken or overruled",
      chain: "With verify: receipts, chained, unchained and breaks (project, id, kind mismatch, fork or unreadable)",
      dropped: "With overrule: how many cached answers were deleted",
      id: "With overrule or --label: the receipt or stop id",
      receipts: "With export: receipts written",
      out: "With export: the file written, with ~ for home",
      days: "The window in days",
      project: "With --usage: this project's id",
      calls: "With --usage: CLI calls in the window",
      runs: "Command runs in the window",
      requests: "Jev requests made",
      cached: "Answers served from the cache or merged with an identical request",
      input_tokens: "Input tokens billed",
      cost_usd: "Estimated cost at list price; a run on a model with no known price records null and adds nothing here",
      by_command: "Runs per command",
      rows: "With --tokens: one row per day and command. With --usage: day, command, calls, subagent_calls and result_chars",
      transcripts: "With --usage: how many transcript files were read",
      stats: "With --stops: stops, skipped_by_reason, asked, would_block, labelled, right, wrong, precision, false_block_rate, p95_ms (answered calls only), errors, error_rate (Jev errors and breaker skips over asked plus errors), p95_all_ms (answered and failed calls), unlabelled_would_block",
      stops: "With --stops: id, ts, skipped, error (the error code when the stop got no answer: a Jev error, a redaction stop, a missing or bad key, a pack that does not load, or internal), configured (active when the project sets a mode that is not built and the stop ran as shadow), edits, checks, would_block, claims_done, claims_verified, task_excerpt, final_excerpt, label, and for an unlabelled would_block stop whose next prompt in the session transcript reports breakage or repeats the request, suggestion: {label: \"right\", reason: reported_broken or repeated_request, source: next_message}. It is a hint only: computed on read, never stored, never counted in stats or in the threshold suggestion, and the message text is never printed or kept",
      threshold_suggestion: "With --stops: only available (true) with at least 10 human labels of each class on would_block stops (have and need are always shown). Then claims_done is checked with exact Clopper-Pearson 95% intervals: suggested is the smallest value at or above the current one at which the kept labelled stops (at least 10) have a precision lower bound of 0.8 or more, or null if none does; it never suggests lowering the threshold. overall holds the precision and false block rate intervals. Nothing is written; set it in .claude/referee.json yourself",
      label: "With --label: the id and the label that was stored",
      receipt: "With --stops: always a stops-<time> name, used as the details file name when the line passes 1,500 characters; no receipt is written",
    },
    errors: ["bad_input"],
    effects: "Reads the data directory, and with --usage this project's Claude Code transcripts; export writes one file; --label appends to labels.jsonl.",
    cost: "Free.",
  },
  options: {
    out: { type: "string" },
    tokens: { type: "boolean" },
    usage: { type: "boolean" },
    all: { type: "boolean" },
    "project-only": { type: "boolean" },
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
    if (positionals[0] === "verify") {
      const chain = verifyChain(dataDir, values["project-only"] === true ? projectId(io.cwd) : undefined);
      return { ok: true, verdict: chain.breaks.length === 0 ? "chain_ok" : "chain_broken", chain };
    }
    if (positionals[0] === "overrule") {
      const id = positionals[1];
      if (!id) throw new RefereeError("bad_input", "overrule needs a receipt id.", { next_step: "Run receipts overrule <id>." });
      const result = overruleReceipt(dataDir, id, new Date(io.now()).toISOString());
      if (!result) throw new RefereeError("bad_input", "No receipt with that id.");
      return { ok: true, verdict: "overruled", id, dropped: result.dropped };
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
      const picked = (values["unlabelled"] === true ? scopedStops.filter((r) => r.decision?.would_block === true && !r.label) : scopedStops)
        .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
        .slice(0, 20);
      const weak = suggestForStops(projectTranscriptDirs(io.env, io.home, io.cwd), picked.filter((r) => r.decision?.would_block === true && !r.label));
      const shown = picked.map((r) => ({
          id: r.id,
          ts: r.ts,
          skipped: r.skipped,
          error: r.error,
          configured: r.configured,
          edits: r.edits,
          checks: r.checks,
          would_block: r.decision?.would_block,
          claims_done: r.decision?.claims_done,
          claims_verified: r.decision?.claims_verified,
          task_excerpt: r.task_excerpt?.slice(0, 300),
          final_excerpt: r.final_excerpt?.slice(0, 300),
          label: r.label,
          ...(r.label === undefined && weak.has(r.id) ? { suggestion: weak.get(r.id) } : {}),
        }));
      let current = 0.7;
      try {
        const project = loadProject(io.cwd);
        if (project) current = threshold(loadPack(project.pack, packDirs(io.env)), project.thresholds, "stop.gate", "claims_done", 0.7);
      } catch {
        void 0;
      }
      return { ok: true, verdict: "stops", days, stats: stopStats(scopedStops), threshold_suggestion: suggestThreshold(scopedStops, current), stops: shown, receipt: `stops-${io.now().toString(36)}` };
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
