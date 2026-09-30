// Claude-side usage: claude-referee CLI calls counted from Claude Code's session transcripts, subagents included.
// A call counts only in command position, each tool call once; nothing from the transcripts is echoed back.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Env } from "./config.ts";
import { projectRoot } from "./datadir.ts";

export interface UsageRow {
  readonly day: string;
  readonly command: string;
  readonly calls: number;
  readonly subagent_calls: number;
  readonly result_chars: number;
}

const SEPARATORS = new Set(["&&", "||", "|", "|&", ";", "&", "\n", "(", ")"]);
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

function withoutHeredocs(command: string): string {
  const out: string[] = [];
  let delimiter: { word: string; strip: boolean } | null = null;
  for (const line of command.split("\n")) {
    if (delimiter) {
      if ((delimiter.strip ? line.replace(/^\t+/, "") : line) === delimiter.word) delimiter = null;
      continue;
    }
    out.push(line);
    const match = /<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/.exec(line);
    if (match) delimiter = { word: match[3] ?? "", strip: match[1] === "-" };
  }
  return out.join("\n");
}

function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: string | null = null;
  const flush = () => {
    if (current) tokens.push(current);
    current = "";
  };
  for (let i = 0; i < command.length; i++) {
    const ch = command[i] ?? "";
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && i + 1 < command.length) current += command[++i];
      else current += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    const two = command.slice(i, i + 2);
    if (two === "&&" || two === "||" || two === "|&") {
      flush();
      tokens.push(two);
      i++;
    } else if (ch === "|" || ch === ";" || ch === "&" || ch === "\n" || ch === "(" || ch === ")") {
      flush();
      tokens.push(ch);
    } else if (ch === " " || ch === "\t") {
      flush();
    } else {
      current += ch;
    }
  }
  flush();
  return tokens;
}

function subcommand(token: string | undefined): string {
  return token && /^[a-z][a-z-]*$/.test(token) ? token : "other";
}

function callIn(segment: readonly string[]): string | null {
  let i = 0;
  while (i < segment.length && (ASSIGNMENT.test(segment[i] ?? "") || ["{", "time", "exec", "command", "env"].includes(segment[i] ?? ""))) i++;
  const first = segment[i];
  if (first === "claude-referee") return subcommand(segment[i + 1]);
  if (first === "npx") {
    i++;
    while ((segment[i] ?? "").startsWith("-")) i += segment[i] === "--package" || segment[i] === "-p" ? 2 : 1;
    const name = segment[i] ?? "";
    return name === "claude-referee" || name.startsWith("claude-referee@") ? subcommand(segment[i + 1]) : null;
  }
  if (first === "node") {
    i++;
    while ((segment[i] ?? "").startsWith("-")) i++;
    const path = segment[i] ?? "";
    return path.endsWith("/dist/cli.mjs") && path.includes("claude-referee") ? subcommand(segment[i + 1]) : null;
  }
  return null;
}

export function cliCallsIn(command: string): string[] {
  const calls: string[] = [];
  let segment: string[] = [];
  for (const token of [...tokenize(withoutHeredocs(command)), ";"]) {
    if (!SEPARATORS.has(token)) {
      segment.push(token);
      continue;
    }
    const call = callIn(segment);
    if (call) calls.push(call);
    segment = [];
  }
  return calls;
}

function transcriptFiles(dir: string): { path: string; subagent: boolean }[] {
  if (!existsSync(dir)) return [];
  const files: { path: string; subagent: boolean }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push({ path: join(dir, entry.name), subagent: false });
    const sub = join(dir, entry.name, "subagents");
    if (entry.isDirectory() && existsSync(sub)) {
      for (const name of readdirSync(sub).filter((n) => n.endsWith(".jsonl")).sort()) files.push({ path: join(sub, name), subagent: true });
    }
  }
  return files;
}

function resultChars(content: unknown): number {
  if (typeof content === "string") return content.length;
  if (!Array.isArray(content)) return 0;
  return content.reduce((total: number, item) => total + (typeof (item as { text?: unknown })?.text === "string" ? ((item as { text: string }).text.length) : 0), 0);
}

export function projectTranscriptDirs(env: Env, home: string, cwd: string): string[] {
  const configDir = env["CLAUDE_CONFIG_DIR"]?.trim() || join(home, ".claude");
  return [...new Set([cwd, projectRoot(cwd)])].map((p) => join(configDir, "projects", p.replace(/[^A-Za-z0-9]/g, "-")));
}

export function scanUsage(dirs: readonly string[], since: string): { transcripts: number; rows: UsageRow[] } {
  const files = [...new Map(dirs.flatMap(transcriptFiles).map((f) => [f.path, f])).values()];
  const calls = new Map<string, { day: string; commands: string[]; subagent: boolean }>();
  const sizes = new Map<string, number>();
  for (const file of files) {
    for (const line of readFileSync(file.path, "utf8").split("\n")) {
      if (!line.trim()) continue;
      let entry: { timestamp?: unknown; message?: { content?: unknown } };
      try {
        entry = JSON.parse(line) as typeof entry;
      } catch {
        continue;
      }
      const content = entry.message?.content;
      if (!Array.isArray(content)) continue;
      const ts = typeof entry.timestamp === "string" ? entry.timestamp : "";
      for (const item of content as { type?: unknown; id?: unknown; name?: unknown; input?: { command?: unknown }; tool_use_id?: unknown; content?: unknown }[]) {
        if (item.type === "tool_use" && item.name === "Bash" && typeof item.id === "string" && typeof item.input?.command === "string" && !calls.has(item.id)) {
          if (ts < since) continue;
          const commands = cliCallsIn(item.input.command);
          if (commands.length) calls.set(item.id, { day: ts.slice(0, 10), commands, subagent: file.subagent });
        } else if (item.type === "tool_result" && typeof item.tool_use_id === "string" && !sizes.has(item.tool_use_id)) {
          sizes.set(item.tool_use_id, resultChars(item.content));
        }
      }
    }
  }
  const rows = new Map<string, { calls: number; subagent_calls: number; result_chars: number }>();
  for (const [id, call] of calls) {
    call.commands.forEach((command, i) => {
      const key = `${call.day}|${command}`;
      const row = rows.get(key) ?? { calls: 0, subagent_calls: 0, result_chars: 0 };
      row.calls += 1;
      if (call.subagent) row.subagent_calls += 1;
      if (i === 0) row.result_chars += sizes.get(id) ?? 0;
      rows.set(key, row);
    });
  }
  return {
    transcripts: files.length,
    rows: [...rows.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, row]) => {
        const [day = "", command = ""] = key.split("|");
        return { day, command, ...row };
      }),
  };
}
