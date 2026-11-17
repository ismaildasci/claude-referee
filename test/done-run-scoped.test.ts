// docs/decisions/done-run-scoped.md: `done --run "<tool> <paths>"` runs eslint or vitest on existing paths inside the project, only when a script already runs the tool with no config-changing flag and its binary is in node_modules.
// Projects are invented temp folders with fake tools in node_modules/.bin; the fake Jev answers 0.9. S1 resolution, S2 no shell, S3 scope cap, S4 facts; the cases an independent review added are marked (review).

import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { test } from "node:test";
import { posixTest } from "./posix-test.ts";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { namesScope, scopedCheck, SCOPED_PATHS_MAX, toolFlags, withoutScopeNames } from "../src/engine/run-check.ts";
import { fakeJev } from "./fake-jev.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const SILENT = "#!/bin/sh\nexit 0\n";
const WARNS = '#!/bin/sh\nprintf "\\n/srv/web/src/a.js\\n  3:1  warning  Unexpected console statement  no-console\\n\\n\\342\\234\\226 1 problem (0 errors, 1 warning)\\n\\n"\nexit 0\n';
const FAILS = '#!/bin/sh\nprintf "\\n/srv/web/src/a.js\\n  3:1  error  Unexpected var  no-var\\n\\n\\342\\234\\226 1 problem (1 error, 0 warnings)\\n\\n"\nexit 1\n';
const ARGS = '#!/bin/sh\nfor a in "$@"; do printf "%s\\n" "$a" >> args.txt; done\nexit 0\n';
const VITEST = '#!/bin/sh\nprintf "\\n RUN  v3.2.7 /srv/web\\n\\n \\342\\234\\223 src/a.test.js (3 tests) 4ms\\n\\n Test Files  1 passed (1)\\n      Tests  3 passed (3)\\n   Duration  120ms\\n\\n"\nexit 0\n';
const NO_FILES = '#!/bin/sh\nprintf "\\n RUN  v5.1.0 /srv/web\\n\\nNo test files found, exiting with code 0\\n\\n"\nexit 0\n';
const OSC = '#!/bin/sh\nprintf "\\033]0;3 problems found"\nexit 0\n';

function project(tools: Record<string, string>, scripts: Record<string, string> = { lint: "eslint .", test: "vitest run" }): string {
  const dir = tempDir();
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "web", scripts }));
  mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
  mkdirSync(join(dir, "src"));
  mkdirSync(join(dir, "tests"));
  for (const f of ["src/a.js", "src/b.js", "src/a.test.js", "src/index.js", "src/data.js", "tests/helper.js"]) writeFileSync(join(dir, f), "");
  for (const [name, body] of Object.entries(tools)) {
    writeFileSync(join(dir, "node_modules", ".bin", name), body);
    chmodSync(join(dir, "node_modules", ".bin", name), 0o755);
  }
  return dir;
}

async function doneRun(cwd: string, args: string[]): Promise<{ code: number; out: Record<string, unknown> }> {
  const fake = await fakeJev();
  try {
    const home = tempDir();
    const io = memoryIo({ cwd, home, platform: "linux", env: { HOME: home, PATH: process.env["PATH"], TYPESAFE_BASE_URL: fake.url, REFEREE_BASE_URL_KEY: "test-key" } });
    const code = await run(["done", ...args], io, commands);
    return { code, out: JSON.parse(io.out.join("").trim().split("\n").at(-1) ?? "{}") as Record<string, unknown> };
  } finally {
    await fake.close();
  }
}

const refusal = (spec: string, dir: string, root = dir): string => {
  try {
    scopedCheck(spec, dir, root);
    return "";
  } catch (e) {
    const error = e as { code?: string; message?: string };
    return error.code === "bad_input" ? (error.message ?? "refused") : `other error: ${String(e)}`;
  }
};

