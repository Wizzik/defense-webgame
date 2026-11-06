# AGENTS.md - rules for AI agents

Defense Webgame is a browser survivors-like game (TypeScript + Three.js + Vite), a clean-room remake of a Warcraft III map.

## Start here
- `docs/STATUS.md`: where the project is and what comes next. Read it first.
- `ARCHITECTURE.md`: map of the code and the data flow.
- `docs/DECISIONS.md`: decisions already made. Check it before you change a rule.
- The spec and plans are long and in Czech: read only the section your task needs.
- Do not read `data/generated/*.json` or map exports whole; query them (`node -e`, `python3 -I -c`).
- Update `docs/STATUS.md` when a task or phase finishes.

## Clean room
The repository is public (decided 2026-11-04): never commit anything that must not be published.
- Never commit `data-source/`, `xhero/`, `*.w3x` or extracted map files (`war3map.*`).
- Never copy tooltips, texts or other content from the map into the game. Write original content.
- Map identifiers and names (rawcodes, hero, ability and trigger names) are allowed only in `tools/`, `design/` and `docs/`, for traceability. They never appear in anything shipped to players: `client/`, `sim/`, UI texts, or data the client bundles.
- `data/generated/*.json` carries no map codes: `source` and `review` live only in `design/*.yaml`.
- `tests/repo-guard.test.ts` and `data/generated.test.ts` enforce the file and data rules.

## Data pipeline
- `data/generated/*.json` is generated - never edit it by hand.
- To change game data, edit `design/*.yaml`, then run `npm run map:extract -- <map.w3x> <label>` (local, output untracked) and `npm run data:build -- --source data-source/<label>/out --out data/generated`, and commit the regenerated files.
- `data:build` cannot run in CI (no map data there).

## Commands
- `npm run check` - typecheck + tests (must pass before every commit)
- `npm run build` - production build into `dist/`
- `npm run e2e` - Playwright end-to-end tests
- `npm run map:extract` - local map extraction toolkit (output stays untracked)
- `npm run data:build` - build game data from validated sources
- `npm run sim:run` - autopilot run summaries for balance tuning

## Debugging in the browser
URL parameters of the game page: `seed`, `speed` (1-16), `duration` (5-600 s), `debug=1` (`window.__game.debug.grantXp(n)`), `fps=1` (overlay), `lang` (`en`|`cs`), `renderer=webgl2`. `window.__game` exposes `backend`, `frames`, `screen`, `tick`, `level`, `kills`, `heroHp`, `castleHp`, `enemies`; the e2e tests read it. Run balance tuning headless with `npm run sim:run -- --runs 5`.

## Code rules
- `sim/` is pure: no `three`, no imports from `client/`, no DOM globals (`window`, `document`, `navigator`, `globalThis`).
- `sim/` is deterministic: same seed and same inputs give the same state in any browser. Fixed step of 30 ticks per second, time counted in ticks. Randomness only from the seeded `Rng`. No `Math.random`, `Date`, `performance`, `setTimeout`, `setInterval` or `requestAnimationFrame`. No `Math.sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|exp|expm1|log|log1p|log2|log10|pow|cbrt|hypot` and no `**` (engines may differ); compute directions with vectors and `Math.sqrt`.
- `Run.step()` does not allocate in a normal step: entities live in typed arrays of fixed capacity. Only a rare event (the card offer) may allocate.
- Systems run in the fixed order of `Run.step` in `sim/run.ts`.
- Code, identifiers and comments are in English; player-facing texts exist in EN and CS.
- Every asset must be listed in `assets/LICENSES.md`.
- Keep files small, one role per file.
- Use Conventional Commits; commit only after `npm run check` passes.
- Dependency versions are exact and locked in `package-lock.json`.
