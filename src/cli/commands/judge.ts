// judge: runs a pack's yes/no questions over many items (lines, strings, failures), one request per item.
// Answers at or above the auto band count as yes, at or below 1 - auto as no; everything between goes to review.

import type { Questions } from "@typesafe-ai/sdk";
import { atLeast, atMost } from "../../engine/compare.ts";
import { RefereeError } from "../../engine/errors.ts";
import type { Result } from "../../engine/output.ts";
import { threshold, type Pack, type Thresholds } from "../../engine/pack.ts";
import type { Outcome, Planned } from "../../engine/session.ts";
import type { Command } from "../types.ts";
import { JEV_COST, JEV_EFFECTS, JEV_ERRORS, clip, jevCommand, openPack, question, readSource, str } from "../shared.ts";

interface Item {
  readonly id: string;
  readonly text: string;
}

const MAX_ITEMS = 500;
const LIST_LIMIT = 20;

export function parseItems(text: string): Item[] {
  const trimmed = text.trim();
  const toItem = (value: unknown, i: number): Item | null => {
    if (typeof value === "string") return value.trim() ? { id: String(i + 1), text: value } : null;
    const { id, text: body } = (value ?? {}) as { id?: unknown; text?: unknown };
    if (typeof body !== "string" || !body.trim()) return null;
    return { id: typeof id === "string" || typeof id === "number" ? String(id) : String(i + 1), text: body };
  };
  if (trimmed.startsWith("[")) {
    try {
      return (JSON.parse(trimmed) as unknown[]).map(toItem).filter((x): x is Item => x !== null);
    } catch {
      throw new RefereeError("bad_input", "Items look like a JSON array but don't parse.");
    }
  }
  const lines = text.split(/\r?\n/);
  const jsonl = lines.filter((l) => l.trim()).every((l) => l.trim().startsWith("{"));
  return lines
    .map((line, i) => {
      if (!line.trim()) return null;
      if (!jsonl) return { id: String(i + 1), text: line };
      try {
        return toItem(JSON.parse(line), i);
      } catch {
        throw new RefereeError("bad_input", `Items line ${i + 1} is not valid JSON.`);
      }
    })
    .filter((x): x is Item => x !== null);
}

export function judgeRequest(pack: Pack, thresholds: Thresholds | undefined, id: string, text: string, shared?: string): { planned: Planned[]; finish: (outcomes: Outcome[]) => Result } {
  const q = question(pack, id);
  if (q.type !== "noul") throw new RefereeError("bad_input", `judge needs yes/no questions; ${id} is a ${q.type}.`);
  const band = threshold(pack, thresholds, id, "auto", 0.9);
  const planned: Planned[] = [{ id: "item", state: { item: clip(text, 4_000, 4_000), ...(shared ? { context: shared } : {}) }, questions: { [id]: q } }];
  const finish = ([outcome]: Outcome[]): Result => {
    const answer = outcome?.answers?.[id];
    const p = answer?.type === "noul" ? answer.noul : 0.5;
    return { ok: true, verdict: atLeast(p, band) ? "yes" : atMost(p, 1 - band) ? "no" : "review", p };
  };
  return { planned, finish };
}

export const judge: Command = {
  name: "judge",
  describe: {
    summary: "Run a pack's yes/no questions over many items: lines, strings, failures.",
    inputs: {
      "--question <id[,id]>": "Pack question ids, e.g. line.risky or failure.env.",
      "--items <file|->": "A JSON array of strings or {id, text}, JSON lines, or plain lines (id = line number). Max 500 items.",
      "--context <text>": "Optional shared context for every item, e.g. the file name.",
    },
    outputs: {
      verdict: "flagged when any answer is yes, review when some are unsure or unanswered, clear otherwise",
      items: "Number of items judged",
      yes: "Answers in the yes band",
      no: "Answers in the no band",
      review: "Answers between the bands",
      flagged: "Item ids with a yes (first 20; 'id/question' when several questions)",
      review_ids: "Item ids to review (first 20)",
      stopped: "Item ids not sent because they held something shaped like a credential",
      unanswered: "Item ids with no answer because of an API error or the 90-second deadline (first 20)",
    },
    errors: [...JEV_ERRORS],
    effects: JEV_EFFECTS,
    cost: `${JEV_COST} judge makes one request per item, six at a time.`,
  },
  options: { question: { type: "string" }, items: { type: "string" }, context: { type: "string" } },
  async run(context) {
    const ids = (str(context, "question") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) throw new RefereeError("bad_input", "Give --question with one or more pack question ids.", { next_step: "The generic pack has line.risky and failure.env." });
    const items = parseItems(await readSource(context, str(context, "items"), "items"));
    if (items.length === 0) throw new RefereeError("bad_input", "No items to judge.");
    if (items.length > MAX_ITEMS) throw new RefereeError("too_large", `At most ${MAX_ITEMS} items per call.`, { next_step: "Split the items into several calls." });
    const { pack, project } = openPack(context);
    const questions: Questions = {};
    for (const id of ids) {
      const q = question(pack, id);
      if (q.type !== "noul") throw new RefereeError("bad_input", `judge needs yes/no questions; ${id} is a ${q.type}.`);
      questions[id] = q;
    }
    const shared = str(context, "context");
    const planned: Planned[] = items.map((item) => ({ id: item.id, state: { item: clip(item.text, 4_000, 4_000), ...(shared ? { context: shared } : {}) }, questions }));
    const auto = Object.fromEntries(ids.map((id) => [id, threshold(pack, project?.thresholds, id, "auto", 0.9)]));

    return jevCommand(
      context,
      "judge",
      pack,
      planned,
      (outcomes) => {
        let yes = 0;
        let no = 0;
        let review = 0;
        const flagged: string[] = [];
        const reviewIds: string[] = [];
        const stopped: string[] = [];
        const unanswered: string[] = [];
        for (const outcome of outcomes) {
          if (outcome.error) {
            unanswered.push(outcome.id);
            continue;
          }
          if (!outcome.answers) {
            stopped.push(outcome.id);
            continue;
          }
          for (const id of ids) {
            const answer = outcome.answers[id];
            const p = answer?.type === "noul" ? answer.noul : 0.5;
            const band = auto[id] ?? 0.9;
            const label = ids.length > 1 ? `${outcome.id}/${id}` : outcome.id;
            if (atLeast(p, band)) {
              yes += 1;
              flagged.push(label);
            } else if (atMost(p, 1 - band)) {
              no += 1;
            } else {
              review += 1;
              reviewIds.push(label);
            }
          }
        }
        const verdict = yes > 0 ? "flagged" : review > 0 || unanswered.length > 0 ? "review" : "clear";
        return {
          ok: true,
          verdict,
          items: items.length,
          yes,
          no,
          review,
          ...(flagged.length ? { flagged: flagged.slice(0, LIST_LIMIT) } : {}),
          ...(reviewIds.length ? { review_ids: reviewIds.slice(0, LIST_LIMIT) } : {}),
          ...(stopped.length ? { stopped } : {}),
          ...(unanswered.length ? { unanswered: unanswered.slice(0, LIST_LIMIT), next_step: "Some items got no answer; run judge again on those items." } : {}),
        };
      },
      { batch: true },
    );
  },
};
