// Io bound to the real process: env, cwd, stdin and the two output streams.

import { homedir } from "node:os";
import type { Io } from "./types.ts";

async function readAll(stream: NodeJS.ReadStream): Promise<string> {
  if (stream.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export function processIo(): Io {
  return {
    env: process.env,
    cwd: process.cwd(),
    home: homedir(),
    platform: process.platform,
    readStdin: () => readAll(process.stdin),
    write: (text) => void process.stdout.write(text),
    warn: (text) => void process.stderr.write(text),
    now: () => Date.now(),
  };
}
