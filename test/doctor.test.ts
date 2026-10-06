// doctor: key source without the key, readiness and the online key check.
// In a project: a project file or pack that does not load is reported (the verdict stays); the done-gate mode is named, and active says it runs as shadow.

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { run } from "../src/cli/run.ts";
import { commands } from "../src/cli/commands/index.ts";
import { fakeJev } from "./fake-jev.ts";
import { memoryIo, tempDir } from "./helpers.ts";

test("doctor names the key source and never prints the key", async () => {
  const io = memoryIo({ env: { TYPESAFE_API_KEY: "ts_test_1234567890" } });
  assert.equal(await run(["doctor"], io, commands), 0);
  const text = io.out.join("");
  const out = io.json();
  assert.equal(out["key_source"], "TYPESAFE_API_KEY");
  assert.equal(out["verdict"], "ready");
  const key = "ts_test_1234567890";
  for (let i = 0; i + 6 <= key.length; i++) assert.ok(!text.includes(key.slice(i, i + 6)), key.slice(i, i + 6));
  assert.ok((out["packs"] as { name: string }[]).some((p) => p.name === "generic"));
});

test("doctor without a key is not ready and says how to add one", async () => {
  const io = memoryIo({ platform: "linux" });
  assert.equal(await run(["doctor"], io, commands), 0);
  const out = io.json();
  assert.equal(out["verdict"], "not_ready");
  assert.equal(out["key_source"], null);
  assert.match(String(out["next_step"]), /TYPESAFE_API_KEY/);
});

test("doctor --online checks the key by listing models", async () => {
  const server = await fakeJev();
  try {
    const io = memoryIo({ env: { TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url } });
    await run(["doctor", "--online"], io, commands);
    assert.deepEqual(io.json()["models"], ["jev-latest"]);
  } finally {
    await server.close();
  }
  const bad = await fakeJev(undefined, { status: 401 });
  try {
    const io = memoryIo({ env: { TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: bad.url } });
    await run(["doctor", "--online"], io, commands);
    assert.equal(io.json()["online"], "auth_failed");
    assert.equal(io.json()["verdict"], "not_ready");
  } finally {
    await bad.close();
  }
});

test("doctor shows a non-default base URL without credentials, and hides the default", async () => {
  const custom = memoryIo({ env: { TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: "https://user:hunter2secret@proxy.example.com:8443/jev/" } });
  await run(["doctor"], custom, commands);
  assert.equal(custom.json()["base_url"], "https://proxy.example.com:8443/jev");
  assert.ok(!custom.out.join("").includes("hunter2secret"));
  for (const value of [undefined, "https://api.typesafe.ai", "https://api.typesafe.ai/"]) {
    const io = memoryIo({ env: { TYPESAFE_API_KEY: "ts_test", ...(value ? { REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: value } : {}) } });
    await run(["doctor"], io, commands);
    assert.equal(io.json()["base_url"], undefined, String(value));
  }
});

test("doctor with another host and only the TypeSafe key is not ready and names REFEREE_BASE_URL_KEY", async () => {
  const io = memoryIo({ platform: "linux", env: { TYPESAFE_API_KEY: "ts_test_1234567890", TYPESAFE_BASE_URL: "https://proxy.example.test" } });
  assert.equal(await run(["doctor"], io, commands), 0);
  const out = io.json();
  assert.equal(out["verdict"], "not_ready");
  assert.equal(out["key_source"], null);
  assert.match(String(out["next_step"]), /REFEREE_BASE_URL_KEY/);
  assert.ok(!io.out.join("").includes("ts_test_1234567890"));
});

async function doctorIn(project: string | object, env: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const root = tempDir();
  mkdirSync(join(root, ".claude"));
  writeFileSync(join(root, ".claude/referee.json"), typeof project === "string" ? project : JSON.stringify(project));
  const io = memoryIo({ cwd: root, env: { TYPESAFE_API_KEY: "ts_test_1234567890", ...env } });
  assert.equal(await run(["doctor"], io, commands), 0);
  return io.json();
}

test("doctor reports a project file or pack that does not load, with a next step", async () => {
  const fine = await doctorIn({ pack: "generic", hooks: { stopGate: "shadow" } });
  assert.equal(fine["verdict"], "ready");
  assert.equal(fine["project_error"], undefined);
  assert.equal(fine["stop_gate"], "shadow");
  assert.equal(fine["stop_gate_note"], undefined);
  const missing = await doctorIn({ pack: "does-not-exist" });
  assert.equal(missing["verdict"], "ready");
  assert.equal(missing["project_error"], "pack_not_found");
  assert.match(String(missing["next_step"]), /referee\.json/);
  assert.equal((await doctorIn("{not json"))["project_error"], "bad_project");
  const packs = tempDir();
  mkdirSync(join(packs, "mine", "questions"), { recursive: true });
  writeFileSync(join(packs, "mine", "pack.json"), JSON.stringify({ name: "mine", version: "0.1.0" }));
  writeFileSync(join(packs, "mine", "questions", "done.json"), JSON.stringify({ "done.met": { type: "noul", instructions: "Is it done?" } }));
  assert.equal((await doctorIn({ pack: "mine" }, { REFEREE_PACKS_DIR: packs }))["project_error"], undefined);
  assert.equal((await doctorIn({ pack: "mine", hooks: { stopGate: "soft" } }, { REFEREE_PACKS_DIR: packs }))["project_error"], "bad_pack");
});

test("doctor says a stopGate of active is not built and runs as shadow", async () => {
  const out = await doctorIn({ pack: "generic", hooks: { stopGate: "active" } });
  assert.equal(out["verdict"], "ready");
  assert.equal(out["stop_gate"], "active");
  assert.match(String(out["stop_gate_note"]), /not built.*runs as shadow/);
  const off = await doctorIn({ pack: "generic" });
  assert.equal(off["stop_gate"], undefined);
});
