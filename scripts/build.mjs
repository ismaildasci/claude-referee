// Bundles the CLI and hook entry points into plugins/claude-referee/dist with the SDK inlined.
// dist is committed, so installs never need node_modules; CI fails if a rebuild changes it.

import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = join(root, "plugins/claude-referee/dist");

await build({
  entryPoints: { cli: join(root, "src/cli/main.ts") },
  outdir,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  keepNames: true,
  legalComments: "none",
  charset: "utf8",
  logLevel: "warning",
});

const sdkLicense = readFileSync(join(root, "node_modules/@typesafe-ai/sdk/LICENSE"), "utf8");
mkdirSync(outdir, { recursive: true });
writeFileSync(
  join(outdir, "THIRD_PARTY_NOTICES"),
  `claude-referee bundles the following third-party software.\n\n@typesafe-ai/sdk 0.6.0\n\n${sdkLicense.trim()}\n`,
);
