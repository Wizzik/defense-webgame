# Status

Updated 2026-11-11 night (phase 2b-2 is merged; the plan for Visual pass A is written on branch `visual-a` and waits for Petr's review). Read this first when you resume work.

## Visual pass A: plan written, not started

- Plan: `docs/superpowers/plans/2026-11-11-visual-pass-a.md` (7 tasks, branch `visual-a`). Execute it in a new chat.
- What it brings: KayKit CC0 models (8 heroes from 5 adventurer bodies, 6 skeleton enemy types with weapons, a castle, a forest around the arena), procedural ground, dusk light and fog, a shadow map plus blob shadows, a build tool for assets. The simulation and the balance do not change.
- Checked on 2026-11-11: the cloud shell can download the kits (`raw.githubusercontent.com` and `git clone` of `KayKit-Game-Assets/*` work; github.com pages and zip downloads of other repos do not). Petr does not have to attach anything.
- Decisions Petr can still change before execution (all in the plan's tables): which body and weapon each hero gets, skeletons as the enemies, the cool dusk palette, no trees or rocks inside the spawn ring (the simulation has no obstacles).
- Petr has to choose the execution method: subagent-driven or native.

## Phase 2b-2 (ring arena, enemy AI, four heroes): merged (PR #7, 2026-11-11)

- Live at https://wizzik.github.io/defense-webgame/ (CI and Pages green on `eb6e671`). 8 heroes, packs from every side, five enemy behaviours; the autopilot loses about half of its runs. No final whole-branch review ran before the merge.
- **Open for Petr 1:** Gravecaller and Serpent Shaman still win 5 of 5 and are never in danger, also after Petr's cuts of 2026-11-11 evening (Serpent Totem damage halved, Grave Grasp heal -75 %). They need a redesign of their kits.
- **Open for Petr 2:** the balance targets are measured on 5 seeds and a run is chaotic. On seeds 6-15 the same build gives 1 to 9 wins of 10 depending on the hero. The next balance pass should measure on more seeds with wider bands.
- What Petr should check in the playtest: packs come from all sides and reach him and the castle, the types read apart, the first tries are often lost, and the menu shows 8 heroes.
- Numbers: `docs/DECISIONS.md`. Plan: `docs/superpowers/plans/2026-11-11-phase-2b2-ring-ai-heroes.md`.

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

**2b-1 Swarms and enemy variety: merged (PR #6, 2026-11-11).** Packs, 6 enemy types, shooters and healers, a 5-minute run in 6 phases, the GPU name in the `?fps=1` overlay. Five minor review notes are left for a later pass: the chaplain heals every 31 steps, not 30; `Effects` keeps uploading behind the menu after a restart; the Lancer and the Chaplain are both pale (size tells them apart); the e2e test for a shooter that dies in the step it fired only proves that nothing crashes. Plan: `docs/superpowers/plans/2026-11-10-phase-2b1-swarms-and-enemies.md`.

**Petr's playtest of 2a (2026-11-10), the reason for 2b-1 (done) and the visual passes:**
- 20.5 fps: **resolved, not a game bug** (see below);
- the graphics are "terrible" and he wants a big improvement, with Tripo or Blender if useful (his Blender MCP does not install; no Tripo or Blender connector exists in the claude.ai directory);
- enemies come one by one, not in swarms, and there is only one enemy type: boring.

**Fps investigation (2026-11-10 evening):**
- Simulation cost is negligible: under 0.1 ms per step on average for all 4 heroes (about 20 enemies alive in the first 3 minutes).
- Measured the live build in the Claude desktop app's built-in browser on Petr's desktop (Windows, Chromium 152, WebGPU, NVIDIA Blackwell / RTX 50, 144 Hz, dpr 1, 1129x1275): stonehorn holds **144 fps, 1% low 141** up to 70 s; JS in the rAF callback is under 1 ms per frame (p95 1.6 ms).
- **Cause found and fixed:** Petr's Chrome 157 (Windows 10 22H2) had every GPU feature on "Software only". Enabling `chrome://flags` "Override software rendering list" gave **140 fps**, so Chrome's GPU blocklist was blocking his NVIDIA driver. Advised: update the NVIDIA driver, then set the flag back to Default and check chrome://gpu.
- 2b-1 added the GPU name to the `?fps=1` overlay and a menu warning on software rendering.

**Order after 2b-2 (approved by Petr 2026-11-10; 2b-2 was put in front on 2026-11-11):**
1. **Visual pass A, no external tools**: planned, see the top of this file.
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
- Push access: `add_repo` with `access: push` is sometimes refused by the auto-mode classifier (it worked in the 2b-1 planning chat and was refused in both 2b-2 execution sessions). Without it nothing can be pushed; tell Petr.
- The shell cannot reach github.io or Actions artifact storage. Check the live site with WebFetch, or measure it on Petr's computer through the desktop app's built-in browser (`javascript_exec` can read `window.__game` and time frames).
- The map export is in `data-source/v20.75/out/` (untracked). If it is missing, run `npm run map:extract -- <map.w3x> v20.75`; the map is a file in the claude.ai project.
- Playwright uses the pre-installed Chromium (`/opt/pw-browsers/chromium-1243`), so `@playwright/test` stays at 1.63.0.

## Resume after a break

Read this file, then the task you are on in the current plan, then `git log --oneline -15`. During execution the SDD ledger at `.superpowers/sdd/<plan>/progress.md` lists the finished tasks; trust it and git over memory.
