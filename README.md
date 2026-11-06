# Defense Webgame

A browser survivors-like game built with TypeScript, Three.js and Vite. It is a clean-room remake of a Warcraft III map: it uses mechanics and numbers derived from the map, never its texts, names in the game, code or assets.

Design specification: [docs/superpowers/specs/2026-11-04-defense-webgame-design.md](docs/superpowers/specs/2026-11-04-defense-webgame-design.md). Architecture: [ARCHITECTURE.md](ARCHITECTURE.md). Current status: [docs/STATUS.md](docs/STATUS.md).

## Commands
- `npm run dev` - dev server
- `npm run check` - typecheck and tests
- `npm run build` - production build
- `npm run e2e` - Playwright end-to-end tests (builds and serves the app; set `PW_CHROMIUM_PATH` to use a pre-installed Chromium instead of the Playwright-managed one)
- `npm run map:extract -- <map.w3x> <label>` - local map extraction (untracked output)
- `npm run data:build -- --source data-source/<label>/out --out data/generated` - build game data (`data/generated/*.json` is generated; see AGENTS.md)

See [AGENTS.md](AGENTS.md) for the project rules.
