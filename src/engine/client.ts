// The only module that talks to TypeSafe. The SDK is imported lazily, so commands that never ask Jev never load it.
// Each call gets a total budget on top of the SDK's per-attempt timeout, because the SDK has no retry budget.

import type { ChoiceResponse, EntryType, NoulResponse, Questions, ScoreResponse, TypeSafeClient } from "@typesafe-ai/sdk";
import { classify } from "./classify.ts";
import type { Budget } from "./config.ts";
import { RefereeError } from "./errors.ts";

export type Answer = NoulResponse | ChoiceResponse | ScoreResponse;

export interface JevCall {
  readonly state: EntryType;
  readonly questions: Questions;
  readonly model: string;
}

export interface JevReply {
  readonly answers: Readonly<Record<string, Answer>>;
  readonly model: string;
  readonly inputTokens: number;
  readonly requestId: string | undefined;
}

export interface CallOptions {
  readonly key: string;
  readonly budget: Budget;
  readonly baseURL?: string | undefined;
  readonly signal?: AbortSignal | undefined;
}

const stderrLogger = {
  debug: () => {},
  info: () => {},
  warn: (message: string) => void process.stderr.write(`[claude-referee] ${message}\n`),
  error: (message: string) => void process.stderr.write(`[claude-referee] ${message}\n`),
};

async function guarded<T>(options: CallOptions, fn: (client: TypeSafeClient, signal: AbortSignal) => Promise<T>): Promise<T> {
  const sdk = await import("@typesafe-ai/sdk");
  const budgetSignal = AbortSignal.timeout(options.budget.budgetMs);
  const signal = options.signal ? AbortSignal.any([options.signal, budgetSignal]) : budgetSignal;
  try {
    const client = new sdk.TypeSafeClient({
      apiKey: options.key,
      logLevel: "warn",
      logger: stderrLogger,
      timeout: options.budget.perAttemptMs,
      retry: { maxRetries: options.budget.maxRetries },
      ...(options.baseURL ? { baseURL: options.baseURL } : {}),
    });
    return await fn(client, signal);
  } catch (error) {
    if (budgetSignal.aborted) {
      throw new RefereeError("timeout", `Jev did not answer within ${options.budget.budgetMs} ms.`, {
        next_step: "Try again later; the verdict is unknown, not negative.",
      });
    }
    throw classify(error);
  }
}

export function callJev(call: JevCall, options: CallOptions): Promise<JevReply> {
  return guarded(options, async (client, signal) => {
    const { data, requestId } = await client.systemOne({ state: call.state, questions: call.questions, model: call.model }, { signal }).withResponse();
    return {
      answers: data.answers as Readonly<Record<string, Answer>>,
      model: data.model,
      inputTokens: data.usage.input_tokens,
      requestId,
    };
  });
}

export function listModels(options: CallOptions): Promise<string[]> {
  return guarded(options, async (client, signal) => (await client.models.list({ signal })).map((m) => m.name));
}
