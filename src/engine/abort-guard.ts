// @typesafe-ai/sdk 0.6.0 leaves a rejected AbortError behind when a request is aborted after its headers arrived (SDK PR #3).
// Node turns it into an uncaught exception that kills the process before any JSON is printed. Only those two DOMException names are ignored; any other rejection keeps Node's default.

export function isSdkAbort(reason: unknown): boolean {
  return typeof reason === "object" && reason !== null && reason instanceof DOMException && (reason.name === "AbortError" || reason.name === "TimeoutError");
}

export function installAbortGuard(): void {
  process.on("unhandledRejection", (reason) => {
    if (isSdkAbort(reason)) return;
    throw reason;
  });
}