test("S1: eslint and vitest resolve with paths; folders are shown with a slash; any other first word is left to the family rule", () => {
  const dir = project({ eslint: SILENT, vitest: VITEST }, { lint: "eslint . && tsc", test: "vitest" });
  const lint = scopedCheck("eslint src/a.js src/b.js", dir, dir);
  assert.deepEqual([lint?.family, lint?.tool, lint?.shown, lint?.criterion, lint?.dir], ["lint", "eslint", "eslint src/a.js src/b.js", "eslint finds no problems in src/a.js, src/b.js", dir]);
  assert.equal(lint?.command, `'${join(dir, "node_modules", ".bin", "eslint")}' '${join(dir, "src", "a.js")}' '${join(dir, "src", "b.js")}'`);
  assert.deepEqual(lint?.scope.map((p) => [p.typed, p.dir]), [["src/a.js", false], ["src/b.js", false]]);
  assert.deepEqual([scopedCheck("eslint src", dir, dir)?.criterion, scopedCheck("eslint src/ tests", dir, dir)?.criterion], ["eslint finds no problems in src/", "eslint finds no problems in src/, tests/"]);
  for (const spec of ["vitest run src/a.test.js", "vitest src/a.test.js"]) {
    const t = scopedCheck(spec, dir, dir);
    assert.deepEqual([t?.family, t?.shown, t?.criterion], ["test", "vitest run src/a.test.js", "the tests in src/a.test.js pass"]);
    assert.ok(t?.command.includes("vitest' run '"), spec);
  }
  for (const spec of ["npm run lint", "lint", "eslint", "rm -rf /", "jest src/a.test.js", "tsc src/a.js", "oxlint src/a.js", "FOO=1 eslint src/a.js", "constructor src/a.js", "__proto__ src/a.js", "toString src/a.js", ""]) assert.equal(scopedCheck(spec, dir, dir), null, spec);
  assert.equal(scopedCheck("eslint a.js", join(dir, "src"), dir)?.command.endsWith(`'${join(dir, "src", "a.js")}'`), true);
});

test("S1 (review): the default criterion names only the paths the 80-character command fact shows", () => {
  const dir = project({ eslint: SILENT });
  mkdirSync(join(dir, "src", "components", "forms"), { recursive: true });
  const long = ["Button", "Input", "Select", "Checkbox", "Radio", "Toggle", "Slider"].map((n) => `src/components/forms/${n}.component.js`);
  for (const f of long) writeFileSync(join(dir, f), "");
  const check = scopedCheck(`eslint ${long.join(" ")}`, dir, dir);
  assert.equal(check?.criterion, `eslint finds no problems in ${long[0]} and 6 more`);
  assert.ok((check?.shown.slice(0, 80) ?? "").includes(long[0] as string));
  writeFileSync(join(dir, "src", `${"x".repeat(90)}.js`), "");
  assert.equal(scopedCheck(`eslint src/${"x".repeat(90)}.js`, dir, dir)?.criterion, "eslint finds no problems in the given paths");
  const five = scopedCheck("eslint src/a.js src/b.js src/a.js src/b.js src/a.js src/b.js src/a.js", dir, dir);
  assert.equal(five?.criterion, "eslint finds no problems in src/a.js, src/b.js, src/a.js, src/b.js, src/a.js and 2 more");
});

