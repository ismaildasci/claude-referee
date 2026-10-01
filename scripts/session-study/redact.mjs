// Turns a raw Claude Code transcript into a derived fixture: only the fields the Stop analysis reads, paths mapped to /work, ids renumbered, file contents and thinking dropped.
// The raw transcript never leaves the out directory; check-no-private.sh still has the last word on whatever is committed.

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

export function makeScrub(workdirs) {
  const dirs = [...new Set(workdirs.filter(Boolean))].sort((a, b) => b.length - a.length);
  return (text) => {
    let out = String(text);
    for (const dir of dirs) out = out.split(dir).join("/work");
    return out.replace(/\/Users\/[^/\s"'`]+/g, "/home/user").replace(/\/home\/(?!user\b)[^/\s"'`]+/g, "/home/user").replace(/\/private\/tmp\/[^\s"'`]*/g, "/tmp/x");
  };
}

export function redactTranscript(raw, { workdirs }) {
  const scrub = makeScrub(workdirs);
  const ids = new Map();
  const idOf = (id) => {
    const key = String(id ?? "");
    if (!ids.has(key)) ids.set(key, `t${ids.size + 1}`);
    return ids.get(key);
  };
  const resultContent = (content) => (typeof content === "string" ? scrub(content) : Array.isArray(content) ? content.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => ({ type: "text", text: scrub(b.text) })) : "");
  const block = (b) => {
    if (!b || typeof b !== "object") return null;
    if (b.type === "text" && typeof b.text === "string") return { type: "text", text: scrub(b.text) };
    if (b.type === "tool_use") {
      const input = b.name === "Bash" && typeof b.input?.command === "string" ? { command: scrub(b.input.command) } : EDIT_TOOLS.has(b.name) ? { file_path: scrub(b.input?.file_path ?? b.input?.notebook_path ?? "") } : {};
      return { type: "tool_use", id: idOf(b.id), name: b.name, input };
    }
    if (b.type === "tool_result") return { type: "tool_result", tool_use_id: idOf(b.tool_use_id), content: resultContent(b.content), ...(b.is_error === true ? { is_error: true } : {}) };
    return null;
  };
  const lines = [];
  for (const line of String(raw).split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (!entry || (entry.type !== "user" && entry.type !== "assistant")) continue;
    const content = entry.message?.content;
    const kept = typeof content === "string" ? scrub(content) : Array.isArray(content) ? content.map(block).filter(Boolean) : "";
    lines.push(
      JSON.stringify({
        type: entry.type,
        ...(entry.isSidechain === true ? { isSidechain: true } : {}),
        ...(entry.isMeta === true ? { isMeta: true } : {}),
        ...(entry.isCompactSummary === true ? { isCompactSummary: true } : {}),
        ...(typeof entry.origin?.kind === "string" ? { origin: { kind: entry.origin.kind } } : {}),
        message: { role: entry.message?.role ?? entry.type, content: kept },
      }),
    );
  }
  return lines.join("\n") + (lines.length ? "\n" : "");
}
