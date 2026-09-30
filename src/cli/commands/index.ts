// Registry of CLI commands, in the order the help text lists them.

import type { Command } from "../types.ts";
import { decide } from "./decide.ts";
import { doctor } from "./doctor.ts";
import { done } from "./done.ts";
import { judge } from "./judge.ts";
import { receipts } from "./receipts.ts";
import { verify } from "./verify.ts";

export const commands: readonly Command[] = [done, decide, judge, verify, receipts, doctor];
