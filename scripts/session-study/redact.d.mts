// Type declarations for scripts/session-study/redact.mjs so tests can import it under strict TypeScript.

export function makeScrub(workdirs: string[], names?: string[]): (text: string) => string;
export function redactTranscript(raw: string, options: { workdirs: string[] }): string;
