// ui: local dashboard on 127.0.0.1 behind a random token; runs until Ctrl-C or SIGTERM. Security design: docs/decisions/ui-security.md.
// The browser opens via a 0600 launcher file, so the token is never in a process argument list. Exception to the
// runner-prints rule: the "listening" line is written here with io.write because the command blocks until a signal.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveDataDir } from "../../engine/datadir.ts";
import { RefereeError } from "../../engine/errors.ts";
import { startUi } from "../../ui/server.ts";
import type { Command } from "../types.ts";
import { str } from "../shared.ts";

const LAUNCHER_LIFETIME_MS = 20_000;

function openLauncher(url: string, platform: NodeJS.Platform): (() => void) | null {
  const opener = platform === "darwin" ? "open" : platform === "linux" ? "xdg-open" : null;
  if (!opener) return null;
  const dir = mkdtempSync(join(tmpdir(), "referee-ui-"));
  const file = join(dir, "open.html");
  const cleanup = (): void => rmSync(dir, { recursive: true, force: true });
  try {
    writeFileSync(file, `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${url}"><title>claude-referee</title>\n`, { mode: 0o600 });
    const child = spawn(opener, [file], { detached: true, stdio: "ignore" });
    child.on("error", () => undefined);
    child.unref();
  } catch {
    cleanup();
    return null;
  }
  setTimeout(cleanup, LAUNCHER_LIFETIME_MS).unref();
  return cleanup;
}

export const ui: Command = {
  name: "ui",
  describe: {
    summary: "Start a local dashboard (127.0.0.1, random token): labelling queue, overview, privacy counters and export.",
    inputs: {
      "--port <n>": "Listen on this port; default is a random free one.",
      "--no-open": "Print the URL only; don't open a browser.",
    },
    outputs: {
      verdict: "listening (printed once, with url) and closed (after Ctrl-C or SIGTERM)",
      url: "http://127.0.0.1:<port>/#t=<token>; the token is in the fragment, so it is never sent to the server or in a Referer. It is printed once; anyone with it can read this project's stops and label them until the server stops",
    },
    errors: ["bad_input"],
    effects: "Listens on 127.0.0.1 only. Reads the data directory; a label click appends to labels.jsonl. No network calls out, no telemetry. Opening the browser writes a 0600 launcher file in a private temp directory and removes it after 20 seconds.",
    cost: "Free.",
  },
  options: {
    port: { type: "string" },
    "no-open": { type: "boolean" },
  },
  async run(context) {
    const { io, flags, values } = context;
    const rawPort = str(context, "port");
    const port = rawPort === undefined ? 0 : Number(rawPort);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new RefereeError("bad_input", "--port must be a whole number from 0 to 65535.");
    const server = await startUi({ dataDir: resolveDataDir(io.env, io.home, io.cwd, flags.dataDir), cwd: io.cwd, home: io.home, env: io.env, now: io.now }, port);
    const cleanup = values["no-open"] === true ? null : openLauncher(server.urlWithToken, io.platform);
    io.write(JSON.stringify({ ok: true, verdict: "listening", url: server.urlWithToken, opened: cleanup !== null, next_step: "Stop with Ctrl-C." }, null, flags.pretty ? 2 : 0) + "\n");
    await new Promise<void>((resolve) => {
      const signals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
      const done = (): void => {
        for (const s of signals) process.removeListener(s, done);
        resolve();
      };
      for (const s of signals) process.once(s, done);
    });
    cleanup?.();
    await server.close();
    return { ok: true, verdict: "closed" };
  },
};
