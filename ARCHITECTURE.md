# Architecture

A map of the code for people and agents. The full design is the spec in `docs/superpowers/specs/2026-11-04-defense-webgame-design.md` (Czech); read only the section your task needs. Parts marked *planned (phase 1)* do not exist yet.

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
| `client/` | browser code; `client/spike/` is the crowd benchmark | texts only via message files (phase 1) |
| `e2e/` | Playwright, projects `webgl2-fallback` and `webgpu-swiftshader` | |
| `tests/` | repository guards (map files, `sim/` purity) | |
| `assets/` | CC0 assets, each listed in `assets/LICENSES.md` | |
| `docs/` | spec, plans, status, decisions | map names allowed |

## Game data

- A design entry names its map object by `source`. data-build looks it up in the export and fills params from `DataA`–`DataI`, `cooldown`, `area`, `range`, `duration` or `{ design: [...] }` (one value per level). A missing value takes the value of the level before.
- `validateGameData(data: unknown): GameData` throws `GameDataError` with `path: message` lines.
- Files: `heroes.json`, `abilities.json`, `constants.json`; phase 1 adds `enemies.json` and `rules.json`.
- `data/generated.test.ts` guards the content, because data-build cannot run in CI.
- Ability kinds (13) and targeting rules (8) are listed in `data/schema/ability.ts`.

## Simulation (planned, phase 1)

- `createRun(data, { seed })` returns a `Run`. `run.step(input: TickInput)` advances one fixed step (30 per second). Systems run in a fixed order: hero movement, spawning, enemy AI, hero combat, abilities, crystals, castle regeneration, end check, level-up offer.
- State lives in stores of typed arrays with a fixed capacity (`EnemyStore`, `CrystalStore`) and in hero and castle structs. Each step writes an `EventLog` (hits, deaths, casts, pickups, level-ups, run end) that the client turns into effects.
- Determinism: a seeded `Rng` (mulberry32), no transcendental `Math` functions, no allocation per step. `stateHash(run)` (FNV-1a) backs the determinism and replay tests.
- Units are the map's world units with `y` pointing north. The client scales by `1/64` and draws north as `-z`.
- `sim/bot.ts` plays runs without graphics. `npm run sim:run` prints run summaries for balance tuning.

## Client

- Renderer: Three.js `WebGPURenderer`, WebGPU with an automatic WebGL2 fallback (`?renderer=webgl2` forces it). The overlay shows the backend in use.
- Crowd: one `InstancedMesh` per enemy type with the animation baked into a texture (VAT) at load time; `SpatialHash` finds neighbours.
- *Planned (phase 1):* a fixed-step loop with interpolation; `RunView`s for the hero, enemies, crystals and effects; an HTML/CSS UI (menu, HUD, cards, end screen) with EN and CS messages.
- Debug: `window.__spike`, and `window.__game` in phase 1; URL params `n`, `renderer`, plus `seed`, `speed`, `duration`, `debug`, `fps` and `lang` in phase 1.

## Tests and delivery

- `npm run check`: typecheck, Vitest and Python tests. Required before every commit.
- `npm run e2e`: builds, serves the preview and runs Playwright in both projects. The render check hides the overlay and needs a luminance stddev above 2.5.
- CI runs `.github/workflows/ci.yml`. `pages.yml` deploys `main` to https://wizzik.github.io/defense-webgame/ (the spike lives at `/spike/`).

## Glossary

- **Sieger** (obléhač): an enemy that walks to the castle. **Hunter** (lovec): an enemy that chases the hero.
- **Phase**: a 50-second part of the run timeline with its own spawn rate and hunter share.
- **Slice**: the phase-1 vertical slice, a 3-minute run.
- **VAT**: vertex animation texture.
- **SDD**: subagent-driven development. Its working files live in `.superpowers/sdd/<plan>/`, excluded from git.
