// Design tokens shared by every claude-referee README asset.
// Surfaces and ink are GitHub's own page colours; the single brand accent is
// the violet slot of the dataviz reference palette (light / dark steps).

const THEMES = {
  light: {
    name: "light",
    page: "#ffffff",
    text: "#1f2328",
    secondary: "#59636e",
    border: "#d1d9e0",
    raised: "#f6f8fa",
    grid: "#e8ecf0",
    accent: "#4a3aa7",
    onAccent: "#ffffff",
    dot: "#d1d9e0",
    chip: "#eff2f5",
    other: "#8c959f"
  },
  dark: {
    name: "dark",
    page: "#0d1117",
    text: "#e6edf3",
    secondary: "#9198a1",
    border: "#3d444d",
    raised: "#151b23",
    grid: "#21262d",
    accent: "#9085e9",
    onAccent: "#0d1117",
    dot: "#3d444d",
    chip: "#212830",
    other: "#656c76"
  }
};
const SANS = `-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`;
function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [ca, cb] = [p(a), p(b)];
  return "#" + ca.map((v, i) => Math.round(v * t + cb[i] * (1 - t)).toString(16).padStart(2, "0")).join("");
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r = (v, d = 2) => {
  const k = 10 ** d;
  return String(Math.round(v * k) / k);
};
export {
  MONO,
  SANS,
  THEMES,
  esc,
  mix,
  r
};
