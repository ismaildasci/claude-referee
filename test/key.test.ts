// API key lookup order, validation and the key command.

import assert from "node:assert/strict";
import { test } from "node:test";
import { RefereeError } from "../src/engine/errors.ts";
import { noKeyNextStep, resolveKey, splitCommand, type Runner } from "../src/engine/key.ts";

const KEY = "ts_test_1234567890abcdef";
const none: Runner = async () => null;

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "resolved";
  } catch (error) {
    return error instanceof RefereeError ? error.code : "other";
  }
}

test("key sources are tried in order", async () => {
  const all = { CLAUDE_PLUGIN_OPTION_API_KEY: "a1", TYPESAFE_API_KEY: "b2", EVAL_TYPESAFE_API_KEY: "c3", TYPESAFE_API_KEY_CMD: "echo d4" };
  assert.deepEqual(await resolveKey(all, "linux", none, new Map()), { key: "a1", source: "plugin_setting" });
  assert.equal((await resolveKey({ ...all, CLAUDE_PLUGIN_OPTION_API_KEY: " " }, "linux", none, new Map())).source, "TYPESAFE_API_KEY");
  assert.equal((await resolveKey({ EVAL_TYPESAFE_API_KEY: "c3" }, "linux", none, new Map())).source, "EVAL_TYPESAFE_API_KEY");
});

test("key command runs once per process, without a shell", async () => {
  const calls: string[][] = [];
  const runner: Runner = async (file, args) => {
    calls.push([file, ...args]);
    return `${KEY}\n`;
  };
  const memo = new Map<string, Promise<string | null>>();
  const env = { TYPESAFE_API_KEY_CMD: "secret-tool lookup service 'type safe'" };
  assert.deepEqual(await resolveKey(env, "linux", runner, memo), { key: KEY, source: "TYPESAFE_API_KEY_CMD" });
  await resolveKey(env, "linux", runner, memo);
  assert.deepEqual(calls, [["secret-tool", "lookup", "service", "type safe"]]);
});

test("key falls back to the macOS Keychain only on darwin", async () => {
  const runner: Runner = async (file, args) => (file === "security" && args.includes("TYPESAFE_API_KEY") ? KEY : null);
  assert.deepEqual(await resolveKey({}, "darwin", runner, new Map()), { key: KEY, source: "keychain" });
  assert.equal(await codeOf(resolveKey({}, "linux", runner, new Map())), "no_api_key");
});

test("key with spaces or non-ASCII is rejected without echoing it", async () => {
  for (const bad of ["abc def", "abc\u0007", "anahtarı"]) {
    try {
      await resolveKey({ TYPESAFE_API_KEY: bad }, "linux", none, new Map());
      assert.fail("expected invalid_api_key");
    } catch (error) {
      assert.ok(error instanceof RefereeError);
      assert.equal(error.code, "invalid_api_key");
      assert.ok(!error.message.includes(bad));
    }
  }
});

test("key missing gives a platform-specific next step", async () => {
  try {
    await resolveKey({}, "linux", none, new Map());
    assert.fail("expected no_api_key");
  } catch (error) {
    assert.ok(error instanceof RefereeError);
    assert.equal(error.code, "no_api_key");
    assert.match(error.details.next_step ?? "", /TYPESAFE_API_KEY_CMD/);
  }
  assert.match(noKeyNextStep("darwin"), /security add-generic-password/);
  assert.match(noKeyNextStep("win32"), /Windows/);
});

test("key command splitting handles quotes", () => {
  assert.deepEqual(splitCommand(`pass show "type safe/key"`), ["pass", "show", "type safe/key"]);
  assert.deepEqual(splitCommand("  op read  op://vault/item  "), ["op", "read", "op://vault/item"]);
  assert.throws(() => splitCommand("pass 'open"), RefereeError);
});

test("the no-key hint names the Claude Code version that --values-stdin needs", () => {
  for (const platform of ["darwin", "linux"] as const) assert.match(noKeyNextStep(platform), /--values-stdin \(Claude Code 2\.1\.285\+\)/);
});
