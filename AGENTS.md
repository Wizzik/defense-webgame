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
- Known exception, scheduled as the first phase-1 task: the `review` notes in `data/generated/abilities.json` cite map trigger names; they move to a separate review file before the client imports game data.
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

## Code rules
- `sim/` is pure: no `three`, no imports from `client/`, no DOM globals (`window`, `document`, `navigator`).
- Code, identifiers and comments are in English; player-facing texts exist in EN and CS.
- Every asset must be listed in `assets/LICENSES.md`.
- Keep files small, one role per file.
- Use Conventional Commits; commit only after `npm run check` passes.
- Dependency versions are exact and locked in `package-lock.json`.
