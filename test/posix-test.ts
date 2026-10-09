// `test` for maintainer-only harness tests and tests with POSIX shell fixtures (a #!/bin/sh opener or git shim) and tests of append races that exist only where a file can be renamed while another process holds it open: skipped on Windows, where CI runs only the product tests (docs/decisions/windows-ci-informational.md).
import { test } from "node:test";

export const posixTest = process.platform === "win32" ? test.skip : test;
