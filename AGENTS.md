# AGENTS.md - rules for AI agents

Defense Webgame is a browser survivors-like game (TypeScript + Three.js + Vite), a clean-room remake of a Warcraft III map.

## Clean room
- Never commit `data-source/`, `xhero/`, `*.w3x` or extracted map files (`war3map.*`).
- Never copy tooltips, texts or other content from the map. Write original content.
- `tests/repo-guard.test.ts` enforces the file rules.

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
