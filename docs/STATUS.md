# Status

Updated 2026-11-06. Read this first when you resume work.

## Now

- **Phase 0 (foundation): done.** PR #1 was merged on 2026-11-04. On Petr's laptop the spike holds 60 fps on average with 150 and 600 enemies, with a 1% low of 57–59 fps on both WebGPU and WebGL2.
- **Phase 1 (vertical slice): done, merged with PR #2.** The 3-minute run is playable at https://wizzik.github.io/defense-webgame/:
  - Stonehorn moves with WASD, Rock Rupture casts itself, and siegers and hunters come from two gates;
  - XP crystals drop, and each level-up offers three cards;
  - the run ends in a win, or in a loss when the castle or the hero falls;
  - the UI is in EN and CS;
  - the simulation is deterministic and replayable;
  - there are 158 unit tests and 12 e2e tests, and CI is green.
- **Balance is a first guess** (see `docs/DECISIONS.md`). The autopilot wins 4 of 5 seeds. A run has about 40–55 enemies and reaches level 4. Tune it in `design/rules.yaml`, run `npm run data:build`, and check with `npm run sim:run -- --runs 5`.

## Next

1. Petr plays the slice and measures fps with `?fps=1` in a full run, on both renderers (`&renderer=webgl2`).
2. Tune the numbers from his feedback.
3. Propose the second skill (project development rules).
4. Plan phase 2 (MVP), spec section 8. Real mechanics for `enhanced-totem` and `seismic-echo` belong there, along with the items in "Odloženo mimo fázi 1" of the phase 1 plan.

## Open questions for Petr

- Branch previews (Cloudflare Pages, spec §4) need his Cloudflare account. Until then the game is played from `main` after a merge.
- Branch protection for `main` is a GitHub setting he controls.

## Environment notes (cloud container)

- `gh` GraphQL does not work here; use the REST API (`gh api`), for example `gh api -X POST repos/Wizzik/defense-webgame/pulls ...`. A draft PR cannot be marked ready without GraphQL, so open PRs as ready or close and reopen them.
- Commits must use the identity `Claude <noreply@anthropic.com>` (set in the repo's git config), or GitHub shows them as Unverified. Add the session's co-author trailers.
- The shell cannot reach github.io or Actions artifact storage. Check the live site with WebFetch.
- The map export is in `data-source/v20.75/out/` (untracked). If it is missing, run `npm run map:extract -- <map.w3x> v20.75`; the map is a file in the claude.ai project.
- Playwright uses the pre-installed Chromium (`/opt/pw-browsers/chromium-1243`), so `@playwright/test` stays at 1.63.0.

## Resume after a break

Read this file, then the task you are on in the current plan, then `git log --oneline -15`. During execution the SDD ledger at `.superpowers/sdd/<plan>/progress.md` lists the finished tasks; trust it and git over memory.
