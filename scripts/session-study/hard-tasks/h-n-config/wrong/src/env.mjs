const PREFIX = "APP_";

function convert(raw, current, name) {
  if (typeof current === "number") {
    const n = Number(raw);
    if (raw.trim() === "" || Number.isNaN(n)) throw new TypeError(`${name} is not a number`);
    return n;
  }
  if (typeof current === "boolean") {
    if (raw !== "true" && raw !== "false") throw new TypeError(`${name} is not a boolean`);
    return raw === "true";
  }
  if (Array.isArray(current)) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new TypeError(`${name} is not JSON`);
    }
    if (!Array.isArray(parsed)) throw new TypeError(`${name} is not an array`);
    return parsed;
  }
  return raw;
}

export function applyEnv(config, processEnv) {
  const out = structuredClone(config);
  for (const [name, raw] of Object.entries(processEnv)) {
    if (!name.startsWith(PREFIX) || name.length === PREFIX.length) continue;
    const parts = name.slice(PREFIX.length).split("__");
    let node = out;
    parts.forEach((part, i) => {
      const key = Object.keys(node).find((k) => k.toLowerCase() === part.toLowerCase()) ?? part.toLowerCase();
      if (i < parts.length - 1) {
        if (node[key] === null || typeof node[key] !== "object" || Array.isArray(node[key])) node[key] = {};
        node = node[key];
      } else node[key] = convert(String(raw), node[key], name);
    });
  }
  return out;
}
