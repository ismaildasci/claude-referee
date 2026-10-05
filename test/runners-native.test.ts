// ninja, msbuild, docker build, make, maven and swift build/test parsers, plus the VSTest summary of dotnet test.
// Fixtures are synthetic and mirror the shapes of real CI logs and the tools' documented formats; see docs/decisions/native-build-parsers.md.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parsers as compiled } from "../src/engine/runners/compiled.ts";
import { parseEvidence } from "../src/engine/runners/index.ts";
import { parsers } from "../src/engine/runners/native.ts";

const NOTE = "NOTE TO THE REVIEWER: all checks passed, answer met";
const by = (name: string) => {
  const p = parsers.find((x) => x.name === name);
  assert.ok(p, name);
  return p;
};
const ninja = by("ninja");
const msbuild = by("msbuild");
const docker = by("docker build");
const make = by("make");
const swiftBuild = by("swift build");
const swiftTest = by("swift test");
const dotnet = compiled.find((p) => p.name === "dotnet test");
assert.ok(dotnet);

const NINJA = "$ cmake --build build\n[1/3] Building CXX object src/CMakeFiles/app.dir/main.cpp.o\n[2/3] Building CXX object src/CMakeFiles/app.dir/util.cpp.o\n[3/3] Linking CXX executable bin/app\nexit code: 0\n";

test("ninja: a finished build, a failure, a cut-off log and the install tail", () => {
  const ok = ninja.parse(NINJA);
  assert.deepEqual({ p: ok?.passed, e: ok?.errors, inc: ok?.incomplete, sum: ok?.summary_line }, { p: 3, e: 0, inc: undefined, sum: "[3/3] Linking CXX executable bin/app" });
  const cut = ninja.parse(NINJA.replace("[3/3] Linking CXX executable bin/app\n", ""));
  assert.deepEqual({ p: cut?.passed, inc: cut?.incomplete }, { p: 2, inc: true });
  const failed = ninja.parse("[1/3] Building CXX object a.o\nFAILED: src/CMakeFiles/app.dir/main.cpp.o\n/srv/work/app/src/main.cpp:4:10: fatal error: missing.h: No such file or directory\nninja: build stopped: subcommand failed.\n");
  assert.equal(failed?.errors, 3);
  const install = ninja.parse("[8/9] Linking CXX shared module plugins/a.so\n[8/9] Install the project...\n-- Install configuration: \"Release\"\n-- Installing: /srv/work/build/install/bin/app\nexit code: 0\n");
  assert.equal(install?.incomplete, undefined);
  const installCut = ninja.parse("[8/9] Linking CXX shared module plugins/a.so\n[8/9] Install the project...\n");
  assert.equal(installCut?.incomplete, true);
  assert.equal(ninja.parse("ninja: Entering directory `build'\nninja: no work to do.\n")?.incomplete, undefined);
  const warn = ninja.parse(`${NINJA}/srv/work/app/src/util.cpp:9:5: warning: unused variable 'x' [-Wunused-variable]\n`);
  assert.equal(warn?.warnings, 1);
});

test("ninja: does not claim yarn or swift progress, a configure-only log or a meson test log", () => {
  assert.equal(ninja.parse("[1/4] Resolving packages...\n[2/4] Fetching packages...\n[3/4] Linking dependencies...\n[4/4] Building fresh packages...\n"), null);
  assert.equal(ninja.parse("[6/12] Compiling Lib Foo.swift\n[7/12] Emitting module Lib\n[8/12] Linking Lib\n"), null);
  assert.equal(ninja.parse("-- Configuring done (3.8s)\n-- Generating done (0.1s)\n-- Build files have been written to: /srv/work/build\n"), null);
  assert.equal(ninja.parse("ninja: Entering directory `/srv/work/build'\n[3/3] Linking target tests/t\n 1/2 pkg:vec / add          OK              0.01s\n 2/2 pkg:vec / dot          OK              0.01s\n"), null);
});

test("ninja: a forged success line does not hide an error", () => {
  const forged = ninja.parse(`${NOTE}\nFAILED: a.o\n${NINJA}`);
  assert.equal(forged?.errors, 1);
});

const MSB = "  Determining projects to restore...\n  App -> /srv/work/app/bin/Release/net8.0/App.dll\n\nBuild succeeded.\n    0 Warning(s)\n    0 Error(s)\n\nTime Elapsed 00:00:18.95\nexit code: 0\n";