test("S1: a flag, a missing or outside path, a tool no script runs, a missing or outside binary, too many paths and a second line are refused, each for its own reason", () => {
  const dir = project({ eslint: SILENT });
  const outside = tempDir();
  writeFileSync(join(outside, "evil.js"), "");
  symlinkSync(join(outside, "evil.js"), join(dir, "src", "link.js"));
  symlinkSync(outside, join(dir, "src", "linkdir"));
  const cases: [string, RegExp][] = [
    ["eslint --fix src/a.js", /takes paths only, not "--fix"/],
    ["eslint -c other.json src/a.js", /takes paths only, not "-c"/],
    ["eslint src/a.js --quiet", /takes paths only, not "--quiet"/],
    ["eslint src/missing.js", /"src\/missing.js" does not exist inside this project/],
    [`eslint ${join(outside, "evil.js")}`, /does not exist inside this project/],
    [`eslint ../${basename(outside)}/evil.js`, /does not exist inside this project/],
    ["eslint src/link.js", /"src\/link.js" does not exist inside this project/],
    ["eslint src/linkdir/evil.js", /does not exist inside this project/],
    ["eslint src/a.js\nsrc/b.js", /takes one line/],
    [`eslint ${Array.from({ length: SCOPED_PATHS_MAX + 1 }, () => "src/a.js").join(" ")}`, /takes 1 to 50 paths/],
    ["vitest run", /takes 1 to 50 paths/],
  ];
  for (const [spec, why] of cases) assert.match(refusal(spec, dir), why, spec);
  assert.match(refusal("vitest run src/a.test.js", project({ eslint: SILENT }, { lint: "eslint ." })), /No script in this package.json runs vitest/);
  assert.match(refusal("vitest run src/a.test.js", project({ eslint: SILENT })), /vitest is not installed in this project's node_modules/);
  assert.match(refusal("eslint a.js", join(dir, "src"), join(dir, "src")), /No package.json here/);
  const linked = project({}, { lint: "eslint ." });
  symlinkSync(join(outside, "evil.js"), join(linked, "node_modules", ".bin", "eslint"));
  assert.match(refusal("eslint src/a.js", linked), /eslint is not installed in this project's node_modules/);
});

test("S1 (review): a script that gives the tool a config-changing flag stops the scoped run; --ext stops folders only", () => {
  assert.match(refusal("eslint src/a.js", project({ eslint: SILENT }, { lint: "eslint -c strict.config.js ." })), /runs eslint with -c, which a run on paths would drop/);
  assert.match(refusal("eslint src/a.js", project({ eslint: SILENT }, { lint: "eslint .", "lint:strict": "eslint --config=strict.js ." })), /runs eslint with --config/);
  assert.match(refusal("vitest src/a.test.js", project({ vitest: VITEST }, { test: "vitest run --config vitest.e2e.config.ts" })), /runs vitest with --config/);
  const ext = project({ eslint: SILENT }, { lint: 'eslint --ext ".js,.vue" --ignore-path .gitignore . --cache' });
  assert.equal(scopedCheck("eslint src/a.js", ext, ext)?.shown, "eslint src/a.js");
  assert.match(refusal("eslint src", ext), /with --ext, which a run on a folder would drop; name files, not "src"/);
  assert.deepEqual(toolFlags(["eslint --fix . && tsc", "FOO=1 npx eslint --max-warnings=0 ."], "eslint"), ["--fix", "--max-warnings"]);
  for (const body of ["eslint&&tsc", "tsc;eslint .", "./node_modules/.bin/eslint .", "pnpm exec eslint .", "bunx eslint ."]) assert.deepEqual(toolFlags([body], "eslint"), [], body);
  for (const body of ["echo eslint is not used here", "biome lint # eslint was removed", "npm run eslint", "typedoc --plugin eslint", "vp lint", ""]) assert.equal(toolFlags([body], "eslint"), null, body);
});

test("S3 (review): a criterion names the scope only with a path-like word that is a covered path, its tail, or under a covered folder", () => {
  const dir = project({ eslint: SILENT });
  const scope = (spec: string) => scopedCheck(spec, dir, dir)?.scope ?? [];
  const file = scope("eslint src/a.js src/index.js");
  for (const c of ["eslint finds no problems in src/a.js", "a.js lints clean.", "(src/index.js) is clean", "index.js lints clean", "eslint src/a.js dosyasında hata vermez", "./src/a.js is clean"]) assert.equal(namesScope(c, file), true, c);
  for (const c of ["lint is clean", "eslint is clean on the whole project", "src/data.js is clean", "data.js is clean", "lib/index.js is clean", "src/a.jsx is clean", "the a and js files are clean", "everything in src is clean"]) assert.equal(namesScope(c, file), false, c);
  const folders = scope("eslint src tests");
  for (const c of ["eslint finds no problems in src/", "everything under tests/ lints clean", "src/a.js is clean", "tests/helper.js is clean"]) assert.equal(namesScope(c, folders), true, c);
  for (const c of ["all tests pass", "the whole test suite passes", "eslint is clean on src, lib and app (the whole project)", "the tests folder is clean", "lib/src/ is clean"]) assert.equal(namesScope(c, folders), false, c);
  assert.equal(namesScope("lint is clean in .", scope("eslint .")), false);
  assert.equal(withoutScopeNames("eslint finds no problems in src/a.test.js and tests/", scope("eslint src/a.test.js tests")).includes("test"), false);
  assert.equal(withoutScopeNames("the tests in src/a.test.js pass", scope("eslint src/a.test.js")).trim().startsWith("the tests in"), true);
});

posixTest("S1: a refused scoped string, and an environment assignment in front of one, run nothing", async () => {
  const dir = project({ eslint: ARGS });
  for (const spec of ["eslint --fix src/a.js", "FOO=1 eslint src/a.js", "constructor src/a.js"]) {
    const { code, out } = await doneRun(dir, ["--run", spec]);
    assert.deepEqual([code, out["error"]], [1, "bad_input"], spec);
  }
  assert.equal(existsSync(join(dir, "args.txt")), false);
});

posixTest("S2: a path with shell characters is one argument and nothing in it runs", async () => {
  const dir = project({ eslint: ARGS });
  const names = ["a$(touch${IFS}pwned1).js", "b;touch${IFS}pwned2;.js", "c'`touch${IFS}pwned3`'.js", "d&&touch${IFS}pwned4.js"];
  for (const n of names) writeFileSync(join(dir, "src", n), "");
  const { out } = await doneRun(dir, ["--run", `eslint ${names.map((n) => `src/${n}`).join(" ")}`]);
  assert.equal(out["run"], true);
  assert.deepEqual(readFileSync(join(dir, "args.txt"), "utf8").trim().split("\n"), names.map((n) => join(dir, "src", n)));
  for (const p of ["pwned1", "pwned2", "pwned3", "pwned4"]) assert.equal(existsSync(join(dir, p)) || existsSync(join(dir, "src", p)), false, p);
});

posixTest("S3/S4: a silent scoped eslint is a clean runner; met needs a criterion that names a path, and the default criterion does", async () => {
  const dir = project({ eslint: SILENT });
  const byDefault = await doneRun(dir, ["--run", "eslint src/a.js src/b.js"]);
  assert.deepEqual([byDefault.code, byDefault.out["verdict"], byDefault.out["trust"], byDefault.out["run"], byDefault.out["ran"]], [0, "met", "parsed", true, "eslint src/a.js src/b.js"]);
  assert.deepEqual(byDefault.out["runners"], [{ runner: "eslint", passed: 0, failed: 0, errors: 0, skipped: 0 }]);
  for (const criterion of ["eslint reports nothing for src/a.js", "b.js lints clean"]) assert.equal((await doneRun(dir, ["--run", "eslint src/a.js src/b.js", "--criteria", criterion])).out["verdict"], "met", criterion);
  for (const criterion of ["lint is clean", "eslint is clean on the whole project", "eslint finds no problems in src/c.js", "src/data.js is clean"]) {
    const generic = await doneRun(dir, ["--run", "eslint src/a.js src/b.js", "--criteria", criterion]);
    assert.deepEqual([generic.code, generic.out["verdict"], generic.out["reason"]], [3, "unsure", "scoped_run"], criterion);
    assert.match(String(generic.out["next_step"]), /covered only the paths you gave.*src\/a\.js, src\/b\.js/, criterion);
  }
  const mixed = await doneRun(dir, ["--run", "eslint src/a.js", "--criteria", "src/a.js is clean", "--criteria", "lint is clean"]);
  assert.deepEqual([mixed.out["verdict"], mixed.out["reason"]], ["unsure", "scoped_run"]);
  const sent = await doneRun(dir, ["--run", "eslint src/a.js", "--dry-run"]);
  const facts = (sent.out["sent"] as { state: { evidence: Record<string, unknown> } }[])[0]?.state.evidence;
  assert.deepEqual([facts?.["ran"], facts?.["trust"], facts?.["exit_code"]], ["eslint src/a.js", "parsed", 0]);
  assert.deepEqual(facts?.["runners"], [{ runner: "eslint", passed: 0, failed: 0, errors: 0, skipped: 0, warnings: 0, failing: [], summary_line: "eslint printed no diagnostics and exited 0" }]);
});

posixTest("S3 (review): generic folder names do not open the cap, a lint run on a test file can be met, and a whole folder by its default criterion is met", async () => {
  const lint = project({ eslint: SILENT });
  for (const [spec, criterion] of [["eslint tests", "all tests pass"], ["eslint tests", "lint is clean"], ["eslint src", "eslint is clean on src, lib and app (the whole project)"], ["eslint src/index.js", "lib/index.js is clean"]] as const) {
    const out = (await doneRun(lint, ["--run", spec, "--criteria", criterion])).out;
    assert.notEqual(out["verdict"], "met", `${spec} | ${criterion}`);
  }
  const vitest = project({ vitest: VITEST });
  for (const [spec, criterion] of [["vitest tests", "all tests pass"], ["vitest tests", "the whole test suite passes"], ["vitest src", "every spec in the project passes"]] as const) {
    assert.deepEqual([(await doneRun(vitest, ["--run", spec, "--criteria", criterion])).out["reason"]], ["scoped_run"], `${spec} | ${criterion}`);
  }
  for (const spec of ["eslint src/a.test.js", "eslint tests/helper.js", "eslint tests", "eslint .", "eslint ./"]) assert.deepEqual([(await doneRun(lint, ["--run", spec])).out["verdict"]], ["met"], spec);
  const claim = await doneRun(lint, ["--run", "eslint src/a.test.js", "--criteria", "the tests in src/a.test.js pass"]);
  assert.deepEqual([claim.out["verdict"], claim.out["reason"]], ["unsure", "no_tests_run"]);
  assert.equal((await doneRun(lint, ["--run", "eslint .", "--criteria", "lint is clean"])).out["reason"], "scoped_run");
});

posixTest("S4: printed warnings are parsed and cap a clean criterion; a failing scoped run is missing without a request; output that is not empty is never the silent fact", async () => {
  const warned = await doneRun(project({ eslint: WARNS }), ["--run", "eslint src/a.js"]);
  assert.deepEqual([warned.code, warned.out["verdict"], warned.out["reason"]], [3, "unsure", "warning_in_log"]);
  const failed = await doneRun(project({ eslint: FAILS }), ["--run", "eslint src/a.js"]);
  assert.deepEqual([failed.code, failed.out["verdict"], failed.out["reason"], failed.out["requests"]], [3, "missing", "exit_code_nonzero", 0]);
  const osc = await doneRun(project({ eslint: OSC }), ["--run", "eslint src/a.js", "--dry-run"]);
  const facts = (osc.out["sent"] as { state: { evidence: Record<string, unknown> } }[])[0]?.state.evidence;
  assert.deepEqual([facts?.["trust"], facts?.["runners"]], ["exit_code", []]);
});

posixTest("S3/S4: a scoped vitest run is parsed and a whole-suite criterion is capped; a run that found no test file is not met (review)", async () => {
  const dir = project({ vitest: VITEST });
  const named = await doneRun(dir, ["--run", "vitest run src/a.test.js"]);
  assert.deepEqual([named.code, named.out["verdict"], named.out["ran"]], [0, "met", "vitest run src/a.test.js"]);
  assert.deepEqual(named.out["runners"], [{ runner: "vitest", passed: 3, failed: 0, errors: 0, skipped: 0 }]);
  const whole = await doneRun(dir, ["--run", "vitest src/a.test.js", "--criteria", "the whole test suite passes"]);
  assert.deepEqual([whole.code, whole.out["verdict"], whole.out["reason"]], [3, "unsure", "scoped_run"]);
  assert.equal((await doneRun(dir, ["--run", "test"])).out["ran"], "npm run test");
  const none = await doneRun(project({ vitest: NO_FILES }), ["--run", "vitest src/a.js"]);
  assert.deepEqual([none.code, none.out["verdict"], none.out["reason"]], [3, "unsure", "no_tests_run"]);
});
