# Status

Updated 2026-11-11 (phase 2b-1 merged with PR #6; the plan of phase 2b-2 is written and waits for Petr's approval). Read this first when you resume work.

## Next step: phase 2b-2 (ring arena, enemy AI, four heroes)

- Petr's playtest of 2b-1 (2026-11-11): too easy, enemies mostly never reach him, and there are too few heroes. He chose: +4 heroes (8 in all), the castle in the middle with packs from every side, difficulty "hard"; the enemy AI is ours to design.
- Plan: `docs/superpowers/plans/2026-11-11-phase-2b2-ring-ai-heroes.md` (branch `phase-2b2`, 6 tasks). Execute it in a new chat once Petr approves it. It suggests native execution with one final review.
- Visual pass A moves behind this phase.

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
- **Phase 2a (heroes and abilities): merged** (PR #5 on 2026-11-10) and live: 4 heroes, 16 abilities in 12 kinds, hero choice in the menu, R (ultimate), T (auto switch), Space (dash), ability HUD, effects, wards and copies, learn and ultimate cards, `sim:run --hero`.

## Next

**2b-1 Swarms and enemy variety: done on branch `phase-2b1` (2026-11-11), PR #6 open, waiting for Petr's decision on the merge and his playtest.**
- What it brings: enemies come in packs of 6–20 from one gate, there are 6 types in their own colours (Shieldbearer, Scout, Musketeer, Chaplain, Lancer, Captain), musketeers and chaplains shoot, chaplains heal, the run lasts 5 minutes in 6 phases, the `?fps=1` overlay names the GPU and the menu warns on software rendering.
- Balance (seeds 1–5, `npm run sim:run -- --hero all --runs 5`, and with `--idle`): Stonehorn 4 of 5 won, Nightglaive 3, Gravecaller 5, Serpent Shaman 5; an idle run loses with every hero except Gravecaller.
- **Open for Petr:** Gravecaller is never in danger and wins even without input (Grave Grasp heals 50 HP per enemy hit). The fix is a change of that spell (`healPerHit`), which 2b-1 was not allowed to make. The Nightglaive's average level is 20 (target 10–18). Details in `docs/DECISIONS.md`.
- What Petr should check in the playtest: packs feel like swarms, the types read apart, the hero has to move, and `?fps=1` shows about 60 fps or more in the last phase with his NVIDIA card named in the overlay.
- PR: https://github.com/Wizzik/defense-webgame/pull/6 (CI green). The final review of the whole branch found nothing critical or important. Five minor notes are left for a later pass: the chaplain heals every 31 steps, not 30; `sim:run` rounds `hero low` while the test does not; `Effects` keeps uploading behind the menu after a restart; the Lancer and the Chaplain are both pale (size tells them apart); the e2e test for a shooter that dies in the step it fired only proves that nothing crashes.
- Next step after the merge: **Visual pass A** (plan in a new chat).
- Plan: `docs/superpowers/plans/2026-11-10-phase-2b1-swarms-and-enemies.md`.
- The map export is in `data-source/v20.75/out/` only while the container lives; otherwise run `npm run map:extract`.

**Petr's playtest of 2a (2026-11-10), the reason for 2b-1 (done) and the visual passes:**
- 20.5 fps: **resolved, not a game bug** (see below);
- the graphics are "terrible" and he wants a big improvement, with Tripo or Blender if useful (his Blender MCP does not install; no Tripo or Blender connector exists in the claude.ai directory);
- enemies come one by one, not in swarms, and there is only one enemy type: boring.

**Fps investigation (2026-11-10 evening):**
- Simulation cost is negligible: under 0.1 ms per step on average for all 4 heroes (about 20 enemies alive in the first 3 minutes).
- Measured the live build in the Claude desktop app's built-in browser on Petr's desktop (Windows, Chromium 152, WebGPU, NVIDIA Blackwell / RTX 50, 144 Hz, dpr 1, 1129x1275): stonehorn holds **144 fps, 1% low 141** up to 70 s; JS in the rAF callback is under 1 ms per frame (p95 1.6 ms).
- **Cause found and fixed:** Petr's Chrome 157 (Windows 10 22H2) had every GPU feature on "Software only". Enabling `chrome://flags` "Override software rendering list" gave **140 fps**, so Chrome's GPU blocklist was blocking his NVIDIA driver. Advised: update the NVIDIA driver, then set the flag back to Default and check chrome://gpu.
- 2b-1 added the GPU name to the `?fps=1` overlay and a menu warning on software rendering.

**Order after 2b-1 (approved by Petr 2026-11-10):**
1. **Visual pass A, no external tools** (code and CC0 assets, in the cloud container): ground texture and lane edges, fog, shadows, better light, a real castle and gates from a CC0 kit, props (trees, rocks), CC0 rigged characters instead of the robot (KayKit, Quaternius: check that the shell can download them from GitHub; otherwise Petr attaches the zips), per-type enemy models baked into VAT.
2. **Visual pass B, own hero models** (needs Petr's computer): Tripo (text or image to 3D with auto-rig; check the licence of his plan before anything is committed, the repo is public) or Blender. Blender MCP install problem: Petr pastes the error into a chat on the computer with Blender. Constraints: hero <= 5000 triangles, enemy <= 2000, clips Idle, Running/Walking, Punch, Death, every asset in `assets/LICENSES.md`.
3. Then the rest of 2b (20 phases, elites, bosses, difficulties), 2c economy, 2d shared abilities, 2e meta progression.
4. Propose the second skill (project development rules).

**Fps test links for Petr** (play about 2 minutes, read the overlay: average and 1% low, and the backend it names):
- https://wizzik.github.io/defense-webgame/?fps=1&hero=stonehorn
- https://wizzik.github.io/defense-webgame/?fps=1&hero=serpent-shaman (totems)
- https://wizzik.github.io/defense-webgame/?fps=1&hero=gravecaller (Bone Stampede from hero level 6)
- the same with `&renderer=webgl2`

## Working with tokens

- One chat per plan or per phase: write the plan in one chat, execute it in the next. A new chat starts from this file.
- Tell Petr when a chat has grown long (he asked for this on 2026-11-10): at the latest after a plan is written, after a phase is merged, or when the history holds a whole executed plan.
- Subagent-driven execution costs the most (a fresh context per task and per review). For small plans (up to about 6 tasks) offer native execution with one final review.

## Open questions for Petr

- Branch previews (Cloudflare Pages, spec §4) need his Cloudflare account. Until then the game is played from `main` after a merge.
- Branch protection for `main` is a GitHub setting he controls.
- The WebGPU e2e project runs only in CI (it fails in the cloud container for an environmental reason); the local gate is `--project=webgl2-fallback`.

## Environment notes (cloud container)

- `gh` GraphQL does not work here; use the REST API (`gh api`), for example `gh api -X POST repos/Wizzik/defense-webgame/pulls ...`. A draft PR cannot be marked ready without GraphQL, so open PRs as ready or close and reopen them.
- Commits must use the identity `Claude <noreply@anthropic.com>` (set in the repo's git config), or GitHub shows them as Unverified. Add the session's co-author trailers.
- Push access: `add_repo` with `access: push` was refused once by the auto-mode classifier; in the 2b-1 planning chat it worked.
- The shell cannot reach github.io or Actions artifact storage. Check the live site with WebFetch, or measure it on Petr's computer through the desktop app's built-in browser (`javascript_exec` can read `window.__game` and time frames).
- The map export is in `data-source/v20.75/out/` (untracked). If it is missing, run `npm run map:extract -- <map.w3x> v20.75`; the map is a file in the claude.ai project.
- Playwright uses the pre-installed Chromium (`/opt/pw-browsers/chromium-1243`), so `@playwright/test` stays at 1.63.0.

## Resume after a break

Read this file, then the task you are on in the current plan, then `git log --oneline -15`. During execution the SDD ledger at `.superpowers/sdd/<plan>/progress.md` lists the finished tasks; trust it and git over memory.