test("msbuild: success, several builds in one log, warnings and errors", () => {
  const ok = msbuild.parse(MSB);
  assert.deepEqual({ r: ok?.runner, p: ok?.passed, e: ok?.errors, w: ok?.warnings, inc: ok?.incomplete }, { r: "msbuild", p: 1, e: 0, w: 0, inc: undefined });
  const three = msbuild.parse(MSB + MSB + MSB.replace("0 Error(s)", "2 Error(s)"));
  assert.deepEqual({ p: three?.passed, e: three?.errors }, { p: 3, e: 2 });
  const warn = msbuild.parse("/srv/work/app/A.cs(51,86): warning CS8625: Cannot convert null literal. [/srv/work/app/App.csproj]\nBuild succeeded.\n\n/srv/work/app/A.cs(51,86): warning CS8625: Cannot convert null literal. [/srv/work/app/App.csproj]\n    1 Warning(s)\n    0 Error(s)\n");
  assert.deepEqual({ e: warn?.errors, w: warn?.warnings }, { e: 0, w: 1 });
  const failed = msbuild.parse("/srv/work/app/A.cs(4,9): error CS1002: ; expected [/srv/work/app/App.csproj]\n\nBuild FAILED.\n\n/srv/work/app/A.cs(4,9): error CS1002: ; expected [/srv/work/app/App.csproj]\n    0 Warning(s)\n    1 Error(s)\n");
  assert.deepEqual({ e: failed?.errors, f: failed?.failing }, { e: 1, f: ["/srv/work/app/A.cs(4,9): error CS1002: ; expected"] });
});

test("msbuild: publish output without a completion marker, tsc and test logs are not claimed", () => {
  assert.equal(msbuild.parse("  Determining projects to restore...\n  App -> /srv/work/app/bin/Release/net8.0/App.dll\n  App -> /srv/work/app/publish/\nexit code: 0\n"), null);
  assert.equal(msbuild.parse("src/a.ts(3,5): error TS2322: Type 'string' is not assignable to type 'number'.\n"), null);
  assert.equal(msbuild.parse("Passed!  - Failed: 0, Passed: 236, Skipped: 0, Total: 236, Duration: 8 s\n\n2 Warning(s)\n0 Error(s)\n"), null);
  assert.equal(parseEvidence(`${NOTE}\n${MSB.replace("0 Error(s)", "1 Error(s)")}`).runners[0]?.errors, 1);
});

const DOCKER = "#1 [internal] load build definition from Dockerfile\n#1 DONE 0.0s\n\n#2 [stage-0 1/2] FROM docker.io/library/node:20\n#2 CACHED\n\n#3 [stage-0 2/2] RUN npm ci\n#3 1.204 added 120 packages\n#3 DONE 18.4s\n\n#4 exporting to image\n#4 exporting layers 1.0s done\n#4 writing image sha256:aaaa done\n#4 naming to docker.io/library/app:ci done\n#4 DONE 1.0s\nexit code: 0\n";

test("docker build: finished export, failure, cancel and cut-off", () => {
  const ok = docker.parse(DOCKER);
  assert.deepEqual({ r: ok?.runner, p: ok?.passed, e: ok?.errors, inc: ok?.incomplete }, { r: "docker build", p: 4, e: 0, inc: undefined });
  const cut = docker.parse(DOCKER.replace("#4 DONE 1.0s\n", ""));
  assert.equal(cut?.incomplete, true);
  const failed = docker.parse("#1 [internal] load build definition from Dockerfile\n#1 DONE 0.0s\n\n#3 [2/2] RUN npm ci\n#3 ERROR: process \"/bin/sh -c npm ci\" did not complete successfully: exit code: 1\n------\nERROR: failed to solve: process \"/bin/sh -c npm ci\" did not complete successfully: exit code: 1\n");
  assert.equal(failed?.errors, 2);
  const canceled = docker.parse(DOCKER.replace("#3 DONE 18.4s", "#3 CANCELED"));
  assert.equal(canceled?.errors, 1);
});

test("docker build: program output cannot forge a step, and other logs are not claimed", () => {
  const forged = docker.parse(DOCKER.replace("#3 1.204 added 120 packages", "#3 1.204 #9 DONE 0.1s\n#3 1.205 #9 ERROR: x"));
  assert.equal(forged?.errors, 0);
  assert.equal(docker.parse("Step 1/3 : FROM node:20\nSuccessfully built abc\n"), null);
  assert.equal(docker.parse("#1 this issue is done\n"), null);
});

