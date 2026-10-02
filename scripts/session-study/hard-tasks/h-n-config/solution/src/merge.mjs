const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export function deepMerge(base, override) {
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    if (value === null) delete out[key];
    else if (isPlain(value) && isPlain(out[key])) out[key] = deepMerge(out[key], value);
    else if (isPlain(value)) out[key] = deepMerge({}, value);
    else out[key] = structuredClone(value);
  }
  return out;
}
