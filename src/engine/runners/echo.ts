// Echoed command lines (`$ cmd`, `> cmd`) of a log that has only an exit code, so Jev knows what ran (docs/decisions/command-echo-facts.md).
// Only commands whose first word is a known check tool; none for a log in which an echoed command hides, redirects or tolerates its output or failure.

const ECHO = /^(?:\$|>) \S/;
const HIDES = /\|\||;\s*(?:true|exit 0|:)(?:\s|$)|\s(?:--quiet|-q|--silent|--no-error\S*|--format\b|-f\b|--output-file\b|-o\b|--fix\b)|[12&]?>\s*\/dev\/null|\s\d?>\s*\S/;
const MAX_LINES = 3;
const MAX_CHARS = 80;

export const CHECK_TOOLS: ReadonlySet<string> = new Set([
  "tsc", "vue-tsc", "eslint", "oxlint", "biome", "prettier", "ruff", "mypy", "pytest", "phpunit", "pest", "vitest", "jest", "mocha",
  "npm", "pnpm", "yarn", "bun", "npx", "node", "cargo", "go", "dotnet", "make", "mvn", "gradle", "composer", "php", "python", "python3",
  "rake", "bundle", "rubocop", "rspec", "flutter", "dart", "swift", "mix",
]);

export function commandLines(body: string, exitLines: ReadonlySet<string>): string[] {
  const echoes = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => ECHO.test(l) && !exitLines.has(l) && CHECK_TOOLS.has(l.slice(2).split(/\s+/)[0] ?? ""));
  return echoes.some((l) => HIDES.test(l)) ? [] : [...new Set(echoes.map((l) => l.slice(0, MAX_CHARS)))].slice(0, MAX_LINES);
}
