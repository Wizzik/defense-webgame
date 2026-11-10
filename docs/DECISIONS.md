# Decisions

Decisions that still apply. Check here before you change a rule. Newest first in each section.

## Product (Petr)

- 2026-11-10 (phase 2a, heroes and abilities; Petr approved the plan):
  - scope: only heroes and their spells; the run stays 3 minutes with one enemy type, shop and more enemies come in 2b and 2c;
  - start and cards: the hero starts with the 1st signature spell; cards offer a new spell, a spell level, the ultimate and attributes. The ultimate can be learned from hero level 6 and its 2nd level from 12 (map: 10). Card rerolls come in 2d;
  - Nightglaive spell order: Falling Stars, Hunter's Focus, Swift Pace (an aura first would do nothing at the start);
  - ultimate: R casts it, T switches automatic casting (on at the start). A manual cast does not wait for the targeting condition;
  - dash: Space, 350 units in 0.15 s in the move direction (standing: the facing direction), cooldown 4 s, no invulnerability;
  - spell power: spell, totem and heal damage is multiplied by spell power (INT). Spells ignore armor; totem and copy attacks do not;
  - summons: enemies do not attack or block them and they vanish when they expire. Serpent totems: at most 3/6/9/12/15 by spell level, the oldest vanishes. New Shadow Sisters replace the old;
  - empowered totem: every 2.3 s the next basic attack is stronger, x (1 + 3) to x (1 + 10) (map: +300 to +1000 %);
  - Seismic Echo: every cast of another hero spell (also the empowered hit) causes a quake, 45-225 damage (the map's 150-750 x 0.3), stun 1-3 s, radius 350;
  - Soul Bolt: half the map number (500-10000, shipped 150-3000 after the 0.3 damage scaling), because the original deals half to enemies; homing, retargets in flight;
  - Grave Grasp: aims at the biggest cluster within 800 and heals the hero 50-300 per hit (from the map trigger);
  - Mending Tide: heals only the hero, below 60 % HP; it does not heal the castle (castle repair belongs to 2c);
  - Spirit Ward: hero and castle are invulnerable 10/20 s; cast automatically when the hero or an attacked castle drops below 35 % HP; it cannot be cast (also not with R) while a shield runs, and its cooldown starts when the shield ends;
  - Groundbreaker, Bone Stampede: around the hero; Groundbreaker once, Stampede for 10 s sends 20-30 bursts a second to random places within 1000-1500;
  - targeting: nova needs at least 1 enemy in radius; area and totems pick the densest cluster in range; bolt the nearest enemy; the cone aims at the nearest enemy per the spell data (not the move direction as in spec 3.3), width grows from 120 units to 300 (map);
  - ranged attack: the hit is instant like melee, the bolt is only an effect; bounce comes later;
  - looks: every hero is the robot in the hero's colour, no new models; real models come in a separate art plan;
  - ability kinds: 12 implemented of 14, including the new `on_cast`; `instant` and `chain` wait for a spell that needs them (2d).
- 2026-11-10 (phase 2a tuning, Task 8): `abilities.damage` = 0.3 in `design/scaling.yaml` (the map's ratios between spells stay). The autopilot wins 5/5 with every hero, 318-339 kills, average levels 11.2/10.0/7.2/9.6 (stonehorn, nightglaive, gravecaller, serpent-shaman).
- 2026-11-10: the autopilot holds the castle post within a leash and ranged heroes do not chase; chasing to one gate made it lose with Nightglaive and Gravecaller, so the bot was the wrong measuring stick, not the numbers. Balance is judged by at least 3 of 5 bot wins per hero.
- 2026-11-10: an ability kind without an updater fails at the first step of a learned slot (`sim: ability kind <kind> is not implemented`) and the cards skip such kinds. `createRun` itself never throws for it.
- 2026-11-10: hero colours (body colour, emissive tint): Stonehorn gold `0xd9a441` (`0x553300`), Nightglaive violet `0x9a5cff` (`0x3a1f66`), Gravecaller green `0x7fdc3a` (`0x1f4d2a`), Serpent Shaman teal `0x22c4e0` (`0x0f4a4a`). The tint alone left all heroes orange, so the model is recoloured.
- 2026-11-10: known gaps accepted for 2a: an idle run (no input) wins with Nightglaive, Gravecaller and Serpent Shaman, and Gravecaller's average level is 7.2. Both are left for phase 2b, which replaces the run, enemies and phases.
- 2026-11-10 (final review): Spirit Ward cannot be cast while a shield runs (auto or R), and on cast its cooldown is the shield duration plus the scaled cooldown, so the shield cannot be kept up without gaps (before, a forced cast at 70 INT made hero and castle immune for good).
- 2026-11-10 (final review): the Stonehorn ultimate is renamed from the map's ability name to `groundbreaker` (EN Groundbreaker, CS Zemělam) for the clean room; the map name stays only as `mapName` in `design/abilities.yaml`.
- 2026-11-10: on_hit abilities are armed one step after they become ready (hero combat runs before abilities), so the very first attack of a run is not empowered.
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
