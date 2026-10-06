// Deterministic finder of user-visible string candidates in JSX/TSX, Vue, HTML and UI calls, for the i18n judge pack.
// A hand-written scanner, not a parser: no AST claims. It skips strings already wrapped for translation and obviously technical ones.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

export interface Candidate {
  readonly id: string;
  readonly text: string;
  readonly kind: string;
  readonly context: string;
  readonly line: number;
  readonly key: string;
}

const UI_ATTRS = new Set(["placeholder", "title", "alt", "aria-label", "aria-description", "aria-placeholder", "label"]);
const UI_KEYS = new Set([
  "label", "title", "text", "message", "description", "placeholder", "tooltip", "helperText", "errorMessage", "successMessage", "caption", "heading", "header",
  "subtitle", "hint", "emptyText", "buttonText", "confirmText", "cancelText", "okText", "noResultsText", "error",
]);
const TRANSLATE = /(?:^|\.)(?:t|tc|te|\$t|\$tc|\$te|_|__|_t|trans|translate|gettext|ngettext|pgettext|\$gettext|\$ngettext|formatMessage|defineMessage|defineMessages|msg|plural|\$localize|localize)$|(?:^|\.)(?:i18n|i18next|intl)(?:\.[A-Za-z]+)?$/;
const LOG = /(?:^|\.)(?:console|logger|log|winston|pino|bunyan|consola|debug|captureMessage|captureException)(?:\.[A-Za-z]+)?$/;
const TEST = /^(?:describe|it|test|suite|context|expect|assert)(?:\.[A-Za-z]+)*$|(?:^|\.)(?:toThrow|toThrowError|toBe|toEqual|toContain|toMatch|toHaveText|toHaveTextContent|toHaveAttribute|getByText|getByLabelText|getByRole|getByPlaceholderText|getByTitle|getByAltText|findByText|queryByText|locator|contains)$/;
const UI_CALL = /(?:^|\.)(?:alert|confirm|prompt|toast|notify|showToast|showAlert|showNotification|enqueueSnackbar|swal)$|(?:^|\.)(?:toast|message|notification|snackbar|Alert|Swal|Modal|\$toast|\$message|\$notify|\$alert|\$confirm|messageApi|toaster)\.[A-Za-z]+$/;
const ASSIGN_UI = /\.(?:title|textContent|innerText|placeholder|ariaLabel|alt)$/;
const TRANS_TAGS = new Set(["Trans", "FormattedMessage", "Translation", "I18nText", "Translate"]);
const RAW_TAGS = new Set(["code", "pre", "kbd", "samp", "var", "script", "style", "textarea"]);
const HTML_TEMPLATE_TYPES = new Set(["text/html", "text/x-red", "text/template", "text/x-template", "text/ng-template"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const WRAP_ATTRS = new Set(["data-i18n", "i18n", "data-i18n-key", "v-t", "x-i18n", "i18nkey"]);
const KEYWORDS = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await", "default", "export"]);
const OBJECT_PREV = new Set(["(", ",", "=", ":", "[", "?", "&&", "||", "??", "return"]);
const CHILD_PREV = new Set(["{", "?", ":", "&&", "||", "??", "+", "("]);
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", copy: "©", hellip: "…", mdash: "—", ndash: "–" };

export const SOURCE_EXTENSIONS = [".jsx", ".tsx", ".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".vue", ".html", ".htm"];
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", "vendor", ".git", ".next", ".nuxt", ".svelte-kit", ".turbo", "__tests__", "__snapshots__"]);
const TEST_FILE = /\.(?:test|spec|stories)\.[cm]?[jt]sx?$|\.min\.(?:js|css)$/;
const MAX_FILE = 1_000_000;

const decode = (s: string): string => s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, d, h, n) => (d ? String.fromCodePoint(Number(d)) : h ? String.fromCodePoint(parseInt(h, 16)) : (ENTITIES[String(n).toLowerCase()] ?? m)));
const collapse = (s: string): string => s.replace(/\s+/g, " ").trim();
const clipTag = (s: string): string => (collapse(s).length > 90 ? collapse(s).slice(0, 87) + "..." : collapse(s));

export function looksTechnical(text: string): boolean {
  const t = text.trim();
  if (!/\p{L}/u.test(t)) return true;
  const bare = t.replace(/\$\{[^}]*\}|\{\{[^}]*\}\}|\{[^}\s]*\}|%[sdif]/g, " ").trim();
  if (!/\p{L}/u.test(bare)) return true;
  if (/^(?:https?|ftp|wss?|mailto|tel|data|file):/i.test(t) || /^\/\/\S/.test(t)) return true;
  if (/^(?:\.{0,2}\/|~\/|[A-Za-z]:\\)\S*$/.test(t) || /^\S+\.(?:png|jpe?g|svg|gif|webp|css|js|ts|tsx|json|html?|md|ya?ml|woff2?|ico|pdf|mp[34])$/i.test(t)) return true;
  if (/^#[0-9a-f]{3,8}$/i.test(t) || /^\^.*\$$/.test(t)) return true;
  if (/^(?:SELECT\b.+\bFROM\b|INSERT\s+INTO\b|UPDATE\s+\S+\s+SET\b|DELETE\s+FROM\b|CREATE\s+TABLE\b|ALTER\s+TABLE\b|DROP\s+TABLE\b)/i.test(t)) return true;
  if (/^(?:npm|npx|yarn|pnpm|git|curl|docker|kubectl|pip|brew|sudo)\s+\S/.test(t)) return true;
  if (/^(?:application|text|image|audio|video|font|multipart|message|model)\/[a-z0-9][a-z0-9.+-]*$/i.test(t)) return true;
  if (!/\s/.test(bare)) {
    if (/[_=@#\\]/.test(bare) || /\w:\w/.test(bare) || (/\w\/\w/.test(bare) && !/^[A-Za-z]+(?:\/[A-Za-z]+)+$/.test(bare)) || /\w\.\w/.test(bare) || /[a-z][A-Z]/.test(bare) || /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(bare) || /^[A-Za-z]+\d+[A-Za-z0-9]*$/.test(bare) || /^\d+[A-Za-z]+$/.test(bare)) return true;
    if (/^[A-Z]{7,}$/.test(bare)) return true;
    return false;
  }
  const tokens = bare.split(/\s+/);
  if (tokens.length >= 2 && tokens.every((x) => /^[a-z][a-z0-9:_/[\]\-.%]*$/.test(x)) && tokens.filter((x) => /[-:_0-9[]/.test(x)).length >= 2) return true;
  return false;
}

interface Pending {
  readonly kind: string;
  readonly text: string;
  readonly offset: number;
  readonly where: () => string;
}

interface Frame {
  readonly mode: "child" | "attr" | "none";
  readonly attr: string;
  readonly depth: number;
  readonly tag: TagInfo | null;
}

interface TagInfo {
  name: string;
  text: string;
  skipText: boolean;
}

class Scanner {
  readonly out: Pending[] = [];
  private i = 0;
  private readonly calls: string[] = [];
  private readonly braces: boolean[] = [];
  private readonly exprs: Frame[] = [];
  private readonly tags: TagInfo[] = [];
  private prev = "";
  private chain = "";
  private dot = false;
  private lastKey: string | null = null;
  private pendingKey: string | null = null;
  private assignTarget = "";

  private readonly src: string;
  private readonly jsx: boolean;

  constructor(src: string, jsx: boolean) {
    this.src = src;
    this.jsx = jsx;
  }

  run(from: number, to: number): void {
    this.i = from;
    this.end = to;
    this.code(false);
  }

  private end = 0;

  private depth(): number {
    return this.calls.filter(Boolean).length + this.braces.length;
  }

  private suppressed(): boolean {
    return this.calls.some((c) => c && (TRANSLATE.test(c) || LOG.test(c) || TEST.test(c)));
  }

  private nextSig(from: number): string {
    let j = from;
    while (j < this.end) {
      const c = this.src[j] as string;
      if (/\s/.test(c)) j += 1;
      else if (c === "/" && this.src[j + 1] === "/") j = this.lineEnd(j);
      else if (c === "/" && this.src[j + 1] === "*") j = (this.src.indexOf("*/", j + 2) + 2) || this.end;
      else return c;
    }
    return "";
  }

  private lineEnd(j: number): number {
    const n = this.src.indexOf("\n", j);
    return n < 0 || n > this.end ? this.end : n;
  }

  private skipWs(): void {
    for (;;) {
      const c = this.src[this.i];
      if (c !== undefined && /\s/.test(c)) this.i += 1;
      else if (c === "/" && this.src[this.i + 1] === "/") this.i = this.lineEnd(this.i);
      else if (c === "/" && this.src[this.i + 1] === "*") {
        const e = this.src.indexOf("*/", this.i + 2);
        this.i = e < 0 ? this.end : e + 2;
      } else return;
    }
  }

  private emit(kind: string, text: string, offset: number, where: () => string): void {
    if (this.suppressed()) return;
    const value = collapse(text);
    if (!value || looksTechnical(value)) return;
    this.out.push({ kind, text: value, offset, where });
  }

  private valueEnd(): boolean {
    return this.prev === "str" || this.prev === "num" || this.prev === ")" || this.prev === "]" || this.prev === "}" || (/^[A-Za-z_$]/.test(this.prev) && !KEYWORDS.has(this.prev));
  }

  private readString(quote: string): { value: string; start: number } {
    const start = this.i;
    this.i += 1;
    let value = "";
    while (this.i < this.end && this.src[this.i] !== quote) {
      if (this.src[this.i] === "\\") {
        const n = this.src[this.i + 1] ?? "";
        value += n === "n" ? " " : n;
        this.i += 2;
      } else {
        value += this.src[this.i];
        this.i += 1;
      }
    }
    this.i += 1;
    return { value, start };
  }

  private readTemplate(): { value: string; start: number } {
    const start = this.i;
    this.i += 1;
    let value = "";
    while (this.i < this.end && this.src[this.i] !== "`") {
      const c = this.src[this.i];
      if (c === "\\") {
        value += this.src[this.i + 1] ?? "";
        this.i += 2;
      } else if (c === "$" && this.src[this.i + 1] === "{") {
        const from = this.i;
        this.i += 2;
        const saved = { pb: this.prevBefore, prev: this.prev, chain: this.chain, dot: this.dot, lk: this.lastKey, pk: this.pendingKey };
        const out = this.out.length;
        this.code(true);
        this.out.length = out;
        this.prevBefore = saved.pb;
        this.prev = saved.prev;
        this.chain = saved.chain;
        this.dot = saved.dot;
        this.lastKey = saved.lk;
        this.pendingKey = saved.pk;
        value += this.src.slice(from, this.i);
      } else {
        value += c;
        this.i += 1;
      }
    }
    this.i += 1;
    return { value, start };
  }

  private string(value: string, start: number, key: string | null, isKey: boolean): void {
    if (isKey) return;
    const top = this.calls.filter(Boolean).at(-1) ?? "";
    const at = start;
    const expr = this.exprs.at(-1);
    if (expr && expr.mode !== "none" && CHILD_PREV.has(this.prevBefore) && this.depth() === expr.depth) {
      if (expr.mode === "child") {
        if (!this.tags.some((t) => t.skipText)) this.emit("jsx-expr-string", value, at, () => `jsx-expr-string in ${expr.tag?.text ?? "<>"}`);
      } else if (UI_ATTRS.has(expr.attr)) this.emit("jsx-attr", value, at, () => `jsx-attr ${expr.attr} on ${expr.tag?.text ?? "<>"}`);
      return;
    }
    if (key && UI_KEYS.has(key) && [",", "}", ""].includes(this.nextSig(this.i))) {
      this.emit("ui-prop", value, at, () => `ui-prop ${key} in ${top ? top + "({...})" : "{ " + key + ": ... }"}`);
      return;
    }
    if (top && UI_CALL.test(top) && (this.prevBefore === "(" || this.prevBefore === ",")) {
      this.emit("ui-call", value, at, () => `ui-call in ${top}(`);
      return;
    }
    const target = this.assignTarget;
    if (this.prevBefore === "=" && ASSIGN_UI.test(target)) this.emit("ui-assign", value, at, () => `ui-assign in ${target} =`);
  }

  private prevBefore = "";

  code(stopAtBrace: boolean): void {
    let local = 0;
    while (this.i < this.end) {
      this.skipWs();
      if (this.i >= this.end) return;
      const c = this.src[this.i] as string;
      const key = this.pendingKey;
      this.pendingKey = null;
      this.prevBefore = this.prev;
      if (c === "'" || c === '"') {
        const { value, start } = this.readString(c);
        const isKey = this.braces.at(-1) === true && (this.prev === "{" || this.prev === ",") && this.nextSig(this.i) === ":";
        this.string(value, start, key, isKey);
        this.lastKey = isKey ? value : null;
        this.prev = "str";
        this.chain = "";
        this.dot = false;
        continue;
      }
      if (c === "`") {
        const tagged = this.prev !== "" && /^[A-Za-z_$]/.test(this.prev) && !KEYWORDS.has(this.prev) && this.chain;
        const { value, start } = this.readTemplate();
        if (!(tagged && TRANSLATE.test(this.chain))) this.string(value, start, key, false);
        this.prev = "str";
        this.chain = "";
        this.dot = false;
        this.lastKey = null;
        continue;
      }
      if (/[A-Za-z_$]/.test(c)) {
        let j = this.i + 1;
        while (j < this.end && /[\w$]/.test(this.src[j] as string)) j += 1;
        const name = this.src.slice(this.i, j);
        const isKey = this.braces.at(-1) === true && (this.prev === "{" || this.prev === ",") && this.nextSig(j) === ":";
        this.i = j;
        this.chain = this.dot ? `${this.chain}.${name}` : name;
        this.dot = false;
        this.prev = name;
        this.lastKey = isKey ? name : null;
        continue;
      }
      if (/\d/.test(c)) {
        while (this.i < this.end && /[\w.]/.test(this.src[this.i] as string)) this.i += 1;
        this.prev = "num";
        this.chain = "";
        this.lastKey = null;
        continue;
      }
      if (c === "/") {
        if (!this.valueEnd()) {
          this.skipRegex();
          this.prev = "str";
        } else {
          this.i += 1;
          this.prev = "/";
        }
        this.chain = "";
        this.lastKey = null;
        continue;
      }
      if (c === "<" && this.jsx && !this.valueEnd() && /[A-Za-z_$>]/.test(this.src[this.i + 1] ?? "")) {
        if (this.element()) {
          this.prev = "str";
          this.chain = "";
          this.lastKey = null;
          continue;
        }
      }
      this.lastKeyToPending(c);
      if (c === "(") {
        this.calls.push(this.valueEndIdent() ? this.chain : "");
        this.i += 1;
        this.prev = "(";
        this.chain = "";
        this.dot = false;
      } else if (c === ")") {
        this.calls.pop();
        this.i += 1;
        this.prev = ")";
        this.chain = "";
        this.dot = false;
      } else if (c === "{") {
        this.braces.push(OBJECT_PREV.has(this.prev));
        local += 1;
        this.i += 1;
        this.prev = "{";
        this.chain = "";
      } else if (c === "}") {
        this.i += 1;
        if (local === 0 && stopAtBrace) {
          this.prev = "}";
          return;
        }
        if (local > 0) {
          this.braces.pop();
          local -= 1;
        }
        this.prev = "}";
        this.chain = "";
      } else if (c === ".") {
        if (this.src.startsWith("...", this.i)) {
          this.i += 3;
          this.prev = "...";
          this.dot = false;
        } else {
          this.i += 1;
          this.dot = true;
          if (this.prev === ")" || this.prev === "]" || this.prev === "str") this.chain = "";
          this.prev = ".";
        }
      } else if (c === "=" && this.src[this.i + 1] !== "=" && this.src[this.i + 1] !== ">") {
        this.assignTarget = this.chain;
        this.i += 1;
        this.prev = "=";
        this.chain = "";
      } else if (c === "?" && this.src[this.i + 1] === "." && !/\d/.test(this.src[this.i + 2] ?? "")) {
        this.i += 2;
        this.dot = true;
        this.prev = ".";
      } else {
        let j = this.i + 1;
        if (/[=!&|?+\-*%^~<>]/.test(c)) while (j < this.end && j < this.i + 3 && /[=!&|?+\-*%^~<>]/.test(this.src[j] as string)) j += 1;
        this.prev = this.src.slice(this.i, j);
        this.i = j;
        this.chain = "";
        this.dot = false;
      }
    }
  }

  private valueEndIdent(): boolean {
    return /^[A-Za-z_$]/.test(this.prev) || this.prev === ")" || this.prev === "]";
  }

  private lastKeyToPending(c: string): void {
    if (c === ":" && this.lastKey !== null) this.pendingKey = this.lastKey;
    if (c !== "}" && c !== "{") this.lastKey = null;
  }

  private skipRegex(): void {
    this.i += 1;
    let cls = false;
    while (this.i < this.end) {
      const c = this.src[this.i];
      if (c === "\\") this.i += 2;
      else if (c === "\n") break;
      else {
        if (c === "[") cls = true;
        else if (c === "]") cls = false;
        else if (c === "/" && !cls) {
          this.i += 1;
          break;
        }
        this.i += 1;
      }
    }
    while (this.i < this.end && /[a-z]/.test(this.src[this.i] as string)) this.i += 1;
  }

  private attempt<T>(fn: () => T | false): T | false {
    const mark = { i: this.i, out: this.out.length, calls: this.calls.length, braces: this.braces.length, exprs: this.exprs.length, tags: this.tags.length, prev: this.prev, chain: this.chain, dot: this.dot };
    const result = fn();
    if (result === false) {
      this.i = mark.i;
      this.out.length = mark.out;
      this.calls.length = mark.calls;
      this.braces.length = mark.braces;
      this.exprs.length = mark.exprs;
      this.tags.length = mark.tags;
      this.prev = mark.prev;
      this.chain = mark.chain;
      this.dot = mark.dot;
    }
    return result;
  }

  private element(): boolean {
    return this.attempt(() => this.jsxElement()) !== false;
  }

  private container(frame: Frame): void {
    this.exprs.push(frame);
    this.prev = "{";
    this.chain = "";
    this.dot = false;
    this.code(true);
    this.exprs.pop();
  }

  private jsxElement(): boolean {
    const open = this.i;
    this.i += 1;
    this.skipWs();
    const info: TagInfo = { name: "", text: "<>", skipText: false };
    if (this.src[this.i] !== ">") {
      const m = /^[A-Za-z_$][\w$.:-]*/.exec(this.src.slice(this.i, this.i + 120));
      if (!m) return false;
      info.name = m[0];
      this.i += m[0].length;
      info.skipText = TRANS_TAGS.has(m[0]) || RAW_TAGS.has(m[0].toLowerCase());
      for (;;) {
        this.skipWs();
        const c = this.src[this.i];
        if (c === undefined || this.i >= this.end) return false;
        if (c === "/" && this.src[this.i + 1] === ">") {
          this.i += 2;
          info.text = clipTag(this.src.slice(open, this.i));
          return true;
        }
        if (c === ">") break;
        if (c === "{") {
          this.i += 1;
          this.container({ mode: "none", attr: "", depth: this.depth(), tag: info });
          continue;
        }
        const am = /^[A-Za-z_$][\w$:.-]*/.exec(this.src.slice(this.i, this.i + 80));
        if (!am) return false;
        const attr = am[0];
        this.i += attr.length;
        if (WRAP_ATTRS.has(attr.toLowerCase())) info.skipText = true;
        this.skipWs();
        if (this.src[this.i] !== "=") continue;
        this.i += 1;
        this.skipWs();
        const q = this.src[this.i];
        if (q === '"' || q === "'") {
          const e = this.src.indexOf(q, this.i + 1);
          if (e < 0) return false;
          const value = this.src.slice(this.i + 1, e);
          const at = this.i + 1;
          this.i = e + 1;
          if (attr === "translate" && value === "no") info.skipText = true;
          if (UI_ATTRS.has(attr)) this.emit("jsx-attr", decode(value), at, () => `jsx-attr ${attr} on ${info.text}`);
        } else if (q === "{") {
          this.i += 1;
          this.container({ mode: "attr", attr, depth: this.depth(), tag: info });
        } else if (q === "<") {
          if (!this.jsxElement()) return false;
        } else return false;
      }
    }
    this.i += 1;
    info.text = clipTag(this.src.slice(open, this.i));
    this.tags.push(info);
    let buf = "";
    let bufAt = -1;
    const flush = (): void => {
      if (buf.trim() && !this.tags.some((t) => t.skipText)) this.emit("jsx-text", decode(buf), bufAt, () => `jsx-text in ${info.text}`);
      buf = "";
      bufAt = -1;
    };
    for (;;) {
      const from = this.i;
      while (this.i < this.end && this.src[this.i] !== "<" && this.src[this.i] !== "{") this.i += 1;
      if (this.i >= this.end) return false;
      const raw = this.src.slice(from, this.i);
      if (raw.trim() && bufAt < 0) bufAt = from + raw.length - raw.trimStart().length;
      buf += raw;
      if (this.src[this.i] === "{") {
        this.i += 1;
        const start = this.i;
        const before = this.out.length;
        this.container({ mode: "child", attr: "", depth: this.depth(), tag: info });
        const expr = this.src.slice(start, this.i - 1).replace(/\s+/g, "");
        if (this.out.length > before) flush();
        else if (/^(['"`])\1$/.test(expr)) buf += " ";
        else if (expr && !expr.startsWith("/*")) {
          if (bufAt < 0) bufAt = start - 1;
          buf += `{${expr.slice(0, 30)}}`;
        }
      } else if (this.src[this.i + 1] === "/") {
        flush();
        const e = this.src.indexOf(">", this.i);
        if (e < 0) return false;
        this.i = e + 1;
        this.tags.pop();
        return true;
      } else {
        flush();
        if (!this.jsxElement()) return false;
      }
    }
  }
}

interface HtmlTag {
  readonly name: string;
  readonly text: string;
  readonly skipText: boolean;
}

function withoutMustaches(s: string): string | null {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const open = s.indexOf("{{", i);
    if (open < 0) return out + s.slice(i);
    out += `${s.slice(i, open)} `;
    let depth = 0;
    let quote = "";
    let j = open + 2;
    for (; j < s.length; j++) {
      const c = s[j];
      if (quote) {
        if (c === "\\") j++;
        else if (c === quote) quote = "";
      } else if (c === "'" || c === '"' || c === "`") quote = c;
      else if (c === "{") depth++;
      else if (c === "}") {
        if (depth === 0 && s[j + 1] === "}") break;
        depth--;
      }
    }
    if (j >= s.length) return null;
    i = j + 2;
  }
  return out;
}

function scanHtml(src: string, from: number, to: number, vue: boolean, out: Pending[]): void {
  const stack: HtmlTag[] = [];
  let i = from;
  const text = (chunk: string, offset: number): void => {
    if (!chunk.trim() || stack.some((t) => t.skipText)) return;
    const parent = stack.at(-1);
    const lead = chunk.length - chunk.trimStart().length;
    let value = collapse(decode(chunk));
    const kind = vue ? "vue-text" : "html-text";
    const literal = /^\{\{\s*(['"`])(.*)\1\s*\}\}$/.exec(value);
    if (literal) value = literal[2] as string;
    else if (vue && !/\p{L}/u.test(withoutMustaches(value) ?? "x")) return;
    if (!value || looksTechnical(value)) return;
    out.push({ kind, text: value, offset: offset + lead, where: () => `${kind} in ${parent?.text ?? "document"}` });
  };
  while (i < to) {
    let lt = src.indexOf("<", i);
    if (lt < 0 || lt >= to) lt = to;
    text(src.slice(i, lt), i);
    if (lt >= to) break;
    if (src.startsWith("<!--", lt)) {
      const e = src.indexOf("-->", lt + 4);
      i = e < 0 ? to : e + 3;
      continue;
    }
    if (src[lt + 1] === "!" || src[lt + 1] === "?") {
      const e = src.indexOf(">", lt);
      i = e < 0 ? to : e + 1;
      continue;
    }
    if (src[lt + 1] === "/") {
      const e = src.indexOf(">", lt);
      const name = /^<\/([A-Za-z][\w:.-]*)/.exec(src.slice(lt, lt + 60))?.[1]?.toLowerCase();
      for (let k = stack.length - 1; name && k >= 0; k -= 1) {
        if (stack[k]?.name === name) {
          stack.length = k;
          break;
        }
      }
      i = e < 0 ? to : e + 1;
      continue;
    }
    const m = /^<([A-Za-z][\w:.-]*)/.exec(src.slice(lt, lt + 80));
    if (!m) {
      i = lt + 1;
      continue;
    }
    const name = (m[1] as string).toLowerCase();
    let j = lt + m[0].length;
    const attrs: { name: string; value: string | null; offset: number }[] = [];
    let self = false;
    for (;;) {
      while (j < to && /\s/.test(src[j] as string)) j += 1;
      if (j >= to) break;
      if (src[j] === ">") {
        j += 1;
        break;
      }
      if (src[j] === "/" && src[j + 1] === ">") {
        self = true;
        j += 2;
        break;
      }
      const am = /^[^\s"'<>/=]+/.exec(src.slice(j, j + 120));
      if (!am) {
        j += 1;
        continue;
      }
      j += am[0].length;
      let value: string | null = null;
      let offset = j;
      while (j < to && /\s/.test(src[j] as string)) j += 1;
      if (src[j] === "=") {
        j += 1;
        while (j < to && /\s/.test(src[j] as string)) j += 1;
        const q = src[j];
        if (q === '"' || q === "'") {
          const e = src.indexOf(q, j + 1);
          const end = e < 0 ? to : e;
          value = src.slice(j + 1, end);
          offset = j + 1;
          j = end + 1;
        } else {
          const um = /^[^\s"'=<>`]+/.exec(src.slice(j, j + 400));
          value = um?.[0] ?? "";
          offset = j;
          j += value.length;
        }
      }
      attrs.push({ name: am[0], value, offset });
    }
    const tagText = clipTag(src.slice(lt, j));
    const names = new Set(attrs.map((a) => a.name.toLowerCase()));
    const wrapped = [...names].some((n) => WRAP_ATTRS.has(n)) || attrs.some((a) => a.name.toLowerCase() === "translate" && a.value === "no");
    const meta = name === "meta" && /^(?:description|og:title|og:description|twitter:title|twitter:description)$/i.test(attrs.find((a) => a.name.toLowerCase() === "name" || a.name.toLowerCase() === "property")?.value ?? "");
    const button = name === "input" && /^(?:submit|button|reset)$/i.test(attrs.find((a) => a.name.toLowerCase() === "type")?.value ?? "");
    if (!wrapped && !stack.some((t) => t.skipText)) {
      for (const a of attrs) {
        const n = a.name.toLowerCase();
        const ok = UI_ATTRS.has(n) || (meta && n === "content") || (button && n === "value");
        if (!ok || a.value === null || names.has(`i18n-${n}`) || names.has(`data-i18n-${n}`)) continue;
        const kind = vue ? "vue-attr" : "html-attr";
        const value = collapse(decode(a.value));
        if (value && !looksTechnical(value)) out.push({ kind, text: value, offset: a.offset, where: () => `${kind} ${n} on ${tagText}` });
      }
    }
    if (name === "script" || name === "style") {
      const e = src.toLowerCase().indexOf(`</${name}`, j);
      const end = e < 0 ? to : e;
      const type = (attrs.find((a) => a.name.toLowerCase() === "type")?.value ?? "").trim().toLowerCase();
      if (name === "script" && HTML_TEMPLATE_TYPES.has(type) && !wrapped && !stack.some((t) => t.skipText)) scanHtml(src, j, end, vue, out);
      i = end;
      continue;
    }
    if (!self && !VOID.has(name)) stack.push({ name, text: tagText, skipText: wrapped || RAW_TAGS.has(name) });
    i = j;
  }
}

function scanVue(src: string, out: Pending[]): void {
  const t = /^<template\b[^>]*>/m.exec(src);
  if (t) {
    const start = t.index + t[0].length;
    const close = src.lastIndexOf("\n</template>");
    scanHtml(src, start, close > start ? close : src.length, true, out);
  }
  const re = /^<script\b[^>]*>/gm;
  for (let s = re.exec(src); s; s = re.exec(src)) {
    const from = s.index + s[0].length;
    const e = src.indexOf("</script>", from);
    const sc = new Scanner(src, false);
    sc.run(from, e < 0 ? src.length : e);
    out.push(...sc.out);
  }
}

export function extractFile(path: string, source: string): Candidate[] {
  const ext = extname(path).toLowerCase();
  const pending: Pending[] = [];
  if (ext === ".html" || ext === ".htm") scanHtml(source, 0, source.length, false, pending);
  else if (ext === ".vue") scanVue(source, pending);
  else {
    const sc = new Scanner(source, ext !== ".ts" && ext !== ".mts" && ext !== ".cts");
    sc.run(0, source.length);
    pending.push(...sc.out);
  }
  const starts = [0];
  for (let k = source.indexOf("\n"); k >= 0; k = source.indexOf("\n", k + 1)) starts.push(k + 1);
  const lineOf = (offset: number): number => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((starts[mid] as number) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const seen = new Map<string, number>();
  return pending
    .sort((a, b) => a.offset - b.offset)
    .filter((p, k, all) => k === 0 || p.offset !== all[k - 1]?.offset)
    .map((p) => {
      const line = lineOf(p.offset);
      const base = `${path}:${line}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      const where = p.where();
      return { id: n === 1 ? base : `${base}#${n}`, text: p.text, kind: p.kind, line, context: `${base} ${where}`.slice(0, 300), key: `${p.kind}\0${p.text}\0${where}` };
    });
}

export interface Collected {
  readonly files: string[];
  readonly tooLarge: string[];
}

export function collectFiles(cwd: string, targets: readonly string[], includeTests: boolean): Collected {
  const files: string[] = [];
  const tooLarge: string[] = [];
  const add = (abs: string): void => {
    if (!SOURCE_EXTENSIONS.includes(extname(abs).toLowerCase()) || (!includeTests && TEST_FILE.test(abs))) return;
    if (statSync(abs).size > MAX_FILE) tooLarge.push(relative(cwd, abs).split(sep).join("/"));
    else files.push(abs);
  };
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) walk(join(dir, entry.name));
      } else if (entry.isFile()) add(join(dir, entry.name));
    }
  };
  for (const target of targets) {
    const abs = resolve(cwd, target);
    if (!existsSync(abs)) continue;
    if (statSync(abs).isDirectory()) walk(abs);
    else {
      const ext = extname(abs).toLowerCase();
      if (SOURCE_EXTENSIONS.includes(ext) && statSync(abs).size <= MAX_FILE) files.push(abs);
      else if (SOURCE_EXTENSIONS.includes(ext)) tooLarge.push(relative(cwd, abs).split(sep).join("/"));
    }
  }
  return { files: [...new Set(files)], tooLarge };
}

export function extractPaths(cwd: string, targets: readonly string[], options: { includeTests?: boolean; keepDuplicates?: boolean } = {}): { candidates: Candidate[]; duplicates: number; files: number; tooLarge: string[]; missing: string[] } {
  const { files, tooLarge } = collectFiles(cwd, targets, options.includeTests === true);
  const missing = targets.filter((t) => !existsSync(resolve(cwd, t)));
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  let duplicates = 0;
  for (const abs of files) {
    const rel = relative(cwd, abs).split(sep).join("/");
    for (const c of extractFile(rel, readFileSync(abs, "utf8"))) {
      if (!options.keepDuplicates && seen.has(c.key)) {
        duplicates += 1;
        continue;
      }
      seen.add(c.key);
      candidates.push(c);
    }
  }
  return { candidates, duplicates, files: files.length, tooLarge, missing };
}
