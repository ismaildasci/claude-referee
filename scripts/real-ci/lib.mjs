// Pure helpers of the real-log study: GitHub job-log splitting, step classifier, evidence text, intervals.
// Registered in docs/decisions/done-v2-real-logs.md; tested in test/real-ci-lib.test.ts.

import { createHash } from "node:crypto";

export const sha256 = (text) => createHash("sha256").update(text).digest("hex");

const TS = /^﻿?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z ?/;
const MARK = /^##\[(?:group|endgroup|command|error|warning|notice|debug)\]/;
const EXIT_MARK = /Process completed with exit code (-?\d+)\./;
const END_OF_STEPS = /^(?:Post job cleanup\.|Cleaning up orphan processes|Evaluate and set job outputs)/;
const USES = /^(?:\.\/|[\w.-]+\/[\w./-]+@\S+|docker:\/\/)/;

export function stripTransport(raw) {
  return raw.split(/\r?\n/).map((l) => l.replace(TS, ""));
}

// Splits a stripped job log into run-step segments: header lines, script, and output lines.
export function splitSegments(lines) {
  const segments = [];
  let cur = null;
  for (const line of lines) {
    if (line.startsWith("##[group]Run ")) {
      if (cur) segments.push(cur);
      cur = { lines: [line] };
    } else if (cur) {
      if (END_OF_STEPS.test(line)) {
        segments.push(cur);
        cur = null;
      } else cur.lines.push(line);
    }
  }
  if (cur) segments.push(cur);
  return segments.map((s) => describe(s.lines));
}

function describe(lines) {
  const end = lines.findIndex((l) => l.startsWith("##[endgroup]"));
  const header = end < 0 ? lines.slice(0, 1) : lines.slice(0, end + 1);
  const first = header[0].slice("##[group]Run ".length);
  const scriptLines = [first];
  for (const l of header.slice(1)) {
    if (/^\s*(?:shell|env|with):/.test(l) || l.startsWith("##[endgroup]")) break;
    scriptLines.push(l);
  }
  const exit = lines.map((l) => EXIT_MARK.exec(l)).filter(Boolean).map((m) => Number(m[1]));
  return { lines, script: scriptLines.join("\n"), uses: USES.test(first.trim()), exits: exit };
}

