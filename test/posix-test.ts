// `test` for maintainer-only harness tests that drive bash, python or POSIX paths: skipped on Windows, where CI runs only the product tests (docs/decisions/windows-ci-informational.md).
import { test } from "node:test";

export const posixTest = process.platform === "win32" ? test.skip : test;
