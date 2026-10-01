// Stop done-gate, shadow mode: after a turn with edits and no passing check, asks Jev whether Claude claimed success it didn't verify.
// It records the decision (stops.jsonl) and never blocks; "soft" also returns a systemMessage JSON line (a user-visible warning), "shadow" prints nothing.
// Fails open. Off unless .claude/referee.json sets hooks.stopGate.

import { readFileSync } from "node:fs";
import type { Questions } from "@typesafe-ai/sdk";
import { projectId, resolveDataDir } from "../engine/datadir.ts";
import { isRefereeError } from "../engine/errors.ts";
import { loadPack, packDirs, threshold, thresholdBelow, type Pack } from "../engine/pack.ts";
import { loadProject } from "../engine/project.ts";
import { Session, type Outcome } from "../engine/session.ts";
import { appendStop, newStopId } from "../engine/stopgate/stops.ts";
import { analyzeTranscript } from "../engine/stopgate/transcript.ts";
import type { StopDecision, StopRecord, StopSkip } from "../engine/stopgate/types.ts";
import type { HookIo } from "./session-start.ts";

interface StopInput {
  session_id?: unknown;
  transcript_path?: unknown;
  cwd?: unknown;
  stop_hook_active?: unknown;
  last_assistant_message?: unknown;
  background_tasks?: unknown;
}

const EXCERPT = 200;

function question(pack: Pack, id: string): Questions[string] {
  const q = pack.questions[id];
  if (!q) throw new Error(`pack has no question ${id}`);
  return q as unknown as Questions[string];
}

export function decideStop(answers: Readonly<Record<string, unknown>> | null, pack: Pack, thresholds: Parameters<typeof threshold>[1]): StopDecision | null {
  if (!answers) return null;
  const noul = (id: string): number | null => {
    const a = answers[id] as { type?: string; noul?: number } | undefined;
    return a?.type === "noul" && typeof a.noul === "number" ? a.noul : null;
  };
  const claimsDone = noul("claims_done");
  const claimsVerified = noul("claims_verified");
  const applies = noul("verification_applies");
  const outcome = answers["outcome"] as { type?: string; probabilities?: Record<string, number> } | undefined;
  if (claimsDone === null || claimsVerified === null || applies === null || outcome?.type !== "choice" || !outcome.probabilities) return null;
  const doneAt = threshold(pack, thresholds, "stop.gate", "claims_done", 0.7);
  const verifiedAt = thresholdBelow(pack, thresholds, "stop.gate", "claims_verified", 0.5);
  const appliesAt = threshold(pack, thresholds, "stop.gate", "verification_applies", 0.5);
  const blockedAt = thresholdBelow(pack, thresholds, "stop.gate", "blocked", 0.4);
  const would_block = claimsDone >= doneAt && claimsVerified < verifiedAt && applies >= appliesAt && (outcome.probabilities["blocked"] ?? 0) < blockedAt;
  return { claims_done: claimsDone, claims_verified: claimsVerified, verification_applies: applies, outcome: outcome.probabilities, would_block };
}

export const SOFT_NOTE = "claude-referee: this turn edited files and claimed it was done, but no passing check ran after the last edit. Run the project's tests or build before trusting it.";

export async function stopGate(io: HookIo, _pluginRoot: string): Promise<string | undefined> {
  const started = io.now();
  const { env } = io;
  if (env["REFEREE_HOOKS"] === "off" || /^(?:false|0|no|off)$/i.test(env["CLAUDE_PLUGIN_OPTION_HOOKS_ENABLED"]?.trim() ?? "")) return;
  let input: StopInput;
  try {
    input = JSON.parse(await io.readStdin()) as StopInput;
  } catch {
    return;
  }
  if (typeof input?.cwd !== "string") return;
  const cwd = input.cwd;
  const project = loadProject(cwd);
  if (!project || project.hooks.stopGate === "off") return;
  const sessionId = typeof input.session_id === "string" ? input.session_id : "unknown";
  const dataDir = resolveDataDir(env, io.home, cwd);
  const base = { id: newStopId(started), ts: new Date(started).toISOString(), session_id: sessionId, project: projectId(cwd), mode: project.hooks.stopGate === "soft" ? ("soft" as const) : ("shadow" as const) };
  const finish = (skipped: StopSkip | undefined, rest: Partial<StopRecord> = {}): undefined => {
    appendStop(dataDir, { ...base, ...(skipped ? { skipped } : {}), edits: 0, checks: 0, ms: Math.max(0, io.now() - started), ...rest } as StopRecord);
    return undefined;
  };

  if (input.stop_hook_active === true) return finish("stop_hook_active");
  if (Array.isArray(input.background_tasks) && input.background_tasks.length > 0) return finish("background_tasks");
  if (typeof input.transcript_path !== "string") return finish("no_transcript");
  let text: string;
  try {
    text = readFileSync(input.transcript_path, "utf8");
  } catch {
    return finish("no_transcript");
  }
  const facts = analyzeTranscript(text);
  const { marks } = facts;
  const counts = {
    edits: facts.edits.length,
    checks: facts.checks.length,
    ...(marks.truncatedChecks > 0 ? { truncated_checks: marks.truncatedChecks } : {}),
    ...(marks.subagentCalls > 0 ? { subagent_calls: marks.subagentCalls } : {}),
    ...(marks.subagentReports > 0 ? { subagent_reports: marks.subagentReports } : {}),
    ...(marks.stalePass ? { stale_pass: true as const } : {}),
  };
  if (facts.edits.length === 0) return finish("no_edits", counts);
  if (facts.passedCheckAfterLastEdit) return finish("check_passed_after_edit", counts);
  const finalMessage = typeof input.last_assistant_message === "string" && input.last_assistant_message.trim() ? input.last_assistant_message.slice(-2_000) : facts.finalMessage;

  try {
    const pack = loadPack(project.pack, packDirs(env));
    const session = new Session({
      command: "stop-gate",
      env,
      cwd,
      home: io.home,
      platform: process.platform,
      now: io.now,
      pack: { name: pack.name, version: `${pack.version}+${pack.hash}`, redact: pack.redact },
      profile: "hook",
      sessionId,
    });
    const questions: Questions = {
      claims_done: question(pack, "stop.claims_done"),
      claims_verified: question(pack, "stop.claims_verified"),
      verification_applies: question(pack, "stop.verification_applies"),
      outcome: question(pack, "stop.outcome"),
    };
    const state = { task: facts.task, final_message: finalMessage, checks: facts.checks.map((c) => ({ cmd: c.cmd, status: c.status })), edits: [...facts.edits] };
    const [outcome] = (await session.run([{ id: "stop", state, questions }])) as Outcome[];
    session.record({ verdict: base.mode });
    const decision = decideStop(outcome?.answers ?? null, pack, project.thresholds);
    if (!decision) return finish("jev_error", counts);
    finish(undefined, { ...counts, decision, task_excerpt: facts.task.slice(0, EXCERPT), final_excerpt: finalMessage.slice(0, EXCERPT) });
    if (project.hooks.stopGate === "soft" && decision.would_block) return JSON.stringify({ systemMessage: SOFT_NOTE }) + "\n";
  } catch (error) {
    return finish(isRefereeError(error) && error.code === "breaker_open" ? "breaker_open" : "jev_error", counts);
  }
  return undefined;
}
