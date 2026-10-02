// Runs `claude plugin validate --strict --json` and fails on every error or warning except the one known reserved-name error for "claude-referee".
// `--self-test` proves the filter: a temp manifest copy with an unrelated defect must still fail.

import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KNOWN = 'Plugin name "claude-referee" is reserved: it passes as one of Anthropic';

function collect(node, out) {
  if (Array.isArray(node)) {
    for (const item of node) collect(item, out);
  } else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if ((key === "errors" || key === "warnings") && Array.isArray(value)) {
        for (const item of value) out.push({ kind: key, item });
      } else {
        collect(value, out);
      }
    }
  }
  return out;
}

export function unexpectedProblems(report) {
  const problems = collect(report, []).filter(
    ({ kind, item }) => !(kind === "errors" && typeof item?.message === "string" && item.message.includes(KNOWN)),
  );
  if (problems.length === 0 && report?.success === false && collect(report, []).length === 0) {
    return [{ kind: "errors", item: { message: "validation failed without a listed problem" } }];
  }
  return problems;
}

function validate(target) {
  const run = spawnSync("claude", ["plugin", "validate", "--strict", "--json", target], { encoding: "utf8" });
  let report;
  try {
    report = JSON.parse(run.stdout);
  } catch {
    return [{ kind: "errors", item: { message: `no JSON report for ${target}: ${run.stderr || run.stdout}` } }];
  }
  return unexpectedProblems(report);
}

function show(target, problems) {
  for (const { kind, item } of problems) console.error(`${target}: ${kind}: ${item.path ?? ""} ${item.message}`);
}

function selfTest(root) {
  const dir = mkdtempSync(join(tmpdir(), "validate-self-"));
  mkdirSync(join(dir, ".claude-plugin"));
  const manifest = JSON.parse(readFileSync(join(root, ".claude-plugin", "marketplace.json"), "utf8"));
  manifest.plugins[0].source = 123;
  writeFileSync(join(dir, ".claude-plugin", "marketplace.json"), JSON.stringify(manifest));
  const problems = validate(dir);
  if (problems.length === 0) {
    console.error("self-test failed: an unrelated manifest defect passed the filter");
    return 1;
  }
  console.log(`self-test ok: unrelated defect rejected (${problems.length} problem(s))`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(import.meta.url), "..", "..");
  const args = process.argv.slice(2);
  let code = 0;
  if (args[0] === "--self-test") {
    code = selfTest(root);
  } else {
    for (const target of args.length ? args : [root, join(root, "plugins", "claude-referee")]) {
      const problems = validate(target);
      show(target, problems);
      if (problems.length) code = 1;
      else console.log(`${target}: ok (known reserved-name error ignored)`);
    }
  }
  process.exit(code);
}