const T = (re) => new RegExp(re, "i");
const BOUND = "(?:^|[\\s;&|(`'\"])";
export const CLASSES = {
  test: [
    ["npm test", T(`${BOUND}(?:npm|pnpm|yarn|bun)\\s+(?:run\\s+)?test(?::\\S+)?\\b`)],
    ["pytest", T(`${BOUND}(?:pytest|py\\.test|python3?\\s+-m\\s+pytest)\\b`)],
    ["unittest", T(`${BOUND}python3?\\s+-m\\s+unittest\\b`)],
    ["jest", T(`${BOUND}(?:npx\\s+)?jest\\b`)],
    ["vitest", T(`${BOUND}(?:npx\\s+)?vitest\\b`)],
    ["mocha", T(`${BOUND}(?:npx\\s+)?mocha\\b`)],
    ["rspec", T(`${BOUND}(?:bundle exec\\s+)?rspec\\b`)],
    ["phpunit", T(`${BOUND}(?:vendor/bin/)?(?:phpunit|pest)\\b`)],
    ["go test", T(`${BOUND}go\\s+test\\b`)],
    ["cargo test", T(`${BOUND}cargo\\s+(?:\\+\\S+\\s+)?(?:test|nextest)\\b`)],
    ["dotnet test", T(`${BOUND}dotnet\\s+test\\b`)],
    ["maven test", T(`${BOUND}(?:\\./)?mvnw?\\b[^\\n]*\\b(?:test|verify)\\b`)],
    ["gradle test", T(`${BOUND}(?:\\./)?gradlew?\\b[^\\n]*\\btest\\b`)],
    ["ctest", T(`${BOUND}(?:ctest|meson\\s+test|bazel\\s+test)\\b`)],
    ["tox", T(`${BOUND}(?:tox|nox)\\b`)],
    ["make test", T(`${BOUND}make\\s+(?:\\S+\\s+)*(?:test|tests|check)\\b`)],
    ["swift test", T(`${BOUND}swift\\s+test\\b`)],
    ["mix test", T(`${BOUND}mix\\s+test\\b`)],
    ["dart test", T(`${BOUND}(?:dart|flutter)\\s+test\\b`)],
    ["rake test", T(`${BOUND}(?:bundle exec\\s+)?rake\\s+(?:test|spec)\\b`)],
    ["deno test", T(`${BOUND}(?:deno|bun)\\s+test\\b`)],
    ["node --test", T(`${BOUND}node\\s+(?:\\S+\\s+)*--test\\b`)],
    ["composer test", T(`${BOUND}composer\\s+(?:run\\s+)?test\\b`)],
  ],
  lint: [
    ["eslint", T(`${BOUND}(?:npx\\s+)?eslint\\b`)],
    ["prettier", T(`${BOUND}(?:npx\\s+)?prettier\\b[^\\n]*--check`)],
    ["stylelint", T(`${BOUND}(?:npx\\s+)?stylelint\\b`)],
    ["ruff", T(`${BOUND}ruff\\b`)],
    ["flake8", T(`${BOUND}flake8\\b`)],
    ["pylint", T(`${BOUND}pylint\\b`)],
    ["black", T(`${BOUND}black\\b[^\\n]*--check`)],
    ["isort", T(`${BOUND}isort\\b[^\\n]*--check`)],
    ["rubocop", T(`${BOUND}rubocop\\b`)],
    ["golangci-lint", T(`${BOUND}golangci-lint\\b`)],
    ["go vet", T(`${BOUND}go\\s+vet\\b`)],
    ["clippy", T(`${BOUND}cargo\\s+(?:\\+\\S+\\s+)?clippy\\b`)],
    ["cargo fmt", T(`${BOUND}cargo\\s+(?:\\+\\S+\\s+)?fmt\\b[^\\n]*--check`)],
    ["phpcs", T(`${BOUND}(?:vendor/bin/)?(?:phpcs|phpstan|php-cs-fixer)\\b`)],
    ["ktlint", T(`${BOUND}(?:ktlint|detekt)\\b`)],
    ["checkstyle", T(`${BOUND}(?:checkstyle|spotless)\\b|spotless(?:Check)?`)],
    ["shellcheck", T(`${BOUND}shellcheck\\b`)],
    ["hadolint", T(`${BOUND}(?:hadolint|yamllint|markdownlint)\\b`)],
    ["biome", T(`${BOUND}(?:npx\\s+)?biome\\s+(?:check|lint|ci)\\b`)],
    ["clang-tidy", T(`${BOUND}(?:clang-tidy|cppcheck|swiftlint)\\b`)],
    ["npm lint", T(`${BOUND}(?:npm|pnpm|yarn|bun)\\s+(?:run\\s+)?lint(?::\\S+)?\\b`)],
    ["make lint", T(`${BOUND}make\\s+(?:\\S+\\s+)*lint\\b`)],
    ["pre-commit", T(`${BOUND}pre-commit\\b`)],
  ],
  build: [
    ["npm build", T(`${BOUND}(?:npm|pnpm|yarn|bun)\\s+(?:run\\s+)?build(?::\\S+)?\\b`)],
    ["cargo build", T(`${BOUND}cargo\\s+(?:\\+\\S+\\s+)?(?:build|check)\\b`)],
    ["go build", T(`${BOUND}go\\s+build\\b`)],
    ["maven build", T(`${BOUND}(?:\\./)?mvnw?\\b[^\\n]*\\b(?:package|compile|install)\\b`)],
    ["gradle build", T(`${BOUND}(?:\\./)?gradlew?\\b[^\\n]*\\b(?:build|assemble)\\b`)],
    ["dotnet build", T(`${BOUND}dotnet\\s+(?:build|publish)\\b`)],
    ["make", T(`${BOUND}make(?:\\s+-\\S+)*(?:\\s+(?:all|build|release))?\\s*(?:$|[;&|\\n])`)],
    ["cmake build", T(`${BOUND}(?:cmake\\s+--build|msbuild|ninja)\\b`)],
    ["xcodebuild", T(`${BOUND}xcodebuild\\b[^\\n]*\\bbuild\\b`)],
    ["swift build", T(`${BOUND}swift\\s+build\\b`)],
    ["vite build", T(`${BOUND}(?:npx\\s+)?(?:vite|next|webpack)\\s+build\\b|${BOUND}webpack\\b`)],
    ["docker build", T(`${BOUND}docker\\s+(?:buildx\\s+)?build\\b`)],
    ["python build", T(`${BOUND}(?:python3?\\s+-m\\s+build|poetry\\s+build|hatch\\s+build)\\b`)],
    ["bazel build", T(`${BOUND}(?:bazel\\s+build|zig\\s+build|sbt\\s+compile)\\b`)],
  ],
};

const CRITERION = { test: "all tests pass", lint: "lint is clean", build: "the build succeeds" };
export const criterionOf = (purpose) => CRITERION[purpose];

// Returns { purpose, tool } or { excluded: "multi-purpose" | "none" }.
export function classify(stepName, script) {
  const text = `${stepName}\n${script.slice(0, 600)}`;
  const hits = [];
  for (const [purpose, list] of Object.entries(CLASSES)) {
    const hit = list.find(([, re]) => re.test(text));
    if (hit) hits.push({ purpose, tool: hit[0] });
  }
  if (hits.length === 0) return { excluded: "none" };
  if (hits.length > 1) return { excluded: "multi-purpose" };
  return hits[0];
}

