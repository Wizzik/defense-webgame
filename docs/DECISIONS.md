# Decisions

Decisions that still apply. Check here before you change a rule. Newest first in each section.

## Product (Petr)

- 2026-11-06: Petr approved the phase 1 plan and gave blanket permission ("vše povoluji"). Work inside an approved plan, including the merge after a clean final review and green CI, goes ahead without asking.
- 2026-11-06 (tempo pass, after Petr's playtest "slow, few enemies, long cooldowns, boring"):
  - the pace comes from uniform multipliers in `design/scaling.yaml`, which data-build applies to every hero, ability and enemy: hero speed ×1.4, attack cooldown ×0.5, ability cooldowns ×0.33, enemy HP ×0.3, enemy speed ×1.22;
  - the autopilot tuning in `design/rules.yaml`: castle 12000 HP, spawn rate 1.2/1.8/2.4/3.0 per second, `hunterShare` 0.2 in every phase, `xpFirst` 5, `xpStep` 3. That gives about 360 enemies a run, level about 11, and 4 of 5 autopilot wins;
  - the freeze on hero and progression values is lifted: tests set or derive those values themselves;
  - the run also gained knockback, damage numbers, a death pop, camera shake and synthesized sounds.
  This replaces the entry below.
- 2026-11-06 (phase 1, Task 8, superseded): the first balance is a tuning result, not Petr's choice. To make the autopilot win most seeds and an idle run lose, castle HP went from 3000 to 10000 and the spawn rate to 0.18/0.22/0.26/0.30 per second (×0.4). Only `castle` and `phases` may be tuned without touching tests; the `hero`, `progression`, `run` and `arena` values are quoted by tests.

- 2026-11-04: Two Stonehorn abilities were renamed: `cleaving-blows` → `enhanced-totem` and `concussion` → `seismic-echo`. Only the names changed. Their real map mechanics wait for phase 2: an empowered next attack every 7 s, and the hero's spells stunning and dealing bonus damage.
- 2026-11-04: Phase 0 was accepted on fps measured on Petr's laptop (see `docs/STATUS.md`).
- 2026-11-04: The repository is public. Map identifiers and names appear only in `tools/`, `design/` and `docs/`, never in anything shipped to players.
- 2026-11-04: Enemies arrive in a continuous flow, with no waiting between waves. The game pauses only for a level-up choice and in menus.
- 2026-11-04 (design approval):
  - free public game, a clean remake without Blizzard assets, names or texts;
  - hybrid of castle defense and survivors;
  - runs of 15–20 minutes;
  - RPG progress: items and recipes inside a run, plus persistent unlocks (heroes, talents, account perks);
  - solo with an AI ally first, co-op later (that is why the simulation is deterministic);
  - low-poly 3D with a top-down camera, desktop browser with WASD and mouse;
  - TypeScript, Three.js and Vite.
- Workflow: spec → one plan per phase → subagent-driven execution task by task. Petr approves each plan and each merge to `main`.
- Skills: the map-data skill (`xhero-map-data`) is saved; the project development-rules skill follows the approved phase 1 plan.

## Engineering

- The spec outranks a plan. The fps gate is "roughly 60 fps with 150 enemies" (spec), not "≥ 60" (phase 0 plan).
- Push the feature branch after every reviewed task, because the container can restart; merging to `main` waits for Petr.
- `mapName` stays in `design/*.yaml` for looking objects up and never reaches `data/generated`.
- The `data/generated` guard lives in `data/generated.test.ts`.
- To find values held in GUI triggers, read the whole trigger, not just the functions it names.
- data-build validates everything before it writes; a failed build writes nothing.
- Abilities whose map mechanic has no matching param get zero design params until they are ported.
- E2E render check: the overlay is hidden and the luminance stddev must exceed 2.5 (an empty scene gives 0.39). At n=600 the test compares frame counts over 10 s.
- Final whole-branch reviews run on the most capable model available. Fable needs usage credits, so they ran on Opus.
- Phase 1 plan: the revised version (2026-11-06) replaced the first draft in commit f193a3f.
- Simulation determinism: no transcendental `Math` functions or `**` in `sim/`, because their results may differ between JS engines and co-op needs identical runs. The repo guard enforces it.
- Simulation tests set every rule value they assert on, so balance tuning cannot break them.
- Event fields are fixed by the table in the phase 1 plan (Task 3). The client depends on them.
- Commits use `Claude <noreply@anthropic.com>`, because the environment's signing check requires it (2026-11-06).
