// Facts parsed in code from check output; only these (never the raw log) go to Jev when a runner is recognised.
// Parsers take the worst case: any failure marker or conflicting summary wins over a passing one.
// expected_failures (known issues, xfail) is a fact for Jev and caps met; build_only marks a build runner (no test results) and is read in code only, never sent.

export interface RunnerFacts {
  readonly runner: string;
  readonly passed: number;
  readonly failed: number;
  readonly errors: number;
  readonly skipped: number;
  readonly warnings?: number;
  readonly incomplete?: boolean;
  readonly expected_failures?: number;
  readonly build_only?: boolean;
  readonly failing: readonly string[];
  readonly summary_line: string | null;
}

export interface RunnerParser {
  readonly name: string;
  parse(text: string): RunnerFacts | null;
}
