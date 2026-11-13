# Status

Updated 2026-11-12 (the elite and boss threat pass is on its branch and waits for Petr's merge and playtest; phase 2b-3 is merged). Read this first when you resume work.

## Elite and boss threat: done on branch `elite-boss-threat`, PR #11 open, waits for Petr

- Why: Petr's playtest of 2b-3 (elites too weak, running away kills everything, bosses cannot reach or catch the hero). Spec: `docs/superpowers/specs/2026-11-12-elite-boss-threat-design.md`; numbers and the balance table: `docs/DECISIONS.md`, section Elite and boss threat.
- What it brings: elites hunt the hero and charge; minibosses hunt the hero; every boss strikes from afar with a 1 s warning circle on the hero (three of them leap into it, the Gunmaster shoots). `npm run check`, the build and the e2e project `webgl2-fallback` pass.
- What Petr checks in the playtest: is running away still safe; is 1 s enough to leave the circle; are the elites and the first boss (4:10) too hard now; do minibosses still die too fast (about 20 s for the autopilot, their hp did not change). Quick links: `?debug=1&phase=6` (first miniboss), `&phase=4` (elite rush after 30 s), `&phase=21` (finale).
- Next: Petr merges PR #11 (https://github.com/Wizzik/defense-webgame/pull/11) and plays.
- Open: the Tidecaller fell from 14 to 2 autopilot wins of 20; Sparkshot still wins none.

## Next (agreed with Petr 2026-11-12, each with its own design and plan, in new chats)

1. **Items in the run:** gold drops from enemies; chests lie on the map, the hero pays gold to open one and picks 1 of 3, and every next chest costs more (Petr chose chests on the map over a shop at the castle and over chests dropped by elites). This replaces the castle shop of the first spec (section 3.5).
2. **Permanent gear** between runs, as in Azeroth Survivors (wow.aethus.pl): new against the first spec, which had only talents and perks between runs.

## Phase 2b-3 (full run with a boss): merged (PR #10, 2026-11-12)

- All 8 tasks of `docs/superpowers/plans/2026-11-12-phase-2b3-full-run-boss.md` are done (executed inline in one chat with one final review). `npm run check`, the build and the e2e project `webgl2-fallback` pass.
- What it brings: a run of 20 phases (16:40), five elite rushes announced 7 s ahead, three minibosses (Iron Marshal 4:10, Pale Abbot 8:20, Gunmaster 12:30) and the final boss Dread Regent at 16:40 with an enrage 200 s later; the run is won when the final boss falls. Bosses slam the ground after a red warning circle. The HUD shows the phase, news and the boss's hp bar. `?debug=1&phase=N` starts at a phase.
- What Petr checks in the playtest (after the merge, on the live game):
  - the length and the pace of the run, and whether the second half feels thin (after the kit is full the cards offer only attributes; meant to last until 2c);
  - the slam circle: is it readable on the grass and on the dark earth by the castle, is 1 s enough to walk out;
  - how hard the bosses are; the final boss has 257 000 hp (the spec's 60 000 fell in under 30 s);
  - the news line and the boss bar under the clock (they share the place with "The castle is under attack!");
  - quick links: https://wizzik.github.io/defense-webgame/?debug=1&phase=6 (first miniboss at once), `&phase=4` (elite rush after 30 s), `&phase=21` (finale).
- **Open for Petr 1 (balance spread):** on 20 seeds the autopilot wins 10 (Stonehorn), 12 (Nightglaive), 7 (Mistwarden), but 17 (Serpent Shaman), 15 (Redcleaver), 14 (Tidecaller) and 0 (Sparkshot: its castle is almost gone when the finale starts). The run-wide numbers cannot close this spread; it needs kit work or a look at how the autopilot plays a ranged hero in the finale. Gravecaller still wins everything.
- **Open for Petr 2 (XP curve):** the full kit comes in phases 7-9 (the spec wanted 12-14) and a won run ends at level 49-50 (wanted 35-45). A slower curve made the heroes die between 2:00 and 6:00; it needs the early phases retuned with it. Numbers: `docs/DECISIONS.md`, section Phase 2b-3.
- Merged as `a684417`. The two open balance points stay open.

## Ward rework: merged (PR #9, 2026-11-12)

- Merged as `5207271`, Pages deployed.

- Petr's decision after the first playtest of visual pass A: Serpent Totem and Wisp Ward both raise 1, 2, 2, 3, 3 wards a cast, at most 2, 4, 4, 6, 6 alive, and the totem casts every 4.95 s on every level. Details and numbers: `docs/DECISIONS.md` (Product, 2026-11-12).
- Serpent Totem damage went 50 -> 60 to keep the Serpent Shaman in the balance bands (Claude's tuning; Petr may change it). The Serpent Shaman is no longer an open balance gap; the Gravecaller still is.
- What Petr checks: both heroes on the live game. Do the wards follow the fight well enough, or should they move with the hero (that needs new simulation code)?

## Visual pass A: merged (PR #8, 2026-11-12)

- Plan: `docs/superpowers/plans/2026-11-11-visual-pass-a.md` (7 tasks, all done). PR #8 merged as `0a6de7e`; CI was green on both e2e projects, Pages deployed. Live at https://wizzik.github.io/defense-webgame/.
- What it brings: KayKit CC0 models (8 heroes from 5 adventurer bodies, 6 skeleton enemy types with weapons, the castle with towers and flags, a forest around the spawn ring), procedural ground, dusk light and fog, a moon shadow map plus blob shadows, a build tool for assets. The simulation and the balance did not change (`git diff main -- sim design data` is empty). Decisions: `docs/DECISIONS.md`, section Visual pass A.
- What Petr checks in the playtest:
  - the look and the readability of the six enemy types; the strong type tint on enemies; the chaplain's small size;
  - the grass colour and the dark earth around the castle;
  - the mage hats hide gravecaller and mistwarden from above;
  - orange details in the kit textures (not removable without new textures) and stonehorn's orange hero colour;
  - the forest border outside the arena edge: that it hides the end of the world in every corner, and the size of the rocks;
  - `?fps=1` on his machine: the shadow map has never run on real hardware (only on software rendering here). Compare the default with `?shadows=0`;
  - the enemy cap of 3000 triangles and its fps cost with a full crowd.
- From the five minor notes after 2b-1, "the Lancer and the Chaplain are both pale" is gone (they are textured models now); four remain.

## Phase 2b-2 (ring arena, enemy AI, four heroes): merged (PR #7, 2026-11-11)

- Live at https://wizzik.github.io/defense-webgame/ (CI and Pages green on `eb6e671`). 8 heroes, packs from every side, five enemy behaviours; the autopilot loses about half of its runs. No final whole-branch review ran before the merge.
- **Open for Petr 1 (2026-11-12: the Serpent Shaman part is closed by the ward rework, the Gravecaller stays):** Gravecaller and Serpent Shaman still win 5 of 5 and are never in danger, also after Petr's cuts of 2026-11-11 evening (Serpent Totem damage halved, Grave Grasp heal -75 %). They need a redesign of their kits.
- **Open for Petr 2 (closed by 2b-3):** balance is now measured on 20 seeds (`sim:run --seeds 1-20`), with seeds 21-40 as a check; CI guards only the shape of a run.
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

**2b-1 Swarms and enemy variety: merged (PR #6, 2026-11-11).** Packs, 6 enemy types, shooters and healers, a 5-minute run in 6 phases, the GPU name in the `?fps=1` overlay. Minor review notes are left for a later pass (the pale Lancer and Chaplain note was closed by Visual pass A): the chaplain heals every 31 steps, not 30; `Effects` keeps uploading behind the menu after a restart; the e2e test for a shooter that dies in the step it fired only proves that nothing crashes. Plan: `docs/superpowers/plans/2026-11-10-phase-2b1-swarms-and-enemies.md`.

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
1. **Visual pass A, no external tools**: merged, see the top of this file.
2. **Visual pass B, own hero models** (needs Petr's computer): Tripo (text or image to 3D with auto-rig; check the licence of his plan before anything is committed, the repo is public) or Blender. Blender MCP install problem: Petr pastes the error into a chat on the computer with Blender. Constraints: hero <= 5000 triangles, enemy <= 3000 (see docs/DECISIONS.md), clips Idle, Running/Walking, Punch, Death, every asset in `assets/LICENSES.md`.
3. Then the rest of 2b: 20 phases, elites and bosses are done (2b-3); factions and difficulties remain. Then 2c economy, 2d shared abilities, 2e meta progression.
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