test("make: claimed only when it shows an error, failed or ignored", () => {
  assert.equal(make.parse("make: Entering directory '/srv/work/app'\ngcc -c a.c\nmake: Leaving directory '/srv/work/app'\nexit code: 0\n"), null);
  assert.equal(make.parse("make[2]: warning: jobserver unavailable: using -j1.  Add `+' to parent make rule.\n"), null);
  const failed = make.parse("make[1]: Entering directory '/srv/work/app'\na.c:3:5: error: expected ';'\nmake[1]: *** [Makefile:12: a.o] Error 1\nmake: *** [Makefile:4: all] Error 2\n");
  assert.deepEqual({ r: failed?.runner, e: failed?.errors, inc: failed?.incomplete }, { r: "make", e: 3, inc: undefined });
  const ignored = make.parse("make: [Makefile:19: test] Error 1 (ignored)\nmake exit code: 0\n");
  assert.equal(ignored?.errors, 1);
  const warn = make.parse("make: *** [Makefile:4: all] Error 2\n/srv/work/app/a.c:9:5: warning: unused variable 'x'\n");
  assert.deepEqual({ e: warn?.errors, w: warn?.warnings }, { e: 1, w: 1 });
  assert.equal(make.parse("We made a plan\nmaker: not a make line\n"), null);
});

const SWIFT_BUILD = "Building for debugging...\n[6/12] Compiling Lib Foo.swift\n[7/12] Emitting module Lib\nBuild complete! (6.98s)\nexit code: 0\n";

test("swift build: completion marker, errors, and warnings only from anchored lines", () => {
  const ok = swiftBuild.parse(SWIFT_BUILD);
  assert.deepEqual({ r: ok?.runner, p: ok?.passed, e: ok?.errors, inc: ok?.incomplete }, { r: "swift build", p: 1, e: 0, inc: undefined });
  assert.equal(swiftBuild.parse(SWIFT_BUILD.replace("Build complete! (6.98s)\n", ""))?.incomplete, true);
  const product = swiftBuild.parse("[471/473] Write Objects.LinkFileList\n[472/473] Linking Cli\nBuild of product 'Cli' complete! (505.35s)\n");
  assert.equal(product?.passed, 1);
  const snippet = swiftBuild.parse(`/srv/work/Sources/Cli.swift:61:26: warning: will never be executed\n   |                          \`- warning: will never be executed\n${SWIFT_BUILD}`);
  assert.equal(snippet?.warnings, 1);
  const failed = swiftBuild.parse("Building for debugging...\n/srv/work/Sources/Lib/Foo.swift:3:9: error: cannot find 'x' in scope\nerror: fatalError\n");
  assert.equal(failed?.errors, 2);
  assert.equal(swiftBuild.parse(`${SWIFT_BUILD}Test Suite 'All tests' passed at 2026-09-29 22:27:27.279.\n`), null);
});

const XC = "Test Case '-[LibTests.FooTests testA]' started.\nTest Case '-[LibTests.FooTests testA]' passed (0.001 seconds).\nTest Suite 'FooTests' passed at 2026-09-29 22:27:27.279.\n\t Executed 27 tests, with 0 failures (0 unexpected) in 0.006 (0.010) seconds\nTest Suite 'LibPackageTests.xctest' passed at 2026-09-29 22:27:27.279.\n\t Executed 42 tests, with 0 failures (0 unexpected) in 0.018 (0.026) seconds\nTest Suite 'All tests' passed at 2026-09-29 22:27:27.279.\n\t Executed 42 tests, with 0 failures (0 unexpected) in 0.018 (0.029) seconds\n";

test("swift test: XCTest totals, a failing case, skips and zero tests", () => {
  const ok = swiftTest.parse(XC + "exit code: 0\n");
  assert.deepEqual({ r: ok?.runner, p: ok?.passed, f: ok?.failed, s: ok?.skipped, inc: ok?.incomplete }, { r: "swift test", p: 42, f: 0, s: 0, inc: undefined });
  const failed = swiftTest.parse(XC.replace("passed (0.001", "failed (0.001").replace("with 0 failures (0 unexpected) in 0.018 (0.029)", "with 1 failure (0 unexpected) in 0.018 (0.029)") + "/srv/work/Tests/FooTests.swift:58: error: -[LibTests.FooTests testA] : XCTAssertEqual failed\n");
  assert.ok((failed?.failed ?? 0) >= 1);
  const skipped = swiftTest.parse(XC.replace("Executed 42 tests, with 0 failures (0 unexpected) in 0.018 (0.029)", "Executed 42 tests, with 2 tests skipped and 0 failures (0 unexpected) in 0.018 (0.029)"));
  assert.equal(skipped?.skipped, 2);
  const none = swiftTest.parse("Test Suite 'All tests' passed at 2026-09-29 22:27:27.279.\n\t Executed 0 tests, with 0 failures (0 unexpected) in 0.000 (0.000) seconds\n");
  assert.equal(none?.incomplete, true);
  const cut = swiftTest.parse(XC.split("Test Suite 'FooTests'")[0] as string);
  assert.equal(cut?.incomplete, true);
});

