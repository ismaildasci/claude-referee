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
