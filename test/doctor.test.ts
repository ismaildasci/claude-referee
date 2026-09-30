// doctor: key source without the key, readiness and the online key check.

import assert from "node:assert/strict";
import { test } from "node:test";
import { run } from "../src/cli/run.ts";
import { commands } from "../src/cli/commands/index.ts";
import { fakeJev } from "./fake-jev.ts";
import { memoryIo } from "./helpers.ts";

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
    const io = memoryIo({ env: { TYPESAFE_API_KEY: "ts_test", TYPESAFE_BASE_URL: server.url } });
    await run(["doctor", "--online"], io, commands);
    assert.deepEqual(io.json()["models"], ["jev-latest"]);
  } finally {
    await server.close();
  }
  const bad = await fakeJev(undefined, { status: 401 });
  try {
    const io = memoryIo({ env: { TYPESAFE_API_KEY: "ts_test", TYPESAFE_BASE_URL: bad.url } });
    await run(["doctor", "--online"], io, commands);
    assert.equal(io.json()["online"], "auth_failed");
    assert.equal(io.json()["verdict"], "not_ready");
  } finally {
    await bad.close();
  }
});
