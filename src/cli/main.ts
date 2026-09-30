// Entry point bundled to dist/cli.mjs.

import { commands } from "./commands/index.ts";
import { processIo } from "./io.ts";
import { run } from "./run.ts";

process.exitCode = await run(process.argv.slice(2), processIo(), commands);
