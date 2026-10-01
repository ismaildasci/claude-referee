// A server that sends headers and then stalls must end every Jev command with a JSON error line, never an uncaught AbortError or TimeoutError.
// Regression for @typesafe-ai/sdk 0.6.0 (PR #3): a timeout after the headers arrive rejects an orphaned promise. Checked on Node 22 only.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { isSdkAbort } from "../src/engine/abort-guard.ts";
import { tempDir } from "./helpers.ts";

const main = new URL("../src/cli/main.ts", import.meta.url).pathname;

async function stallAfterHeaders(): Promise<{ url: string; close(): Promise<void> }> {
  const sockets = new Set<import("node:net").Socket>();
  const server: Server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.flushHeaders();
    });
  });
  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}

function runCli(args: string[], stdin: string, baseUrl: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [main, ...args], {
      env: { PATH: process.env.PATH ?? "", HOME: tempDir(), REFEREE_DATA_DIR: tempDir(), REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: baseUrl, TYPESAFE_API_KEY: "ts_test" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => (stdout += c.toString()));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString()));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(stdin);
  });
}

test("done against a server that stalls after the headers ends with a timeout JSON line", { timeout: 60_000 }, async () => {
  const server = await stallAfterHeaders();
  try {
    const result = await runCli(["done", "--criteria", "the build is green"], "build output without a recognised runner\n", server.url);
    assert.equal(result.code, 1, result.stderr);
    const line = JSON.parse(result.stdout.trim()) as { ok: boolean; error?: string };
    assert.equal(line.ok, false);
    assert.equal(line.error, "timeout");
    assert.ok(!/AbortError|TimeoutError|triggerUncaughtException/.test(result.stderr), result.stderr);
  } finally {
    await server.close();
  }
});

test("only the SDK's abort and timeout rejections are ignored by the guard", () => {
  assert.equal(isSdkAbort(new DOMException("This operation was aborted", "AbortError")), true);
  assert.equal(isSdkAbort(new Error("AbortError")), false);
  assert.equal(isSdkAbort({ name: "AbortError" }), false);
  assert.equal(isSdkAbort(new DOMException("x", "TimeoutError")), true);
  assert.equal(isSdkAbort(new DOMException("x", "NetworkError")), false);
  assert.equal(isSdkAbort(undefined), false);
});
