# Defense Webgame

A browser survivors-like game built with TypeScript, Three.js and Vite. It is a clean-room remake of a Warcraft III map: it uses mechanics and numbers derived from the map, never its texts, names in the game, code or assets.

Design specification: [docs/superpowers/specs/2026-11-04-defense-webgame-design.md](docs/superpowers/specs/2026-11-04-defense-webgame-design.md). Architecture: [ARCHITECTURE.md](ARCHITECTURE.md). Current status: [docs/STATUS.md](docs/STATUS.md).

## Play

The game runs at https://wizzik.github.io/defense-webgame/ (the crowd benchmark is at `/spike/`). A run lasts 5 minutes in 6 phases; enemies of six types arrive in packs from two gates. Pick one of four heroes in the menu. Move with WASD or the arrow keys, the spells cast themselves, Space dashes, R casts the ultimate and T switches its automatic casting on or off. Pick an upgrade card (learn a spell, raise a spell level, learn the ultimate, or an attribute) with a click or the keys 1 to 3 when you level up. M (or the menu toggle) mutes the sound.

URL parameters (all optional):

| Parameter | Values | Effect |
|---|---|---|
| `seed` | integer | Seed of the run; the same seed gives the same run. Default: random. |
| `speed` | 1 to 16 | Simulation speed multiplier. Default 1. |
| `duration` | 5 to 600 | Run length in seconds. Default: the full run. |
| `hero` | `stonehorn`, `nightglaive`, `gravecaller`, `serpent-shaman`, `mistwarden`, `sparkshot`, `redcleaver`, `tidecaller` | Hero of the run (the menu choice starts from it). Default: `stonehorn`. |
| `debug` | `1` | Adds `window.__game.debug` (`grantXp(n)`, `setAbilityLevel(slot, level)`, `spawnEach()`: one enemy of every type next to the hero). |
| `fps` | `1` | Shows the frame-rate overlay (bottom-left): backend, GPU name, enemies alive, average fps and 1% low. |
| `lang` | `en`, `cs` | Interface language. Default: the browser language. |
| `renderer` | `webgl2` | Forces the WebGL2 backend instead of WebGPU. |

## Commands
- `npm run dev` - dev server
- `npm run check` - typecheck and tests
- `npm run build` - production build
- `npm run e2e` - Playwright end-to-end tests (builds and serves the app; set `PW_CHROMIUM_PATH` to use a pre-installed Chromium instead of the Playwright-managed one)
- `npm run map:extract -- <map.w3x> <label>` - local map extraction (untracked output)
- `npm run data:build -- --source data-source/<label>/out --out data/generated` - build game data (`data/generated/*.json` is generated; see AGENTS.md)
- `npm run sim:run -- [--hero <id>|all] [--seed 1] [--runs 1] [--duration 300] [--idle]` - play the autopilot headless and print run summaries (balance tuning); `--idle` plays a player who does nothing

See [AGENTS.md](AGENTS.md) for the project rules.
