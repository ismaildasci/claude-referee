// One Session per command run: redacts every request, serves the cache, merges identical in-flight requests,
// calls Jev within the profile budget and totals the run into a single local receipt.

import type { EntryType, Questions } from "@typesafe-ai/sdk";
import { cacheKey, readCache, sha256, writeCache } from "./cache.ts";
import { callJev, type Answer, type JevReply } from "./client.ts";
import { CACHE_TTL_MS, PROFILES, costUsd, estimateTokens, resolveModel, type Env } from "./config.ts";
import { resolveDataDir, projectId } from "./datadir.ts";
import { RefereeError } from "./errors.ts";
import { resolveKey, type ResolvedKey } from "./key.ts";
import { appendReceipt, newReceiptId, type Receipt } from "./receipts.ts";
import { redact, stopError, type PackPatterns, type Stop } from "./redact.ts";

export interface Planned {
  readonly id: string;
  readonly state: EntryType;
  readonly questions: Questions;
}

export interface Outcome {
  readonly id: string;
  readonly answers: Readonly<Record<string, Answer>> | null;
  readonly stopped: readonly Stop[];
  readonly cached: boolean;
}

export interface PackRef {
  readonly name: string;
  readonly version: string;
  readonly redact?: PackPatterns | undefined;
}

export interface SessionOptions {
  readonly command: string;
  readonly env: Env;
  readonly cwd: string;
  readonly home: string;
  readonly platform: NodeJS.Platform;
  readonly now: () => number;
  readonly pack: PackRef;
  readonly dataDir?: string | undefined;
  readonly fresh?: boolean;
  readonly profile?: keyof typeof PROFILES;
  readonly sessionId?: string | undefined;
}

interface Prepared {
  readonly planned: Planned;
  readonly body: { state: EntryType; questions: Questions };
  readonly stops: readonly Stop[];
}

export class Session {
  readonly model: string;
  readonly dataDir: string;
  readonly receiptId: string;
  private readonly options: SessionOptions;
  private readonly started: number;
  private readonly inflight = new Map<string, Promise<JevReply>>();
  private keyPromise: Promise<ResolvedKey> | undefined;
  private requests = 0;
  private cachedCount = 0;
  private inputTokens = 0;
  private cost = 0;
  private replacedCount = 0;
  private stoppedCount = 0;
  private answeredModel: string | undefined;
  private readonly requestIds: string[] = [];
  private readonly questionHashes = new Set<string>();

  constructor(options: SessionOptions) {
    this.options = options;
    this.started = options.now();
    this.model = resolveModel(options.env);
    this.dataDir = resolveDataDir(options.env, options.home, options.cwd, options.dataDir);
    this.receiptId = newReceiptId(this.started);
  }

  prepare(planned: readonly Planned[]): Prepared[] {
    const options = { home: this.options.home, extra: this.options.pack.redact };
    const count = (replaced: Readonly<Record<string, number>>) => Object.values(replaced).reduce((a, b) => a + b, 0);
    return planned.map((p) => {
      const state = redact({ state: p.state }, options);
      const questions = redact({ questions: p.questions }, { ...options, keepKeys: true });
      this.replacedCount += count(state.replaced) + count(questions.replaced);
      this.questionHashes.add(sha256(JSON.stringify(p.questions)).slice(0, 12));
      return { planned: p, body: { state: state.value.state, questions: questions.value.questions }, stops: [...state.stopped, ...questions.stopped] };
    });
  }

  dryRun(planned: readonly Planned[]): Record<string, unknown> {
    const prepared = this.prepare(planned);
    const stops = prepared.flatMap((p) => p.stops);
    if (stops.length > 0) throw stopError(stops);
    const bodies = prepared.map((p) => ({ id: p.planned.id, model: this.model, ...p.body }));
    const estTokens = bodies.reduce((sum, b) => sum + estimateTokens(JSON.stringify(b)), 0);
    return { ok: true, verdict: "would_send", dry_run: true, requests: bodies.length, est_tokens: estTokens, replaced: this.replacedCount, sent: bodies };
  }

