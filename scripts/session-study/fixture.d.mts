// Type declarations for scripts/session-study/fixture.mjs so tests can import it under strict TypeScript.

export function addFixture(input: { out: string; id: string; name: string; dest: string; split?: string; expected?: string }): { name: string; expected: string };
