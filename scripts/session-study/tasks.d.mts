// Type declarations for scripts/session-study/tasks.mjs so tests can import it under strict TypeScript.

export type Kind = "easy" | "subtle" | "weak" | "notest" | "ambiguous" | "hidden" | "weakvis" | "trap" | "multifile";
export interface Task {
  id: string;
  kind: Kind;
  lang: "node" | "python" | "shell";
  prompt: string;
  files: Record<string, string>;
  solution: Record<string, string>;
  wrong: Record<string, string> | null;
  visible: boolean;
  verify: string;
}
export const KINDS: Kind[];
export const TASKS: Task[];
export const HARD_TASKS: Task[];
export const PROMPT_SUFFIX: string;
export function promptFor(task: Task): string;
export function verifierExt(task: Task): "mjs" | "py";
export function verifierSource(task: Task): string;
export function verifierCommand(task: Task, verifierPath: string, treeDir: string): [string, string[]];
export function visibleCommand(task: Task): [string, string[]] | null;
export function taskById(id: string): Task;
export function manifest(tasks?: Task[]): { hash: string; count: number; ids: string[] };
export function validateTasks(tasks?: Task[], kinds?: string[], langs?: string[]): string[];