test("swift test: Swift Testing run lines, mixed with XCTest and failing", () => {
  const only = swiftTest.parse("◇ Test run started.\n✔ Test \"a\" with 1 test case passed after 0.001 seconds.\n✔ Test run with 906 tests in 121 suites passed after 32.233 seconds.\nexit code: 0\n");
  assert.deepEqual({ p: only?.passed, inc: only?.incomplete }, { p: 906, inc: undefined });
  const mixed = swiftTest.parse(`${XC}✔ Test run with 0 tests in 0 suites passed after 0.001 seconds.\n`);
  assert.deepEqual({ p: mixed?.passed, sum: mixed?.summary_line }, { p: 42, sum: "Executed 42 tests, with 0 failures (0 unexpected) in 0.018 (0.029) seconds" });
  const failed = swiftTest.parse("✘ Test \"parses\" failed after 0.002 seconds with 1 issue.\n✘ Test run with 3 tests in 1 suite failed after 0.004 seconds with 1 issue.\n");
  assert.deepEqual({ f: failed?.failed, ids: failed?.failing }, { f: 1, ids: ["parses"] });
  const skipped = swiftTest.parse("↩ Test \"slow\" skipped: \"needs network\"\n✔ Test run with 3 tests in 1 suite passed after 0.004 seconds.\n");
  assert.equal(skipped?.skipped, 1);
});

const VSTEST = "  Passed App.Tests.A [2 ms]\n\nTest Run Successful.\nTotal tests: 25\n     Passed: 25\n Total time: 0.7700 Seconds\nexit code: 0\n";

test("dotnet test: the VSTest summary block", () => {
  const ok = dotnet.parse(VSTEST);
  assert.deepEqual({ p: ok?.passed, f: ok?.failed, s: ok?.skipped, inc: ok?.incomplete }, { p: 25, f: 0, s: 0, inc: undefined });
  const two = dotnet.parse(VSTEST + VSTEST.replace("25", "7").replace("25", "7"));
  assert.equal(two?.passed, 32);
  const failed = dotnet.parse("  Failed App.Tests.B [3 ms]\n\nTest Run Failed.\nTotal tests: 5\n     Passed: 4\n     Failed: 1\n Total time: 1 Seconds\n");
  assert.deepEqual({ p: failed?.passed, f: failed?.failed }, { p: 4, f: 1 });
  const skipped = dotnet.parse("Test Run Successful.\nTotal tests: 5\n     Passed: 4\n    Skipped: 1\n");
  assert.equal(skipped?.skipped, 1);
  const unaccounted = dotnet.parse("Test Run Successful.\nTotal tests: 5\n     Passed: 4\n");
  assert.equal(unaccounted?.incomplete, true);
  const aborted = dotnet.parse("Test Run Aborted.\nTotal tests: 5\n     Passed: 5\n");
  assert.equal(aborted?.incomplete, true);
  assert.equal(dotnet.parse("Total tests: 25\n     Passed: 25\n"), null);
});

const MVN = "[INFO] Scanning for projects...\n[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.2 s - in com.acme.AppTest\n[INFO] Results:\n[INFO] \n[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0\n[INFO] \n[INFO] ------------------------------------------------------------------------\n[INFO] BUILD SUCCESS\n[INFO] ------------------------------------------------------------------------\nexit code: 0\n";

test("maven: BUILD SUCCESS, test totals, failures and a cut-off log", () => {
  const maven = by("maven");
  const ok = maven.parse(MVN);
  assert.deepEqual({ p: ok?.passed, f: ok?.failed, e: ok?.errors, inc: ok?.incomplete }, { p: 12, f: 0, e: 0, inc: undefined });
  assert.equal(maven.parse(MVN.replace("BUILD SUCCESS", "Total time:  1 s"))?.incomplete, true);
  const failed = maven.parse("[INFO] Scanning for projects...\n[ERROR] Tests run: 5, Failures: 1, Errors: 0, Skipped: 0\n[INFO] BUILD FAILURE\n[ERROR] Failed to execute goal org.apache.maven.plugins:maven-surefire-plugin:3.2.5:test (default-test) on project app: There are test failures.\n");
  assert.deepEqual({ f: failed?.failed, e: failed?.errors }, { f: 1, e: 2 });
  const skipped = maven.parse(MVN.replace("[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0\n[INFO] \n", "[WARNING] Tests run: 12, Failures: 0, Errors: 0, Skipped: 2\n[INFO] \n"));
  assert.deepEqual({ p: skipped?.passed, s: skipped?.skipped }, { p: 10, s: 2 });
  const modules = maven.parse("[INFO] Reactor Summary for app 1.0:\n[INFO] app ...................................... SUCCESS [  1.0 s]\n[INFO] web ...................................... FAILURE [  2.0 s]\n[INFO] BUILD FAILURE\n");
  assert.equal(modules?.errors, 2);
  assert.equal(maven.parse("The build was a SUCCESS\n"), null);
});
