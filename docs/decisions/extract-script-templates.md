# extract: HTML templates inside `<script>` (registration)

Written and committed before any code for it. Taken from the maintainer's ordered list on 2026-10-06.

## Why

In the [second real-code sample](i18n-real-2.md) the one HTML repository, `joeartsea/node-red-contrib-ftp`, gave 0 of 41 removed `data-i18n` keys to `extract`, because a Node-RED node keeps its editor markup inside a `<script>` element and `extract` skips every `<script>` body. Node-RED's own documentation defines the edit dialog as `<script type="text/html" data-template-name="node-type">` and the help text as `<script type="text/html" data-help-name="node-type">` ([node HTML file](https://nodered.org/docs/creating-nodes/node-html)), and translates those templates with `data-i18n="key"` and `data-i18n="[placeholder]key"` ([i18n](https://nodered.org/docs/creating-nodes/i18n)); older nodes, like this repository, use `type="text/x-red"`. Client-side template libraries use the same trick (`text/template`, `text/x-template`, `text/ng-template`).

## Rule (fixed now)

- In `.html`/`.htm` files and in the `<template>` of a `.vue` file, a `<script>` whose `type` attribute, trimmed and lower-cased, is one of `text/html`, `text/x-red`, `text/template`, `text/x-template` or `text/ng-template` has its body scanned as HTML with the existing rules: text and the UI attributes are candidates, elements marked `data-i18n` and the other wrap markers are left out, `<code>`/`<pre>`/nested raw tags stay skipped.
- Every other `<script>` (no `type`, `text/javascript`, `module`, JSON, `text/markdown` and anything else) stays skipped, as now.
- Candidate context names the enclosing element as today; nothing else in `extract` changes.

## Checks

- Unit tests from a fixture in Node-RED's shape: plain text and a `placeholder` inside a `text/html` template are found, `data-i18n` elements inside it are not, a `text/javascript` script next to it and a `text/markdown` help block are still skipped, an unclosed template does not loop or throw.
- **No regression**, by script: the candidate sets (kind, id, text) of the 12 other stripped copies of both real-code samples are identical before and after the change; any difference is listed and explained before the change ships.
- **Fitted measurement**, reported as such: on the `node-red-contrib-ftp` copy, removed calls found under the registered rule before (0 of 41) and after. It is the repository the rule was written for, so this is a check that the rule does what it says, not a test; no accuracy claim follows from it, and the judge is not re-run.

## Limits

One repository motivated the rule; other template systems with their own syntax (Handlebars, Angular inline templates, Svelte) are not read.
