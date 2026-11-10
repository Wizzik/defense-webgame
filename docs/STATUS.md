# Status

Updated 2026-11-10 (phase 2a implemented). Read this first when you resume work.

## Now

- **Phase 0 (foundation): done.** PR #1 was merged on 2026-11-04. On Petr's laptop the spike holds 60 fps on average with 150 and 600 enemies, with a 1% low of 57–59 fps on both WebGPU and WebGL2.
- **Phase 1 (vertical slice): done, merged with PR #2.** The 3-minute run is playable at https://wizzik.github.io/defense-webgame/:
  - Stonehorn moves with WASD, Rock Rupture casts itself, and siegers and hunters come from two gates;
  - XP crystals drop, and each level-up offers three cards;
  - the run ends in a win, or in a loss when the castle or the hero falls;
  - the UI is in EN and CS;
  - the simulation is deterministic and replayable;
  - there are 176 unit tests and 12 e2e tests, and CI is green.
- **Tempo and effects pass (2026-11-06, PR #3 tempo and PR #4 effects + sounds)** after Petr's first playtest:
  - survivors pace through `design/scaling.yaml`: about 360 enemies a run, level about 11, Rock Rupture every 4 s;
  - knockback, damage numbers, death pop, camera shake and synthesized sounds (M mutes).
  - The pace is tuned in `design/scaling.yaml` (multipliers on map numbers) and `design/rules.yaml` (castle, spawns, XP). After a change run `npm run data:build` and `npm run sim:run -- --hero all --runs 5`.
  - The hero is rarely in danger, because hunters are 20 % in every phase. Raise `hunterShare` if the run feels too easy.

## Next

1. **Phase 2a (heroes and abilities): implemented** on branch `phase-2a` (PR #5, built on PR #4 `effects`, which is still open). It waits for Petr to play and merge: 4 heroes (Stonehorn, Nightglaive, Gravecaller, Serpent Shaman), 16 abilities in 12 kinds, hero choice in the menu, R (ultimate), T (auto switch) and Space (dash), ability HUD, effects, wards and copies, learn and ultimate cards, `sim:run --hero`.
2. Next is the plan for **phase 2b (run structure)**: 20 phases, factions, elites, bosses, difficulties. It also replaces the run, enemies and phases, which closes the known 2a gaps (idle runs win with 3 heroes, Gravecaller averages level 7.2).
3. Phase 2c economy, 2d shared abilities, passives and evolutions, 2e meta progression and saves follow.
4. Propose the second skill (project development rules).

## For Petr to try

- Each hero from the menu (or `?hero=<id>`): spells cast themselves, check the look and the feel of each.
- R casts the ultimate, T switches its automation, Space dashes.
- `?fps=1` with full serpent totems (Serpent Shaman) and with Bone Stampede (Gravecaller): about 60 fps expected, on both renderers (`&renderer=webgl2`).

## Open questions for Petr

- Branch previews (Cloudflare Pages, spec §4) need his Cloudflare account. Until then the game is played from `main` after a merge.
- Branch protection for `main` is a GitHub setting he controls.
- PR #4 (effects, includes the tempo pass) must be merged before PR #5; PR #3 (tempo) is closed after that.
- The WebGPU e2e project runs only in CI (it fails in the cloud container for an environmental reason); the local gate is `--project=webgl2-fallback`.
- Character art (own hero models) is a separate plan, to be made with the Blender MCP.

## Environment notes (cloud container)

- `gh` GraphQL does not work here; use the REST API (`gh api`), for example `gh api -X POST repos/Wizzik/defense-webgame/pulls ...`. A draft PR cannot be marked ready without GraphQL, so open PRs as ready or close and reopen them.
- Commits must use the identity `Claude <noreply@anthropic.com>` (set in the repo's git config), or GitHub shows them as Unverified. Add the session's co-author trailers.
- The shell cannot reach github.io or Actions artifact storage. Check the live site with WebFetch.
- The map export is in `data-source/v20.75/out/` (untracked). If it is missing, run `npm run map:extract -- <map.w3x> v20.75`; the map is a file in the claude.ai project.
- Playwright uses the pre-installed Chromium (`/opt/pw-browsers/chromium-1243`), so `@playwright/test` stays at 1.63.0.

## Resume after a break

Read this file, then the task you are on in the current plan, then `git log --oneline -15`. During execution the SDD ledger at `.superpowers/sdd/<plan>/progress.md` lists the finished tasks; trust it and git over memory.
