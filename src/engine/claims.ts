// Code-side checks of a claim against its source: quotes and numbers are matched before any model call.
// Linear time, never throws; the caller decides what a missing quote or number means.

export interface ClaimCheck {
  readonly quotes: readonly string[];
  readonly quotes_missing: readonly string[];
  readonly numbers: readonly string[];
  readonly numbers_missing: readonly string[];
}

const DASHES = /[‐-―−]/g;
const CURLY_DOUBLE = /[“”„‟]/g;
const CURLY_SINGLE = /[‘’‚‛]/g;
const SPACES = /\s+/g;

const CORE = String.raw`(?:\d{4}-\d{2}-\d{2}(?!\d)|[vV]\d+(?:\.\d+)+(?!\d)|\d+(?:\.\d+){2,}(?!\d)|0[xX][0-9a-fA-F]+|(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?!\d))`;
const NUMBER_SOURCE = String.raw`(?<![\p{L}\p{N}_.])[$€£]?${CORE}(?:%|[xX](?![\p{L}\p{N}_]))?`;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const VERSION = /^v?\d+(?:\.\d+){2,}$|^v\d/;
const ORDINAL = /^(?:st|nd|rd|th)(?![\p{L}])/iu;
const LETTER = /^\p{L}/u;
const MAX_SMALL_INT = 10;

function baseNormalize(text: string): string {
  return text.normalize("NFKC").replace(DASHES, "-").replace(CURLY_DOUBLE, '"').replace(CURLY_SINGLE, "'");
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char);
}

function stripEmphasis(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i] as string;
    if (char === "*") continue;
    if (char === "_") {
      let end = i;
      while (text[end + 1] === "_") end++;
      const edge = !isWordChar(text[i - 1]) || !isWordChar(text[end + 1]);
      if (!edge) out += text.slice(i, end + 1);
      i = end;
      continue;
    }
    out += char;
  }
  return out;
}

function normalizeForQuote(text: string): string {
  return stripEmphasis(baseNormalize(text)).replace(SPACES, " ").trim().toLowerCase();
}

function extractQuotes(claim: string): string[] {
  const found = new Set<string>();
  let open: string | null = null;
  let start = 0;
  for (let i = 0; i < claim.length; i++) {
    const char = claim[i] as string;
    if (open === null) {
      if (char === '"' || char === "“" || char === "„" || char === "‟" || char === "`") {
        open = char;
        start = i + 1;
      }
      continue;
    }
    const closes = open === "`" ? char === "`" : char === '"' || char === "”";
    if (!closes) continue;
    const text = claim.slice(start, i).trim();
    if (text.length >= 3) found.add(text);
    open = null;
  }
  return [...found];
}

function numberKey(token: string): string {
  let t = token.toLowerCase().replace(/^[$€£]/, "");
  if (/^0x/.test(t)) return t;
  t = t.replace(/[%x]$/, "");
  if (DATE.test(t)) return t;
  if (VERSION.test(t)) return t.replace(/^v/, "");
  const [whole = "", frac = ""] = t.replace(/,/g, "").split(".");
  const intPart = whole.replace(/^0+(?=\d)/, "");
  const fracPart = frac.replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

function isIgnoredSmallInteger(token: string, after: string): boolean {
  if (!/^\d+$/.test(token) || Number(token) > MAX_SMALL_INT) return false;
  return !LETTER.test(after) || ORDINAL.test(after);
}

function extractNumbers(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(new RegExp(NUMBER_SOURCE, "gu"))) {
    const token = match[0];
    const after = text.slice(match.index + token.length, match.index + token.length + 3);
    if (!isIgnoredSmallInteger(token, after)) found.add(token);
  }
  return [...found];
}

function sourceNumberKeys(source: string): Set<string> {
  const keys = new Set<string>();
  for (const match of source.matchAll(new RegExp(NUMBER_SOURCE, "gu"))) keys.add(numberKey(match[0]));
  return keys;
}

export function checkClaim(claim: string, source: string): ClaimCheck {
  const quotes = extractQuotes(claim);
  const numbers = extractNumbers(baseNormalize(claim));

  let quotesMissing: string[] = [];
  if (quotes.length > 0) {
    const haystack = normalizeForQuote(source);
    quotesMissing = quotes.filter((quote) => !haystack.includes(normalizeForQuote(quote)));
  }

  let numbersMissing: string[] = [];
  if (numbers.length > 0) {
    const keys = sourceNumberKeys(baseNormalize(source));
    numbersMissing = numbers.filter((token) => !keys.has(numberKey(token)));
  }

  return { quotes, quotes_missing: quotesMissing, numbers, numbers_missing: numbersMissing };
}
