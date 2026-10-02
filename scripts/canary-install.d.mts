export function assessInstall(input: { list: unknown; id?: string; expectedVersion: string; cliOut?: string }): string[];
export function runCanary(input: { repo: string; claude?: string }): {
  status: "pass" | "fail" | "skip";
  claudeVersion: string;
  expectedVersion?: string;
  problems: string[];
};
