// Bundles the CLI and hook entry points into plugins/evidence-referee/dist with the SDK inlined.
// dist is committed, so installs never need node_modules; CI fails if a rebuild changes it.
// npm/ gets copies of the CLI bundle, notices and packs, so `npx evidence-referee` works without the plugin.

import { build } from "esbuild";
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = join(root, "plugins/evidence-referee/dist");

await build({
  entryPoints: { cli: join(root, "src/cli/main.ts"), hook: join(root, "src/hooks/main.ts") },
  outdir,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  keepNames: true,
  banner: { js: "#!/usr/bin/env node" },
  legalComments: "none",
  charset: "utf8",
  logLevel: "warning",
});

const sdkLicense = readFileSync(join(root, "node_modules/@typesafe-ai/sdk/LICENSE"), "utf8");
mkdirSync(outdir, { recursive: true });
writeFileSync(
  join(outdir, "THIRD_PARTY_NOTICES"),
  `evidence-referee bundles the following third-party software.\n\n@typesafe-ai/sdk 0.6.0\n\n${sdkLicense.trim()}\n`,
);

const npmDir = join(root, "npm");
copyFileSync(join(outdir, "cli.mjs"), join(npmDir, "cli.mjs"));
copyFileSync(join(outdir, "THIRD_PARTY_NOTICES"), join(npmDir, "THIRD_PARTY_NOTICES"));
copyFileSync(join(root, "LICENSE"), join(npmDir, "LICENSE"));
rmSync(join(npmDir, "packs"), { recursive: true, force: true });
cpSync(join(root, "plugins/evidence-referee/packs"), join(npmDir, "packs"), { recursive: true });
