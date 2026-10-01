// Entry point bundled to dist/cli.mjs.

import { installAbortGuard } from "../engine/abort-guard.ts";
import { commands } from "./commands/index.ts";
import { processIo } from "./io.ts";
import { run } from "./run.ts";

installAbortGuard();

process.exitCode = await run(process.argv.slice(2), processIo(), commands);
