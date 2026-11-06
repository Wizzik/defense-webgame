# Defense Webgame

A browser survivors-like game built with TypeScript, Three.js and Vite. It is a clean-room remake of a Warcraft III map: it uses mechanics and numbers derived from the map, never its texts, names in the game, code or assets.

Design specification: [docs/superpowers/specs/2026-11-04-defense-webgame-design.md](docs/superpowers/specs/2026-11-04-defense-webgame-design.md). Architecture: [ARCHITECTURE.md](ARCHITECTURE.md). Current status: [docs/STATUS.md](docs/STATUS.md).

## Play

The game runs at https://wizzik.github.io/defense-webgame/ (the crowd benchmark is at `/spike/`). A run lasts 3 minutes. Move with WASD or the arrow keys, the spells cast themselves, pick an upgrade card with a click or the keys 1 to 3 when you level up.

URL parameters (all optional):

| Parameter | Values | Effect |
|---|---|---|
| `seed` | integer | Seed of the run; the same seed gives the same run. Default: random. |
| `speed` | 1 to 16 | Simulation speed multiplier. Default 1. |
| `duration` | 5 to 600 | Run length in seconds. Default: the full run. |
| `debug` | `1` | Adds `window.__game.debug` (for example `grantXp(n)`). |
| `fps` | `1` | Shows the frame-rate overlay (bottom-left). |
| `lang` | `en`, `cs` | Interface language. Default: the browser language. |
| `renderer` | `webgl2` | Forces the WebGL2 backend instead of WebGPU. |

## Commands
- `npm run dev` - dev server
- `npm run check` - typecheck and tests
- `npm run build` - production build
- `npm run e2e` - Playwright end-to-end tests (builds and serves the app; set `PW_CHROMIUM_PATH` to use a pre-installed Chromium instead of the Playwright-managed one)
- `npm run map:extract -- <map.w3x> <label>` - local map extraction (untracked output)
- `npm run data:build -- --source data-source/<label>/out --out data/generated` - build game data (`data/generated/*.json` is generated; see AGENTS.md)
- `npm run sim:run -- [--seed 1] [--runs 1] [--duration 180]` - play the autopilot headless and print run summaries (balance tuning)

See [AGENTS.md](AGENTS.md) for the project rules.
