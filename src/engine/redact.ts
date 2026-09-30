// Runs before every Jev request. A credential-shaped value stops the request; personal data is replaced.
// Patterns can't clean free text such as a customer's name. Packs may add patterns but never remove these.

import { RefereeError } from "./errors.ts";

export interface Pattern {
  readonly kind: string;
  readonly regex: RegExp;
}

export interface PatternSpec {
  readonly kind: string;
  readonly pattern: string;
  readonly flags?: string;
}

export interface PackPatterns {
  readonly stop?: readonly PatternSpec[];
  readonly replace?: readonly PatternSpec[];
}

export interface Stop {
  readonly kind: string;
  readonly field: string;
}

export interface Redacted<T = unknown> {
  readonly value: T;
  readonly replaced: Readonly<Record<string, number>>;
  readonly stopped: readonly Stop[];
}

export interface RedactOptions {
  readonly home?: string;
  readonly extra?: PackPatterns | undefined;
  readonly maxField?: number;
}

const STOP: readonly Pattern[] = [
  { kind: "private_key", regex: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/ },
  { kind: "aws_access_key", regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { kind: "github_token", regex: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/ },
  { kind: "slack_token", regex: /\bxox[abposr]-[A-Za-z0-9-]{10,}/ },
  { kind: "anthropic_key", regex: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { kind: "openai_key", regex: /\bsk-(?!ant-)(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/ },
  { kind: "typesafe_key", regex: /\bapikey_[0-9a-f]{16,}_[0-9a-f]{16,}/i },
  { kind: "jwt", regex: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  { kind: "url_credentials", regex: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@/i },
];

const ASSIGNMENT = /([A-Za-z_][A-Za-z0-9_.-]*)["']?\s*[:=]\s*["'`]?([^\s"'`,;)}\]]+)/g;
const SECRET_NAME = /key|token|secret|passw(?:or)?d|pwd/i;
const NOT_SECRET_NAME = /page|cursor|next|continuation|label|placeholder|hint|length|type|name|algorithm/i;
const ID_NAME = /(?:[_.-](?:id|ID)|Id|ID)$/;
const IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const TYPE_NAME = /^[A-Z]?[a-z]+(?:[A-Z][a-z0-9]*)*$/;
const SECRET_CHARS = /^[A-Za-z0-9+/=_\-.~!@#$%^&*]+$/;
const PLACEHOLDER = /^(?:x{3,}|\*{3,}|\.{3}|changeme|your[_-].*|example.*|dummy.*|fake.*|test.*|placeholder.*|redacted.*|\$.*|process\.env.*|env\..*)$/i;

const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g;
const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;

export function looksSecret(name: string, value: string): boolean {
  if (!SECRET_NAME.test(name) || NOT_SECRET_NAME.test(name) || ID_NAME.test(name)) return false;
  if (value.length < 12 || !SECRET_CHARS.test(value)) return false;
  if (IDENTIFIER.test(value) || TYPE_NAME.test(value) || PLACEHOLDER.test(value)) return false;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(value)).length;
  return classes >= 3 || (classes >= 2 && value.length >= 20 && /[0-9]/.test(value));
}

function compile(specs: readonly PatternSpec[] | undefined, global: boolean): Pattern[] {
  return (specs ?? []).map((spec) => {
    try {
      const flags = [...new Set(((spec.flags ?? "") + (global ? "g" : "")).split(""))].join("");
      return { kind: spec.kind, regex: new RegExp(spec.pattern, flags) };
    } catch {
      throw new RefereeError("bad_pack", `Invalid redaction pattern for ${spec.kind}.`);
    }
  });
}

function stopsIn(text: string, extra: readonly Pattern[]): string[] {
  const kinds: string[] = [];
  for (const { kind, regex } of [...STOP, ...extra]) {
    if (regex.test(text)) kinds.push(kind);
  }
  for (const match of text.matchAll(ASSIGNMENT)) {
    if (looksSecret(match[1] ?? "", match[2] ?? "")) {
      kinds.push("secret_assignment");
      break;
    }
  }
  return kinds;
}

function isVersionContext(text: string, start: number, end: number): boolean {
  const before = text.slice(Math.max(0, start - 10), start);
  const after = text.slice(end, end + 2);
  return /(?:\bv|version|ver|@|=|[\d.])\s*$/i.test(before) || /^(?:\.\d|[-+][0-9A-Za-z])/.test(after);
}

function replaceIn(text: string, home: string | undefined, extra: readonly Pattern[], counts: Record<string, number>): string {
  const bump = (kind: string) => {
    counts[kind] = (counts[kind] ?? 0) + 1;
  };
  let out = text;
  if (home && home.length > 1 && out.includes(home)) {
    out = out.split(home).join("~");
    bump("home");
  }
  out = out.replace(EMAIL, () => {
    bump("email");
    return "[REDACTED:email]";
  });
  out = out.replace(IPV4, (match, offset: number, whole: string) => {
    if (isVersionContext(whole, offset, offset + match.length)) return match;
    bump("ip");
    return "[REDACTED:ip]";
  });
  for (const { kind, regex } of extra) {
    out = out.replace(regex, () => {
      bump(kind);
      return `[REDACTED:${kind}]`;
    });
  }
  return out;
}

export function redact<T>(value: T, options: RedactOptions = {}): Redacted<T> {
  const extraStop = compile(options.extra?.stop, false);
  const extraReplace = compile(options.extra?.replace, true);
  const maxField = options.maxField ?? 60_000;
  const replaced: Record<string, number> = {};
  const stopped: Stop[] = [];

  const walk = (node: unknown, field: string): unknown => {
    if (typeof node === "string") {
      for (const kind of stopsIn(node, extraStop)) stopped.push({ kind, field });
      const clipped = node.length > maxField ? `${node.slice(0, maxField)}[TRUNCATED:${node.length - maxField}]` : node;
      return replaceIn(clipped, options.home, extraReplace, replaced);
    }
    if (Array.isArray(node)) return node.map((item, i) => walk(item, `${field}[${i}]`));
    if (node !== null && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node)) {
        for (const kind of stopsIn(key, extraStop)) stopped.push({ kind, field: `${field}.<key>` });
        out[key] = walk(child, field ? `${field}.${key}` : key);
      }
      return out;
    }
    return node;
  };

  return { value: walk(value, "") as T, replaced, stopped };
}

export function stopError(stopped: readonly Stop[]): RefereeError {
  const first = stopped[0];
  const where = first ? `${first.kind} in ${first.field || "input"}` : "credential";
  return new RefereeError("credential_in_state", `Request not sent: found something shaped like a credential (${where}).`, {
    next_step: "Remove the credential from the input, or run with --dry-run to see what would be sent.",
  });
}
