# Architecture

A map of the code for people and agents. The full design is the spec in `docs/superpowers/specs/2026-11-04-defense-webgame-design.md` (Czech); read only the section your task needs.

## Data flow

```
map .w3x --tools/map-extract (Python)--> data-source/<label>/out/*.json    untracked, local only
design/*.yaml --+
                +--tools/data-build--> data/generated/*.json    validated by data/schema, committed
data-source ----+
data/generated --> sim/ (pure, deterministic) --> client/ (Three.js rendering + HTML/CSS UI)
```

## Directories

| Path | Role | Rules |
|---|---|---|
| `tools/map-extract/` | Python toolkit: map → JSON export (`npm run map:extract`) | output untracked; map names allowed |
| `tools/data-build/` | design YAML + export → `data/generated` (`npm run data:build`) | validates before it writes; cannot run in CI |
| `design/` | hand-edited YAML: own names (EN/CS), map `source` codes, design values, porting notes (`review`) | map names allowed |
| `data/schema/` | zod schemas and `validateGameData`, shared by the game and the tools | |
| `data/generated/` | game data the client bundles | generated only; carries no map codes (from phase 1 Task 1) |
| `sim/` | simulation | pure and deterministic (AGENTS.md) |
| `client/` | browser code; `client/spike/` is the crowd benchmark | texts only via `client/ui/messages-*.ts` |
| `e2e/` | Playwright, projects `webgl2-fallback` and `webgpu-swiftshader` | |
| `tests/` | repository guards (map files, `sim/` purity) | |
| `assets/` | CC0 assets, each listed in `assets/LICENSES.md` | |
| `docs/` | spec, plans, status, decisions | map names allowed |

## Game data

- A design entry names its map object by `source`. data-build looks it up in the export and fills params from `DataA`–`DataI`, `cooldown`, `area`, `range`, `duration` or `{ design: [...] }` (one value per level). A missing value takes the value of the level before.
- `design/scaling.yaml` holds uniform multipliers from the map's numbers to the survivors pace (hero `moveSpeed` and attack cooldown, ability cooldown, enemy `hp` and `moveSpeed`). `tools/data-build/scaling.ts` applies them after mapping; speeds and hp are rounded to integers, cooldowns to 2 decimals. The map's ratios stay; retune the pace there, not in the generated JSON.
- `validateGameData(data: unknown): GameData` throws `GameDataError` with `path: message` lines.
- Files: `heroes.json`, `abilities.json`, `constants.json`, `enemies.json`, `rules.json`.
- `data/generated.test.ts` guards the content, because data-build cannot run in CI.
- Ability kinds (13) and targeting rules (8) are listed in `data/schema/ability.ts`.

## Simulation

- `createRun(data, { seed })` returns a `Run`. `run.step(input: TickInput)` advances one fixed step (30 per second). `savePrevious` runs first, then systems in a fixed order: hero movement, spawning, enemy AI, hero combat, abilities, crystals, castle regeneration, end check, level-up offer. In the `levelUp` state only `chooseCard` runs.
- State lives in stores of typed arrays with a fixed capacity (`EnemyStore`, `CrystalStore`) and in hero and castle structs. Each step writes an `EventLog` (hits, deaths, casts, pickups, level-ups, run end) that the client turns into effects.
- Determinism: a seeded `Rng` (mulberry32), no transcendental `Math` functions, no allocation per step. `stateHash(run)` (FNV-1a) backs the determinism and replay tests.
- Units are the map's world units with `y` pointing north. The client scales by `1/64` and draws north as `-z`.
- `sim/bot.ts` plays runs without graphics. `npm run sim:run` prints run summaries for balance tuning.

## Client

- Renderer: Three.js `WebGPURenderer`, WebGPU with an automatic WebGL2 fallback (`?renderer=webgl2` forces it). The overlay shows the backend in use.
- Crowd: one `InstancedMesh` for all enemies (sized per instance by type) with the animation baked into a texture (VAT) at load time. `SpatialHash` lives in `sim/spatial-grid.ts` and serves the sim's separation and the spike, not the game client.
- `client/main.ts` wires the pieces, including the menu and restart wiring (`createUi`); `client/game/` holds the session (run, frames, input), the fixed-step loop with interpolation (`loop.ts`), URL parameters (`params.ts`), keyboard input and the debug snapshot (`debug.ts`).
- `client/render/` draws the arena, hero, castle, enemies, crystals and spell effects from the simulation state and its `EventLog`.
- `client/ui/` is an HTML/CSS layer: menu, HUD, upgrade cards, end screen and castle pointer. Texts come from `messages-en.ts` and `messages-cs.ts` through `t(lang, key)`.
- `client/perf/` has the frame-rate overlay (`?fps=1`, bottom-left so it does not cover the HUD).
- Debug: `window.__game` (game page) and `window.__spike` (benchmark). Game URL params: `seed`, `speed`, `duration`, `debug`, `fps`, `lang`, `renderer`; the spike takes `n`, `renderer` and `seed`.

## Tests and delivery

- `npm run check`: typecheck, Vitest and Python tests. Required before every commit.
- `npm run e2e`: builds, serves the preview and runs Playwright in both projects. `e2e/fixtures.ts` makes every test fail on console or page errors. The game spec covers the menu, a level-up pick and the end screen; the render check hides the UI and needs a luminance stddev above 2.5.
- CI runs `.github/workflows/ci.yml` on pushes to `main` and on pull requests (one run per ref, 25 minutes at most). `pages.yml` deploys `main` to https://wizzik.github.io/defense-webgame/ (the spike lives at `/spike/`).

## Glossary

- **Sieger** (obléhač): an enemy that walks to the castle. **Hunter** (lovec): an enemy that chases the hero.
- **Phase**: a 50-second part of the run timeline with its own spawn rate and hunter share.
- **Slice**: the phase-1 vertical slice, a 3-minute run.
- **VAT**: vertex animation texture.
- **SDD**: subagent-driven development. Its working files live in `.superpowers/sdd/<plan>/`, excluded from git.