  async run(planned: readonly Planned[], options: { batch?: boolean; concurrency?: number } = {}): Promise<Outcome[]> {
    const prepared = this.prepare(planned);
    const stops = prepared.flatMap((p) => p.stops);
    if (stops.length > 0 && !options.batch) throw stopError(stops);
    const outcomes: Outcome[] = new Array(prepared.length);
    let next = 0;
    const worker = async () => {
      while (next < prepared.length) {
        const index = next++;
        const item = prepared[index];
        if (!item) continue;
        outcomes[index] = await this.one(item);
      }
    };
    const width = Math.max(1, Math.min(options.concurrency ?? 6, prepared.length));
    await Promise.all(Array.from({ length: width }, worker));
    return outcomes;
  }

  private async one(item: Prepared): Promise<Outcome> {
    const id = item.planned.id;
    if (item.stops.length > 0) {
      this.stoppedCount += 1;
      return { id, answers: null, stopped: item.stops, cached: false };
    }
    const pack = this.options.pack;
    const key = cacheKey({ pack: pack.name, packVersion: pack.version, model: this.model, questions: item.body.questions, state: item.body.state });
    if (!this.options.fresh) {
      const hit = readCache(this.dataDir, key, this.options.now(), CACHE_TTL_MS);
      if (hit) {
        this.cachedCount += 1;
        this.answeredModel = hit.model;
        return { id, answers: hit.answers, stopped: [], cached: true };
      }
    }
    let pending = this.inflight.get(key);
    if (!pending) {
      pending = this.call(item.body, key);
      this.inflight.set(key, pending);
    } else {
      this.cachedCount += 1;
    }
    const reply = await pending;
    return { id, answers: reply.answers, stopped: [], cached: false };
  }

  private async call(body: Prepared["body"], key: string): Promise<JevReply> {
    this.keyPromise ??= resolveKey(this.options.env, this.options.platform);
    const { key: apiKey } = await this.keyPromise;
    const reply = await callJev(
      { state: body.state, questions: body.questions, model: this.model },
      { key: apiKey, budget: PROFILES[this.options.profile ?? "cli"], baseURL: this.options.env["TYPESAFE_BASE_URL"] },
    );
    this.requests += 1;
    this.inputTokens += reply.inputTokens;
    this.cost += costUsd(reply.model, reply.inputTokens) ?? 0;
    this.answeredModel = reply.model;
    if (reply.requestId) this.requestIds.push(reply.requestId);
    writeCache(this.dataDir, key, { ts: this.options.now(), model: reply.model, answers: reply.answers, inputTokens: reply.inputTokens });
    return reply;
  }

  stats(): { requests: number; cached: number } {
    return { requests: this.requests, cached: this.cachedCount };
  }

  record(fields: { verdict?: string; error?: RefereeError; chars?: number } = {}): Receipt {
    const env = this.options.env;
    const receipt: Receipt = {
      id: this.receiptId,
      ts: new Date(this.options.now()).toISOString(),
      command: this.options.command,
      project: projectId(this.options.cwd),
      pack: this.options.pack.name,
      model: this.answeredModel ?? this.model,
      ...(fields.verdict !== undefined ? { verdict: fields.verdict } : {}),
      ...(fields.error !== undefined ? { error: fields.error.code } : {}),
      requests: this.requests,
      cached: this.cachedCount,
      input_tokens: this.inputTokens,
      cost_usd: Number(this.cost.toFixed(8)),
      ...(this.requestIds.length > 0 ? { request_ids: this.requestIds } : {}),
      ...(this.questionHashes.size > 0 ? { qhash: [...this.questionHashes].sort().join(",") } : {}),
      ...(this.options.fresh ? { fresh: true } : {}),
      ...(this.stoppedCount > 0 ? { stopped: this.stoppedCount } : {}),
      ...(this.replacedCount > 0 ? { replaced: this.replacedCount } : {}),
      ...(fields.chars !== undefined ? { chars: fields.chars } : {}),
      ms: Math.max(0, this.options.now() - this.started),
      ...(env["EVAL_RUN_ID"] ? { run_id: env["EVAL_RUN_ID"] } : {}),
      ...(this.options.sessionId ? { session_id: this.options.sessionId } : {}),
    };
    appendReceipt(this.dataDir, receipt);
    return receipt;
  }
}
