// Registry of CLI commands, in the order the help text lists them.

import type { Command } from "../types.ts";
import { doctor } from "./doctor.ts";
import { done } from "./done.ts";

export const commands: readonly Command[] = [done, doctor];
