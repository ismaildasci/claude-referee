# Detected checks one level down, only when unambiguous

Registered 2026-10-09, before any code change. Chosen with `decide` (o2 0.88, then 0.97 after one added fact; both orders agreeing; receipts `rmv0ro9hn6zka`, `rmv0rog5tahql`). Extends [briefing-detected-checks.md](briefing-detected-checks.md).

## Why

On the owner's 14 project roots, 8 yield detected checks and 6 do not because the manifests live in subdirectories. Of those 6, exactly one subdirectory has checks in 2 roots, several do in 3 (one of them an umbrella folder with 33 subprojects) and none in 1 (aggregate counts).

## The rule

When no manifest is found from the working directory up to the project root, look at the immediate subdirectories of the project root (not `.`-prefixed, not `node_modules` or `vendor`). If exactly one of them yields detected checks, list those, each as `cd <dir> && <command>`; a directory name outside letters, digits, `.`, `_` and `-` is double-quoted. With none or several, say nothing (the old text). Nothing deeper than one level; the 4-check and 90-character caps still apply after the prefix.

## Bars

- **B1 (unambiguous only):** one subdirectory with a manifest gives prefixed commands; two give nothing; none gives nothing.
- **B2 (root first):** a root with its own manifest or one found from the working directory is used as before, subdirectories are not read.
- **B3 (skipped dirs):** `node_modules`, `vendor` and dot directories are ignored.
- **B4 (quoting):** a directory name with a space is double-quoted.
- **B5 (limits):** the briefing stays within 800 characters and its last line is kept; output is byte-stable.
- **B6 (gates):** `npm run check` and `ci:local` green.
- **Report (not a bar):** how many of the 6 empty roots now yield checks (expected 2).

## Limits

- A root with one subproject and unrelated work elsewhere lists a check that proves only that subproject.
- Two levels down, or several subprojects, stay unlisted.
