// The TypeSafe key goes only to api.typesafe.ai; another TYPESAFE_BASE_URL needs its own REFEREE_BASE_URL_KEY.

import assert from "node:assert/strict";
import { test } from "node:test";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { isTypeSafeHost } from "../src/engine/key.ts";
import { fakeJev } from "./fake-jev.ts";
import { memoryIo, tempDir } from "./helpers.ts";

async function ask(env: Record<string, string>) {
  const server = await fakeJev();
  try {
    const io = memoryIo({ stdin: "all tests pass\n", env: { REFEREE_DATA_DIR: tempDir(), TYPESAFE_BASE_URL: server.url, ...env } });
    const code = await run(["done", "--criteria", "the build is green"], io, commands);
    return { code, out: io.json(), server };
  } finally {
    await server.close();
  }
}

test("isTypeSafeHost accepts the default and https api.typesafe.ai only", () => {
  assert.equal(isTypeSafeHost(undefined), true);
  assert.equal(isTypeSafeHost(""), true);
  assert.equal(isTypeSafeHost("https://api.typesafe.ai"), true);
  assert.equal(isTypeSafeHost("https://api.typesafe.ai/v1"), true);
  assert.equal(isTypeSafeHost("http://api.typesafe.ai"), false);
  assert.equal(isTypeSafeHost("https://api.typesafe.ai.evil.example"), false);
  assert.equal(isTypeSafeHost("https://evil.example/api.typesafe.ai"), false);
  assert.equal(isTypeSafeHost("not a url"), false);
});

test("the TypeSafe key is not sent to another host, and no request is made", async () => {
  const { code, out, server } = await ask({ TYPESAFE_API_KEY: "ts_secret_typesafe" });
  assert.equal(code, 1);
  assert.equal(out["error"], "no_api_key");
  assert.equal(server.requests.length, 0);
  assert.ok(!JSON.stringify(out).includes("ts_secret_typesafe"));
});

test("another host gets REFEREE_BASE_URL_KEY and never the TypeSafe key", async () => {
  const { code, out, server } = await ask({ TYPESAFE_API_KEY: "ts_secret_typesafe", REFEREE_BASE_URL_KEY: "other_host_key" });
  assert.equal(code, 0, JSON.stringify(out));
  assert.deepEqual(server.authorizations, ["Bearer other_host_key"]);
});
