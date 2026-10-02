const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export function deepMerge(base, override) {
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (isPlain(value) && isPlain(out[key])) out[key] = deepMerge(out[key], value);
    else if (Array.isArray(value) && Array.isArray(out[key])) out[key] = [...out[key], ...value];
    else out[key] = value;
  }
  return out;
}
