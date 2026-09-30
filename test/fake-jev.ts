// A local stand-in for the Jev API: records requests and answers with canned probabilities.

import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface FakeRequest {
  readonly model: string;
  readonly state: unknown;
  readonly questions: Record<string, { type: string; criteria?: unknown; instructions?: unknown }>;
}

export type Answerer = (request: FakeRequest) => Record<string, unknown>;

export interface FakeJev {
  readonly url: string;
  readonly requests: FakeRequest[];
  close(): Promise<void>;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

export function defaultAnswer(request: FakeRequest): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  for (const [id, q] of Object.entries(request.questions)) {
    if (q.type === "noul") answers[id] = { type: "noul", noul: 0.9 };
    else if (q.type === "choice") {
      const labels = Object.keys(q.criteria as object);
      const probabilities = Object.fromEntries(labels.map((l, i) => [l, i === 0 ? 0.9 : 0.1 / Math.max(labels.length - 1, 1)]));
      answers[id] = { type: "choice", choice: labels[0], confidence: 0.9, probabilities };
    } else {
      const levels = (q.criteria as unknown[]).length;
      answers[id] = { type: "score", score: levels - 1, confidence: 0.9, legend: {}, probabilities: {} };
    }
  }
  return answers;
}

export async function fakeJev(answer: Answerer = defaultAnswer, options: { hang?: boolean; status?: number } = {}): Promise<FakeJev> {
  const requests: FakeRequest[] = [];
  const server: Server = createServer(async (req, res) => {
    const body = JSON.parse(await readBody(req)) as FakeRequest;
    requests.push(body);
    if (options.hang) return;
    if (options.status) {
      res.writeHead(options.status, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "fake" }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json", "x-typesafe-request-id": `req_${requests.length}` });
    res.end(JSON.stringify({ model: body.model, answers: answer(body), usage: { input_tokens: 100, output_tokens: 10 } }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
