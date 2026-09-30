# Images

The README, manifesto and social preview images. Every image comes in a light and a dark version, and the README picks one with `<picture>`.

| Files | Used in |
|---|---|
| `hero-*.gif`, `hero-*-static.png` | README header; the static PNG is for places that don't play GIFs |
| `how-it-works-*.gif` | README, How it works |
| `cost-*.png`, `charts/*.png` | README and [docs/measurements.md](../docs/measurements.md); every number comes from the measurements described there |
| `manifesto-*.png` | [MANIFESTO.md](../MANIFESTO.md) |
| `social-preview.png` | GitHub social preview (1280 × 640) |
| `logo/mark.svg` | The mark: a referee's yellow card. `logo/avatar.svg` and `logo/avatar-512.png` put it on a dark square |

The mark, the wordmark and the colours may be used to link to or write about claude-referee. Please don't use them in a way that suggests your project is claude-referee or is endorsed by it.

## Demo GIF

`demo.tape` records a terminal demo with [VHS](https://github.com/charmbracelet/vhs): run `vhs assets/demo.tape` from the repository root. Keep the GIF under 2 MB (`gifsicle -O3` if needed).

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
