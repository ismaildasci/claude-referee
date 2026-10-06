// Finds skip, pending, xfail and todo markers anywhere in a log, whatever runner or nested reporter printed them.
// Only structured shapes count (a count line with a non-zero skip tally, a per-test directive); test names and prose never do.

const ANSI = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)?)/g;

const SKIP_WORD = "(?:skipped|skip|pending|todos?|xfailed|xfail|ignored|disabled|inconclusive|notrun|risky|incomplete|expected fail(?:ures?)?)";
const SKIP_WORD_RE = new RegExp(`^${SKIP_WORD}$`, "i");
const LABEL = /^(?:test result:? \w+\.?[:\s]|(?:total tests|tests?|test files?|test suites?|test cases?|suites?|specs?|examples?|results?|summary|totals?|ran|run|snapshots?|checks?|files?)\b)[:\s]*/i;
const LEVEL = /^\[(?:INFO|WARNING|WARN|ERROR)\]\s*/;
const DURATION = /\s*[-,;|]?\s*(?:in|duration:?|time elapsed:?|time:?|finished in|elapsed:?)\s+[\d.,]+\s*(?:ms|s|sec|secs|seconds?|m|min)\b.*$/i;
const COUNT_TOKEN = /^(?:(\d+)\s+(filtered out|expected fail(?:ures?)?|[A-Za-z][A-Za-z-]*)|([A-Za-z][A-Za-z-]*)(?::\s*|\s+)(\d+))(?:\s*[,;|.·]\s*|\s+|$)/;
const ECHO = /^(?:\$ |> |\+ |Run |shell: |##\[|::|\[command\])/;

const DIRECTIVES: readonly RegExp[] = [
  /^(?:#\s*)?(?:not )?ok\s+\d+\b.*\s#\s*(?:skip(?:ped)?|todo)\b/i,
  /\s# (?:SKIP|TODO)\b/,
  /\s# EXPECTED FAILURE\b/,
  /\((?:skipped|todo|pending)(?::[^)]*)?\)\s*$/i,
  /\(\d+ tests? \| (?:\d+ \w+ \| )*[1-9]\d* (?:skipped|todo|pending)\b/,
  /^\S+\.py::\S+\s+(?:SKIPPED|XFAIL)\b/,
  /^(?:SKIPPED|XFAIL)\s+(?:\[\d+\]|\S+::)/,
  /^\S+\.py\s+[.FEsxX]*[sx][.FEsxX]*(?:\s+\[\s*\d+%\])?$/,
  /^\s*--- SKIP: \S+/,
  /\.\.\. (?:skipped\b|expected failure\b)/,
  /\((?:[^)]*, )?(?:skipped|expected failures)=[1-9]/,
  /\(PENDING\b/,
  /^Pending:\s*(?:\(|$)/,
  /^\s*[○✎] (?:skipped|todo)\b/,
  /^test \S+ \.\.\. ignored\b/,
  /^(?:Passed|Failed|Skipped)!\s+-\s+Failed:\s*\d+,\s*Passed:\s*\d+,\s*Skipped:\s*[1-9]/,
  /^\s*Skipped \S.*\[\d+(?:\.\d+)? ?m?s\]\s*$/,
  /^Tests are skipped\.?$/,
  /^[^>\n].*\sSKIPPED$/,
];

function skipTokens(line: string): number {
  let rest = line.replace(LEVEL, "").replace(/^[#=ℹ\s-]+/, "").replace(LABEL, "").replace(DURATION, "").replace(/\s*\([^)]*\)/g, "").replace(/[\s=-]+$/, "");
  if (rest === "") return 0;
  let total = 0;
  let tokens = 0;
  while (rest !== "") {
    const m = COUNT_TOKEN.exec(rest);
    if (m === null) return 0;
    const [n, word] = m[1] === undefined ? [m[4] as string, m[3] as string] : [m[1], m[2] as string];
    if (SKIP_WORD_RE.test(word)) total += Number(n);
    tokens++;
    rest = rest.slice(m[0].length);
  }
  return tokens > 0 ? total : 0;
}

export function skipMarkers(text: string): string[] {
  const found: string[] = [];
  for (const raw of text.replace(ANSI, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || ECHO.test(line) || line.startsWith("> Task ")) continue;
    if (DIRECTIVES.some((d) => d.test(line)) || skipTokens(line) > 0) found.push(line.slice(0, 120));
  }
  return found;
}
