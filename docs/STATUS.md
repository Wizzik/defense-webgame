# Status

Updated 2026-11-10 (phase 2a merged; next steps proposed after Petr's playtest). Read this first when you resume work.

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

**Phase 2a (heroes and abilities) is merged** (PR #5 on 2026-11-10, with PR #4 effects; PR #3 closed as merged) and live at https://wizzik.github.io/defense-webgame/: 4 heroes, 16 abilities in 12 kinds, hero choice in the menu, R (ultimate), T (auto switch), Space (dash), ability HUD, effects, wards and copies, learn and ultimate cards, `sim:run --hero`.

**Petr's playtest of 2a (2026-11-10):**
- fps is worse than before (no numbers yet; links below);
- the graphics are "terrible" and he wants a big improvement, with Tripo or Blender if useful (his Blender MCP does not install; no Tripo or Blender connector exists in the claude.ai directory);
- enemies come one by one, not in swarms, and there is only one enemy type: boring.

**Proposed order (not approved yet; Petr confirms in a new chat, then write ONE plan at a time):**
1. **2b-1 Swarms and enemy variety** (gameplay first, robots still):
   - spawner in packs: groups of 8-20 from a gate every few seconds instead of a steady trickle, up to the 150 alive cap; a short breather between packs;
   - 4-5 enemy types with map numbers (`design/enemies.yaml`): basic melee, fast weak runner, ranged, slow brute, elite; told apart by size and colour until models exist;
   - phases mix the types; raise the hunters' share so the hero is in danger; this also closes the 2a gaps (idle runs win with 3 heroes, Gravecaller level 7.2);
   - first task is a perf check: measure with `?fps=1`, then fix what 2a added (effect buffers are uploaded every frame even when empty; up to 6 skinned copies; HUD strings every frame).
2. **Visual pass A, no external tools** (code and CC0 assets, in the cloud container): ground texture and lane edges, fog, shadows, better light, a real castle and gates from a CC0 kit, props (trees, rocks), CC0 rigged characters instead of the robot (KayKit, Quaternius: check that the shell can download them from GitHub; otherwise Petr attaches the zips), per-type enemy models baked into VAT.
3. **Visual pass B, own hero models** (needs Petr's computer): Tripo (text or image to 3D with auto-rig; check the licence of his plan before anything is committed, the repo is public) or Blender. Blender MCP install problem: Petr pastes the error into a chat on the computer with Blender. Constraints: hero <= 5000 triangles, enemy <= 2000, clips Idle, Running/Walking, Punch, Death, every asset in `assets/LICENSES.md`.
4. Then the rest of 2b (20 phases, elites, bosses, difficulties), 2c economy, 2d shared abilities, 2e meta progression.
5. Propose the second skill (project development rules).

**Fps test links for Petr** (play about 2 minutes, read the overlay: average and 1% low, and the backend it names):
- https://wizzik.github.io/defense-webgame/?fps=1&hero=stonehorn (baseline, close to phase 1)
- https://wizzik.github.io/defense-webgame/?fps=1&hero=serpent-shaman (totems)
- https://wizzik.github.io/defense-webgame/?fps=1&hero=gravecaller (Bone Stampede from hero level 6)
- the same with `&renderer=webgl2`

## Working with tokens

- One chat per plan or per phase: write the plan in one chat, execute it in the next. A new chat starts from this file.
- Tell Petr when a chat has grown long (he asked for this on 2026-11-10): at the latest after a plan is written, after a phase is merged, or when the history holds a whole executed plan.
- Subagent-driven execution costs the most (a fresh context per task and per review). For small plans (up to about 5 tasks) offer native execution with one final review.

## Open questions for Petr

- Branch previews (Cloudflare Pages, spec §4) need his Cloudflare account. Until then the game is played from `main` after a merge.
- Branch protection for `main` is a GitHub setting he controls.
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
