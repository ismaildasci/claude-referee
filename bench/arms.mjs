// The four registered arms of the A/B and their exact configuration: files written into the task's work tree, whether the plugin loads, and how the prompt is built.
// The 20-line test hook is TEST_HOOK below (16 lines); the active-equivalent referee arm is listed as unavailable because `active` is not built.

export const TEST_HOOK = `#!/bin/bash
# Stop hook: run the project's tests; exit 2 (block the stop) when they fail.
cat >/dev/null
cd "\${CLAUDE_PROJECT_DIR:-.}" || exit 0
if [ -f Makefile ] && grep -q '^test:' Makefile; then cmd="make test"
elif [ -f package.json ] && grep -q '"test"' package.json; then cmd="npm test --silent"
else exit 0; fi
out=$($cmd 2>&1)
status=$?
if [ "$status" -ne 0 ]; then
  echo "Tests failed (exit $status). Fix them before finishing." >&2
  echo "$out" | tail -40 >&2
  exit 2
fi
exit 0
`;

export const TEST_HOOK_SETTINGS = JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "bash", args: ["\${CLAUDE_PROJECT_DIR}/.claude/hooks/run-tests.sh"], timeout: 120 }] }] } }, null, 2) + "\n";

export const GOAL_CONDITION = "The goal is met when the work described above is complete and you have run a check that demonstrates it works, with its output shown in this conversation. Stop after 15 turns if it is not met.";

export const REFEREE_SOFT_JSON = JSON.stringify({ pack: "generic", hooks: { sessionStart: false, stopGate: "soft" } }) + "\n";

export const ARMS = {
  nogate: { id: "nogate", label: "no gate", plugin: false, files: () => ({}), prompt: (task) => task.prompt },
  testhook: { id: "testhook", label: "20-line test hook", plugin: false, files: () => ({ ".claude/settings.json": TEST_HOOK_SETTINGS, ".claude/hooks/run-tests.sh": TEST_HOOK }), prompt: (task) => task.prompt },
  goal: { id: "goal", label: "/goal", plugin: false, files: () => ({}), prompt: (task) => `/goal ${task.prompt.replace(/\s+/g, " ").trim()} ${GOAL_CONDITION}` },
  referee: { id: "referee", label: "claude-referee, soft", plugin: true, files: () => ({ ".claude/referee.json": REFEREE_SOFT_JSON }), prompt: (task) => task.prompt },
};

export const ARM_IDS = Object.keys(ARMS);

export const UNAVAILABLE_ARMS = [{ id: "referee-active", reason: "hooks.stopGate `active` is not built (docs/configuration.md); soft mode never blocks, and the arm turns the SessionStart briefing off (hooks.sessionStart false), so it gives Claude no context" }];

// Whether TEST_HOOK finds a test command in a task's starter files (same two checks as the script); false means the hook exits 0 and the arm equals no gate there.
export function testHookActs(files) {
  const mk = files?.["Makefile"];
  const pj = files?.["package.json"];
  return (typeof mk === "string" && /^test:/m.test(mk)) || (typeof pj === "string" && pj.includes('"test"'));
}

export const TEST_HOOK_LINES = TEST_HOOK.trimEnd().split("\n").length;

// ---- Delegation A/B (PREREG sections D2 to D4): alone against delegate; the four arms above are the superseded registration (Appendix A).

export const CHUNK_SIZE = 20;
export const TODO_QUESTION = "todo.tracked";

export const TASK_TEXT = (n, repo) =>
  `items.jsonl in this directory has ${n} lines. Each line is a JSON object {"id", "text"}: one TODO, FIXME, XXX or HACK comment line taken from the source of ${repo}. An item is tracked when its text holds an issue or pull request number (#123, gh-123, issue 123, PR 123), a URL starting with http:// or https://, a name or version in parentheses right after the marker (TODO(name), FIXME(1.11)), or an @name after it (TODO @name). Any other item is untracked. Write findings.json in this directory: a JSON array of the ids of all tracked items, for example ["n001","n007"]. Then reply with one sentence saying how many tracked items you found. Answer in English.`;

export const ALONE_SUFFIX = " Decide for each item yourself.";

export const delegateSuffix = (plugin) =>
  ` Do not decide the items yourself. The directory chunks/ holds the same items in files of at most ${CHUNK_SIZE} lines. For each chunk file run \`node ${plugin}/dist/cli.mjs judge --question ${TODO_QUESTION} --items chunks/<file>\`; it prints one JSON line. The ids in its "flagged" list are the tracked items; ids in "review_ids", "unanswered" or "stopped" are not tracked and you must not decide them yourself. Combine the flagged ids of all chunks into findings.json. Your reply also gives the totals of flagged, review_ids, unanswered and stopped ids.`;

export const DELEGATE_REFEREE_JSON = JSON.stringify({ pack: "bench-todo", hooks: { sessionStart: false, stopGate: "off" } }) + "\n";

// The same items as items.jsonl, in files of at most CHUNK_SIZE lines (judge lists at most 20 flagged ids per call).
export function chunkFiles(items) {
  const files = {};
  for (let i = 0; i * CHUNK_SIZE < items.length; i++) {
    const slice = items.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    files[`chunks/c${String(i + 1).padStart(2, "0")}.jsonl`] = slice.map((it) => JSON.stringify({ id: it.id, text: it.text })).join("\n") + "\n";
  }
  return files;
}

// task: { items: [{id, text}], repo }; ctx.plugin: absolute path of the plugin copy (delegate only).
export const DELEGATION_ARMS = {
  alone: { id: "alone", label: "Claude alone", plugin: false, files: () => ({}), prompt: (task) => TASK_TEXT(task.items.length, task.repo) + ALONE_SUFFIX },
  delegate: { id: "delegate", label: "Claude with the judge", plugin: true, files: (task) => ({ ...chunkFiles(task.items), ".claude/referee.json": DELEGATE_REFEREE_JSON }), prompt: (task, ctx) => TASK_TEXT(task.items.length, task.repo) + delegateSuffix(ctx?.plugin ?? "<PLUGIN>") },
};
export const DELEGATION_ARM_IDS = Object.keys(DELEGATION_ARMS);
