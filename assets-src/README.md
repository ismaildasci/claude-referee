# README assets

Generators for the README images. Nothing here ships with the plugin.

```bash
npm install
npm run all      # build SVGs and the social preview, render PNG previews, run checks
```

- `build-svgs.mjs`: `assets/{hero,how-it-works,cost}-{light,dark}.svg`. The wordmark is converted to paths, so the SVGs need no web fonts.
- `build-social.mjs`: `assets/social-preview.png` (1280×640). Upload it under Settings → General → Social preview.
- `check.mjs`: XML validity, sizes, WCAG contrast, and text overlap or clipping with two font setups.
- `render-previews.mjs`: PNG previews into `_previews/`.

Add `node_modules/` and `_previews/` to the repository's `.gitignore`.

## Demo GIF

`assets/demo.tape` records the terminal demo with [VHS](https://github.com/charmbracelet/vhs): `vhs assets/demo.tape` from the repository root. Keep the GIF under 2 MB (`gifsicle -O3` if needed).

Before recording:
- `npx claude-referee` must run, and `TYPESAFE_API_KEY` must be exported in the shell that runs `vhs`. The recorded shell inherits it, so the key is never typed or shown.
- Run it inside a Rust project with cargo-nextest and a `decision.json` for `decide`, for example:

  ```json
  {"decision": "Which retry strategy fits our rules?",
   "options": [{"name": "backoff", "text": "Exponential backoff with jitter"},
               {"name": "fixed", "text": "Three fixed retries, 1 s apart"}],
   "context_files": ["docs/rules.md"]}
  ```
- The sleeps are short on purpose; raise a `Sleep` if a step runs longer on your machine.