// The evidence text of the registration: transport removed, group header turned into "$ cmd", exit line appended.
export function buildEvidence(segment) {
  const body = [];
  for (const line of segment.lines) {
    if (line.startsWith("##[group]Run ")) body.push(`$ ${line.slice("##[group]Run ".length)}`);
    else if (/^##\[(?:group|endgroup)\]\s*$/.test(line)) continue;
    else body.push(line.replace(MARK, ""));
  }
  const nonZero = segment.exits.find((c) => c !== 0);
  return { text: `${body.join("\n").replace(/\n+$/, "")}\nexit code: ${nonZero ?? 0}`, exit: nonZero ?? 0 };
}

const NOISE = /^(?:Node(?:\.js)? \d+ (?:actions )?(?:is|are) (?:being )?deprecated|Note: Using configuration file |\$ )/i;

// True when the step printed nothing of its own after the run header: only the command echo, the shell and env block,
// npm "> " and yarn "$ " echo lines, runner deprecation notices, a PHPStan config note and the exit line. Such evidence is indistinguishable from a no-op.
export function silentOutput(text) {
  const lines = text.replace(/\x1b\[[0-9;]*m/g, "").split("\n");
  const shell = lines.findIndex((l) => /^\s*shell:/.test(l));
  if (shell < 0) return false;
  let i = shell + 1;
  while (i < lines.length && (/^(?:env|with):\s*$/.test(lines[i]) || /^ {2,}[\w.-]+: /.test(lines[i]))) i += 1;
  return lines.slice(i).every((l) => l.trim() === "" || /^exit code: -?\d+$/.test(l) || l.startsWith("> ") || NOISE.test(l));
}

const RAN_NOT_CLEAN = /skipped|pending|xfail|warning|deprecat|\bFAIL|ignored|zero tests|no tests? (?:were )?found|no test files|\b0 tests|not every test|issues found|no test count|printed no result|reported no tests/i;
const NOT_RUN = /^(?:Only (?:install|adds|runs|ran|echoes|prints|reads|generates|sets|composer|apt|mozconfig|rollup|CMake|policy)|Build only|Step only|Database setup|Test binary only|Coverage report|Linter self-test|Ran the ruff formatter|--fix-only|--show-bin-path|Prettier formatting)|no (?:lint|linter|tests?|build)\b[^,;]*\b(?:ran|run|executed)\b/i;

// For an expected-missing case, from the labeller's reason: "ran_not_clean" if the check ran and its output shows a skip,
// warning, zero tests or a failure; "not_run" if the step only mentions the tool (install, echo, configure, other check).
export const negativeKind = (why) => (RAN_NOT_CLEAN.test(why) && !NOT_RUN.test(why) ? "ran_not_clean" : "not_run");

// The classifier groups phpcs, phpstan and php-cs-fixer in one class; the tool field names the one the command line runs.
export function refineTool(tool, text) {
  if (tool !== "phpcs") return tool;
  const first = text.split("\n", 1)[0];
  return /phpstan/i.test(first) ? "phpstan" : /php-cs-fixer/i.test(first) ? "php-cs-fixer" : "phpcs";
}

export function wrapperTool(text, tool) {
  const m = /^> (?:\S+@\S+ )?(?:\S+ )?(.+)$/m.exec(text.split("\n").filter((l) => l.startsWith("> ")).join("\n"));
  return m && /^(npm|pnpm|yarn|bun|make)\b/.test(tool) ? `${tool} -> ${m[1].trim().split(/\s+/).slice(0, 2).join(" ")}` : tool;
}

// Exact (Clopper-Pearson) interval by bisection on the binomial tail.
function binomCdf(k, n, p) {
  let term = (1 - p) ** n;
  let sum = k >= 0 ? term : 0;
  for (let i = 1; i <= k; i += 1) {
    term *= ((n - i + 1) / i) * (p / (1 - p));
    sum += term;
  }
  return Math.min(1, sum);
}

function solve(f, target) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (f(mid) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function clopperPearson(k, n, alpha = 0.05) {
  if (n === 0) return { lo: null, hi: null };
  const hi = k === n ? 1 : solve((p) => binomCdf(k, n, p), alpha / 2);
  return { lo: k === 0 ? 0 : solveLow(k, n, alpha / 2), hi };
}

function solveLow(k, n, tail) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (1 - binomCdf(k - 1, n, mid) < tail) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const upperOneSided = (k, n, alpha = 0.05) => (n === 0 ? null : k === n ? 1 : solve((p) => binomCdf(k, n, p), alpha));

export function kappa(pairs) {
  const labels = [...new Set(pairs.flat())];
  const n = pairs.length;
  if (n === 0) return null;
  const po = pairs.filter(([a, b]) => a === b).length / n;
  const pe = labels.reduce((s, l) => s + (pairs.filter(([a]) => a === l).length / n) * (pairs.filter(([, b]) => b === l).length / n), 0);
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}
