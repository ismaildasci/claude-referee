// Checkout class of a command's cwd (docs/decisions/checkout-class.md): fixed words, never a path; built with real git in temp dirs.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkoutClass } from "../src/engine/datadir.ts";
import { errorReceipt } from "../src/engine/receipts.ts";

const GIT = ["-c", "user.email=t@example.test", "-c", "user.name=t", "-c", "protocol.file.allow=always"];
const git = (cwd: string, ...args: string[]) => execFileSync("git", [...GIT, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const fresh = () => realpathSync(mkdtempSync(join(tmpdir(), "referee-class-")));
function repo(): string {
  const dir = fresh();
  git(dir, "init", "-q");
  writeFileSync(join(dir, "a.txt"), "a\n");
  git(dir, "add", "a.txt");
  git(dir, "commit", "-q", "-m", "init");
  return dir;
}

test("a main checkout, a subfolder of it, and a submodule are main", () => {
  const main = repo();
  mkdirSync(join(main, "src"));
  assert.equal(checkoutClass(main), "main");
  assert.equal(checkoutClass(join(main, "src")), "main");
  const lib = repo();
  git(main, "submodule", "add", "-q", lib, "vendor/lib");
  assert.equal(checkoutClass(join(main, "vendor", "lib")), "main");
});

test("a linked worktree outside .claude/worktrees is linked; one inside it is claude-worktree", () => {
  const main = repo();
  const outside = join(fresh(), "wt");
  git(main, "worktree", "add", "-q", "--detach", outside);
  assert.equal(checkoutClass(outside), "linked");
  mkdirSync(join(main, ".claude", "worktrees"), { recursive: true });
  const inside = join(main, ".claude", "worktrees", "eval-1");
  git(main, "worktree", "add", "-q", "--detach", inside);
  assert.equal(checkoutClass(inside), "claude-worktree");
});

test("outside git and a bare repository are no-checkout", () => {
  assert.equal(checkoutClass(fresh()), "no-checkout");
  const bare = fresh();
  git(bare, "init", "-q", "--bare");
  assert.equal(checkoutClass(bare), "no-checkout");
});

test("a receipt written from a claude worktree carries the word and no path", () => {
  const main = repo();
  mkdirSync(join(main, ".claude", "worktrees"), { recursive: true });
  const inside = join(main, ".claude", "worktrees", "eval-2");
  git(main, "worktree", "add", "-q", "--detach", inside);
  const r = errorReceipt({ command: "done", project: "abc123abc123", worktree: checkoutClass(inside), error: "bad_input", started: 0, now: 1 });
  assert.equal(r.worktree, "claude-worktree");
  assert.equal(JSON.stringify(r).includes(".claude"), false);
  assert.equal(JSON.stringify(r).includes(main), false);
});

test("privacy: docs/privacy.md names the field and its four words", () => {
  const privacy = readFileSync("docs/privacy.md", "utf8");
  assert.match(privacy, /`worktree`/);
  for (const word of ["main", "linked", "claude-worktree", "no-checkout"]) assert.ok(privacy.includes(word), word);
});
