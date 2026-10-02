// Type declarations for scripts/session-study/replay-note.mjs so tests can import it under strict TypeScript.

export interface ReplayRow {
  id: string;
  class: string;
  usable: boolean;
  kw: string;
  codeSide: boolean;
  fireA: boolean;
  fireB: boolean;
  jev: boolean | null;
}
export function replayStudy(dir: string): ReplayRow[];
export function summarize(rows: ReplayRow[]): Record<string, any>;
