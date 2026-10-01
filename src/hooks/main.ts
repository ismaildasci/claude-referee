// Entry point bundled to dist/hook.mjs: `node hook.mjs <event>`. Hooks fail open: every error exits 0 in silence.

import { homedir } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { installAbortGuard } from "../engine/abort-guard.ts";
import { sessionStart } from "./session-start.ts";
import { stopGate } from "./stop.ts";

installAbortGuard();

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

const pluginRoot = process.env["CLAUDE_PLUGIN_ROOT"] || dirname(dirname(fileURLToPath(import.meta.url)));
const io = { env: process.env, home: homedir(), now: () => Date.now(), readStdin };

try {
  if (process.argv[2] === "session-start") {
    const out = await sessionStart(io, pluginRoot);
    if (out) process.stdout.write(out);
  } else if (process.argv[2] === "stop") {
    const out = await stopGate(io, pluginRoot);
    if (out) process.stdout.write(out);
  }
} catch {
  process.exitCode = 0;
}
process.exitCode = 0;
