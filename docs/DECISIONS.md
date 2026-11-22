# Decisions

Decisions that still apply. Check here before you change a rule. Newest first in each section.

## Multiplayer migration, steps 1-2: players and several heroes in the simulation (2026-11-22; Petr asked to go on with multiplayer, the choices are Claude's)

- `run.players` (`sim/player.ts`) holds what belongs to one player; the matrix digest stays `4bc81413` (pinned now by `client/determinism/digest.test.ts`, `npm run sim:digest`).
- **The current player instead of a parameter in 45 files:** `run.current` names the player whose systems run, and the old fields (`run.hero`, `run.gold`, `run.abilities`, ...) read `players[current]`. `Run.step` sets it around every per-player system, allies and bolts set it to their `owner`, and it is back to 0 outside. Why: the inventory's plan (a `player` parameter for every system) touches about 45 files and 1-2 chats; with `current` step 2 is a change in `run.ts`, the hash, allies, bolts and the start phase, and every kill, lifesteal, elite-kill haste and knockback is credited to the player whose spell or attack it was without a word changed in those files. The price: a hidden index; code outside `Run.step` must not leave it set (the tests check it is 0 after a step). Explicit parameters can still replace it file by file later.
- Players stand `PLAYER_START_SPACING` = 120 apart east and west of the hero start (0, +120, -120, +240).
- Until step 5 a level-up of any player still pauses the whole run (the offer goes to the first player with level-ups; `run.choosing`), and a chest likewise; until step 6 the run is lost when every hero has fallen (a fallen hero just lies there and casts nothing; no revive yet). Until steps 3 and 4 enemies, pickups, orbs, snares, clouds and the hazard see only player 0.
- Kills by the storm, clouds or other run systems count for player 0 (gear effects that react to an elite kill).

## Difficulties and worlds, plan 3a: Red Waste and Shadewood (2026-11-22; the numbers, looks and the split of plan 3 are Claude's)

- Plan: `docs/superpowers/plans/2026-11-22-difficulties-worlds-2-3.md` (spec 4.1, 4.5, 4.7 points 2-3, 4.8, 4.9, 4.10 point 3). **Plan 3 split in two:** 3a (this) builds the per-world look and model loading and worlds 2 and 3 whole; 3b (next chat, after Petr plays 3a) brings Frostreach (an ice ridge with a pass, a blizzard with chill) and Blightscar (a broken wall with breaches, green meteors leaving fire), their looks, the ladder tuned to spec 4.2 for world 5 and shots `world-4`, `world-5`. Worlds 4 and 5 still share world 1's map, storm and look.
- **Natural events** (`data/schema/world.ts`): the union got `weather` (a timed event slowing everyone's walking: `effect: sand`, fromPhase, everySeconds, durationSeconds, warnSeconds, moveSlow) and `thicket` (fixed zones `[x, y, r]` with `slow`). `stormOf(world)` narrows to the storm; `sim/hazard.ts` runs the storm or `sim/weather.ts`.
- **Red Waste skeleton:** a river across the whole arena (thickness 150; it crosses the arrival ring on purpose, so packs from the north walk over the bridges): polyline (-3000,1500) (-1500,1150) (-400,1250) (600,1000) (1700,1200) (3000,900) with two bridges, gaps 400 at x = -1100..-700 (centre (-900, 1205)) and 950..1350 (centre (1150, 1100)). The plan's 300 left the bridge cell blocked on the 100-unit grid (150 thickness + 2 x 36 margin), so both bridges and the tree-ring passages are 400. Paths: two to the bridges, S, E. Islands 28-36, radius 40-200, rock 6 / trees 1 / ruin 3 (mesas and rocks, dry stumps, clan tents).
- **Sandstorm:** from phase 2, announced 5 s ahead ("A sandstorm is coming!"), then 15 s of -20 % walking speed for the hero and every enemy (not the dash, not knockback), every 100-130 s from the end of the previous one (the gap is drawn from `hazardRng`). Events `HazardWave` with `u` = 1 warning, 2 start, 3 end (the storm keeps `u` = 0). The state hash mixes the weather's steps only while one is announced or runs, so world 1's hash is unchanged.
- **Shadewood skeleton:** a ring of ancient trees of radius 1300 around the castle (16 segments, thickness 110) with four passages 400 wide on the diagonals; four diagonal paths through them. Islands 34-44, rock 2 / trees 7 / ruin 1.
- **Thornbrake:** eight zones (r 200-320; two inside the ring) where walking is **30 %** slower (the plan's 35 % put world 3 mid gear at 73 of 160, under its band); a path through a zone wins (+15 %). Stored in a path-cell mask (`WorldMap.thicket`, cells of 50); `groundSpeedScale` replaced `pathSpeedScale`; `inThicket` for the HUD and `sim:run`.
- **Looks** (`client/render/world-look.ts`, pure data; `lookOf(id)`, worlds without a row look like Silver March): ground, sky, fog, hemisphere and moon light, path and stone colours, water, the feature style (`wall`, `river`, `trees`), island and forest models, a prop tint, the thicket and weather. Red Waste: wine-red and brown-red clay (hues 340-10°), a blue river with a dirt bank, stone bridge decks, prop tint 0xb4a6c4 (0xd9b8c0 made the stumps rust-orange), sand fog 34-78 (the plan's 14-40 hid everything: the camera is 46 away) with blown dust. Shadewood: night blues, a cold moon, the ring's tree clusters at scale 0.5 on a bank of roots (full size they were a forest band that hid the hero), dark violet thicket discs with bushes, fireflies. A test forbids orange (hue 15-45° with saturation > 0.35) in every look.
- **Models:** eight new KayKit hex models (CC0): `mesa-a`, `mesa-c`, `rock-d`, `stump-a`, `stumps`, `tent`, `bush`, `trees-d` (250 kB together). Budget per world: each world's env models ≤ 1.5 MB, the common models plus the heaviest world ≤ 10 MB (`tests/assets.test.ts`). A world's models load once (the `ModelCache`) before its first run; the world screen's Start shows "Loading…" until then. `ArenaView` rebuilds the ground, forest and light when a run of another world starts.
- **Particles:** dust and fireflies are an `InstancedMesh` of tiny octahedrons around the hero (WebGPU draws points 1 pixel wide), client-only randomness.
- **Tuning** (`sim:run --hero all --seeds 1-20`, Normal, wins of 160; `worldStep` unchanged, so worlds 4-5 keep their plan 2 numbers):

| Normal | none | mid | full |
|---|---|---|---|
| world 1 (unchanged) | 74 | 104 | 137 |
| world 2 Red Waste | 64 | 88 | 125 |
| world 3 Shadewood (thicket 35 %) | 56 | 73 | - |
| world 3 Shadewood (**30 %**) | 53 | 78 | 121 |

- Without gear: world 2 Stonehorn 13, Nightglaive 6, Gravecaller 20, Serpent Shaman 10, Mistwarden 1, Sparkshot 10, Redcleaver 1, Tidecaller 3; world 3 Stonehorn 13, Nightglaive 3, Gravecaller 20, Serpent Shaman 7, Mistwarden 1, Sparkshot 7, Redcleaver 0, Tidecaller 2 (7 heroes above 0 in both). A run of world 2 sees ~7 sandstorms; the autopilot spends ~2-3 % of its steps in a thicket.
- **Step time** (stonehorn, phase 16, seeds 1-3, warm): world 1 0.058 ms, world 2 0.067 ms (1.15x), world 3 0.077 ms (1.3x, over the 1.2x goal). `crossesFeature` now skips segments whose own box a line misses (exact; the same runs); the rest is the hero's flow field, which enemies outside the ring need far more often. 0.077 ms is under 1 % of a 144 fps frame even at three steps a frame, so it stays; Petr's fps check decides.
- **Determinism:** matrix cases `w2-sand` (mistwarden, seed 11, phase 4, 6000 steps: a whole sandstorm) and `w3-thicket` (stonehorn, seed 13, phase 2, mid gear, 4500 steps); `w1-storm` keeps its checkpoints; digest `4bc81413` (Node = sim-chromium).

## Difficulties and worlds, plan 2: obstacles, paths, the wall of world 1, the summer storm (2026-11-21; Petr chose islands plus one chokepoint per world and a fixed skeleton plus seeded islands, the numbers are Claude's)

- Plan: `docs/superpowers/plans/2026-11-21-difficulties-obstacles.md` (spec 4.5, 4.6, 4.7 point 1, 4.9, 4.10 point 2). Worlds 2-5 share world 1's map and storm (YAML anchors `&silverMap`, `&silverStorm`) until plan 3.
- **Skeleton of world 1** (`design/worlds.yaml` `map`, north = +y): the old wall, 90 thick, five segments `[-1650,1050,-1400,1500]`, `[-1400,1500,-750,1500]`, `[-500,1500,500,1500]`, `[750,1500,1400,1500]`, `[1400,1500,1650,1050]`: two gates 250 wide (axis to axis; 160 free between the wall's rounded ends) at x = -625 and 625, the ends ~1960 from the castle, inside the arrival ring. Four paths 160 wide, +15 % walking speed for the hero and enemies (not the dash): NW and NE through the gates, S, W.
- **Islands** (`sim/world-map/islands.ts`): 30-40 from `mapRng = Rng(seed ^ 0x68e31da4)` (the run's rng never draws for the map), radius 40-220, kinds rock 5 / trees 4 / ruin 2; a try is refused inside the castle circle (600 + r), the arrival ring (2200-2600 ± r), 60 + r beside a path, 150 + r beside the wall, 120 from another island, outside the arena; 40 tries per island. **Passability:** after each island a BFS from the castle's cell (60 x 60 cells of 100, 8 neighbours, no corner cutting; a cell is blocked when its centre is within an obstacle grown by `PASS_MARGIN` 36) must reach every free cell, else the island is taken back and the try fails. A map is built in ~5.5 ms.
- **Collisions** (`sim/world-map/geometry.ts`): `pushOut` moves a circle out of the wall segments (perpendicular) and islands (radially, +x at the exact centre). The hero moves in pieces of at most 24 (`MOVE_PIECE`), each pushed out; a dash piece pushed back by more than half ends the dash (no dash through the wall). Enemies are pushed out after separation, knockback and the hero/castle push; a charge or a leap flies over and is pushed out after it lands. Spawns, chests and orbs go through `nearestFree`; a chest or orb try in an obstacle is refused.
- **Avoidance and flow** (`sim/enemy-steer.ts` `avoidIslands`, `sim/world-map/flow.ts`): a walking enemy turns onto the tangent of the nearest island ahead (centre ahead within r + R + 1.5 r, less than R + r to the side; the side away from the centre, even slots right when exactly in line). When the straight line to its target touches the wall (`crossesFeature`), it follows a flow field instead: `toCastle` (built with the map) or `toHero` (recomputed lazily when an enemy asks and the hero changed cells, at most every 2 steps; the spec's every-8-steps refresh is dropped because the grid is static). A melee enemy does not strike over the wall; shots fly over it. The autopilot walks every target (orbs, chests, its post, the enemy it chases) through `routeTo`: straight, or along `forBot` when the line touches the wall or an island (recomputed at most every 8 steps, when its target cell changed); it dodges a waiting bolt like a slam.
- **Summer storm** (`sim/hazard.ts`, `hazard` of the world): from phase 3, a wave every 55-70 s (the first 55-70 s into phase 3 or after a later start), 1-3 bolts within 300 of the hero, a warning circle of radius 120 for 1.2 s (36 steps), then 8 % of the hero's max hp (no armor; exactly the share, the damage-taken scale is undone; the spirit shield stops it), 20 % of an enemy's and 2 % of a boss's max hp (source 2: no lifesteal, not scaled by berserk); the castle is spared. Own rng `Rng(seed ^ 0x1b873593)`. Events `Hazard` (0 warning, 1 strike) and `HazardWave` (the first wave), `HeroHitSource.Storm`.
- **Tuning** (`sim:run --hero all --seeds 1-20`, world 1 Normal, wins of 160): the storm made the autopilot *win more* whatever it did to enemies (it dodges almost every bolt, 0.1 hits a run, and the dodging pulls it out of crowds): without the storm 71, with waves every 35-45 s 88 (enemyShare 0: 89; 0.05 with heroShare 0.12: 90), islands 45-55: 84, waves every 75-95 s: 81, **every 55-70 s: 74 (chosen)**. heroShare stays 0.08 (a human does get hit).

| world 1 Normal | none | mid | full |
|---|---|---|---|
| plan 1 (no obstacles) | 73 | 94 | 127 |
| plan 2, storm every 35-45 s | 88 | 92 | 141 |
| plan 2, every 55-70 s | **74** | 104 | 137 |

- Per hero without gear (55-70 s): Stonehorn 20, Nightglaive 5, Gravecaller 20, Serpent Shaman 11, Mistwarden 2, Sparkshot 9, Redcleaver 0, Tidecaller 7. World 5 Normal with mid gear: 76 (plan 1: 67).
- **Step time** (stonehorn, phase 16, seeds 1-3, 13 500 steps): `main` 0.050-0.054 ms, plan 2 0.076 ms (~1.5x; the same branch on an open field 0.058 ms). The move masks of the BFS and a "nothing near" flag per cell keep it there.
- **Client:** no new models (budget unchanged): the wall and gate posts are instanced stone boxes, ruins broken stone blocks, rocks and trees the prop models scaled by the island radius (trees at most x1.1 so they hide little); paths are flat strips of blue-grey earth. The storm draws a blue-white warning circle, a vertical flash and a 0.15 s brightening of the scene (only with screen shake on); sounds `storm.warn` (storm-totem files) and `storm.strike` (shared-smite files). The lightning glyph in the effect bar counts down to the nearest bolt; the news line "A summer storm is coming!"; the world screen names the natural event.
- **Determinism:** matrix case `w1-storm` (sparkshot, seed 9, phase 3, 4500 steps); digest `38f9402b` (sim-chromium).
- Test helper `openArena(data)` (`sim/testing/game-data.ts`): no islands, no paths, the wall off the map; the tests of other systems that build their own arena use it.

## Difficulties and worlds, plan 1 (2026-11-21; Petr chose the world ladder plus Normal / Insane / Hell, the numbers are Claude's)

- Spec: `docs/superpowers/specs/2026-11-21-difficulties-worlds-design.md`. Plan 1 brings the table, the five worlds (world 1 ready, worlds 2-5 playable with the look of world 1 and marked "coming soon"), the world choice after menu Start, unlocks and rewards. Obstacles, paths and natural situations come with plans 2 and 3, so the world choice shows no natural situation yet.
- **Table** (`rules.difficulty`, `sim/difficulty.ts`): enemy hp and damage x level x (1 + 0.035 x (world - 1)), so world 5 is x1.14; elites and bosses x `eliteHp` on top; pack sizes x `packSize` (the cap of 150 living enemies stays); castle and hero unchanged.

| | hp | damage | packs | elites and bosses | magic find | extra rushes |
|---|---|---|---|---|---|---|
| Normal | x1 | x1 | x1 | x1 | +0 | none |
| Insane | x1.35 | x1.35 | x1.2 | x1 | +25 % | 1:30 (1 + 2), 4:30 (2 + 3), 7:30 (3 + 4), 10:30 (4 + 6), 13:30 (5 + 8) |
| Hell | x1.75 | x1.75 | x1.4 | x1.2 | +50 % | as Insane |

- Extra rushes (elites + heavies of the phase's faction) are about one step weaker than the normal rush before them and are announced like the others; an extra rush at the time of a normal event comes after it.
- **Rewards:** gold from enemies x (1 + 0.1 x (world - 1)); magic find +10 % per world above the first plus the level's; it raises chest cards and boss drops (Claude's ruling: the spec names magic find in general).
- **Why so much smaller than the spec's proposal** (world step 0.25, Insane x1.75, Hell x3 and elites x1.5): with them world 5 Normal with mid gear won 3 of 80 (seeds 1-10), Insane world 1 with full gear 16 of 80 and Hell about 1. The losses were castle losses in the finale: the bigger final boss could not be killed before the castle fell. A world step of 0.04 gave 32 of 80 and 0.03 42 (seeds 1-10), so 0.035.
- **Wins of the autopilot, seeds 1-20 (of 160):**

| course | no gear | mid gear | full gear |
|---|---|---|---|
| world 1 Normal | 73 (as before) | 94 (as before) | 127 |
| world 2 Normal | 65 | 83 | 126 |
| world 3 Normal | 57 | 80 | 125 |
| world 4 Normal | 55 | 80 | 118 |
| world 5 Normal | 45 | 67 | 108 |
| world 1 Insane | | 39 | 78 |
| world 5 Insane | | 24 | 51 |
| world 1 Hell | | 11 | 25 |
| world 5 Hell | | 7 | 19 |

- Targets of the plan: world 1 Normal is today's game (the `sim:run` output of seeds 1-20 with no gear and mid gear is byte for byte the same); world 5 Normal with mid gear 70-90 of 160: **67, just under** (42 %, the spec's "about half"); Hell world 5 with full gear under 80: 19; Insane between; no world wins more than the one before it.
- **Open for Petr:** Hell is hard even with the best gear (19 of 160, 25 in world 1); the worlds differ little in strength (x1.14 at world 5) because mid gear already loses 41 % in world 1. Plan 2 retunes world 1 with obstacles anyway.
- The world and the difficulty are part of `stateHash` (spec 4.9): two runs of one seed on different courses must not look equal to a replay or lockstep check. The determinism matrix has two new cases (`w3-insane`, `w5-hell`); its digest is now `22d17e18` (was `73372c52`).
- Unlocks (`meta/progress.ts`): world 1 Normal is open; a win of world N on a difficulty opens world N + 1 on it; a win of world 5 on Normal opens Insane, on Insane opens Hell. Only the best result per course is stored (IndexedDB key `progress`); unlocks are derived from it. `?debug=1` opens everything and stores nothing.

## Enemy factions (2026-11-20; Petr approved direction B and left the design to Claude, the numbers are Claude's)

- Spec `docs/superpowers/specs/2026-11-20-enemy-factions-design.md`, plan `docs/superpowers/plans/2026-11-20-enemy-factions.md`.
- Four factions by five phases (`rules.factions`): Human Legion 1-5 (captain, lancer), Blood Clan 6-10 (warlord, hornback), Restless Dead 11-15 (bone tyrant, rotgut), Moon Grove 16-20 (grove warden, stone warden). The elites of a phase and every rush take the elite and the heavy type of the faction of the phase they come in (rush counts unchanged: 3:00 human, 6:00 orc, 9:00 and 12:00 undead, 15:00 elf). The finale keeps the faction of phase 20. A run that starts in a later faction (`?phase`) announces it in its first step.
- Names: our own. The spec's Ghoul and Huntress were map unit names, so in English they are Ghast and Glade Stalker (Czech Ghúl and Lovkyně stay); oshm keeps no `mapName` because "Shaman" is part of our hero's name. The Czech setting "Třesení obrazu" became "Otřesy obrazu": the rawcode `esen` matched inside it in the repo guard.
- Phase mixes 6-20 keep the human weights by role (foot = shieldbearer + scout weight, shooter, heavy, caster), only the types change; the first phase of a faction has no leftovers of the one before (a clean change).
- Numbers per role follow the human type of the same role (damage a second and hp, after `design/scaling.yaml`), then tuned: hornback damage 0.7 -> 0.45 and spearthrower 0.55 -> 0.45 (with bloodlust the Blood Clan killed a Mistwarden starting at phase 6 in 19 s against 37 s on `main`), moon archer 0.32 -> 0.25 and stone warden hp 1.2 -> 1.05, damage 0.6 -> 0.5 (they took the castle in the finale: 56 000 castle damage against 47 000). The stone warden still has the most hp of the common types (662 against 656).
- Mechanics (defaults of the spec unless named):
  - bloodlust (bloodcaller): every 6 s up to 3 orcs within 450 (no boss, not itself, not lusted already, nearest first) get +20 % walking speed, damage and attack speed for 8 s (the spec's 30 % made the Blood Clan the deadliest faction by far); a stunned bloodcaller does not cast; no cast without a target. With the warlord's aura a lusted orc hits x1.5;
  - web (webcrawler): every hit on the hero slows its walking by 30 % for 2 s, renewed, not stacked; it multiplies with the boots orb; dashes keep their distance; a hit under the Spirit Ward shield does not slow;
  - roots (grove druid 400-900 every 9 s, grove warden 300-900 every 6 s): a strike from afar with `effect: root`, radius 160, 1 s warning; the hero inside cannot walk or dash for 1.2 s (36 steps, a running dash ends), nothing takes damage. Roots start also when the druid does not go for the hero (support packs never target the hero). A fresh spawn waits its whole strike cooldown;
  - poison cloud (rotgut 220, bone tyrant 350): 1 % of max hp a second, x `threat.heroDamageTaken` (2) = 2 % as the spec wants; armor does not count, the shield does; several clouds do not add up; the castle is never hurt. Its HeroHit events carry `u = 1`: no hurt sound and no shake;
  - raising (gravebinder): every 5 s up to 2 risen at the nearest of the last 64 common deaths within 500 that are younger than 10 s; never pushes another enemy out of a full store; a risen (xp 0) drops nothing at all and leaves no place, elites and bosses leave none either;
  - knockback: stone warden and the three new elites take 0.3 of it (`knockbackScale`); the captain is unchanged.
- Every aura carrier now uses its own aura (`buffed` holds the carrier's type + 1). Before, only the first aura type counted, so the Dread Regent's aura never buffed anyone; now it does in the finale.
- Models: every common type has its own model from the pinned KayKit packs. Humans moved to adventurer bodies (knights, rogues, a mage), orcs are barbarians, a hooded rogue and a mage, the undead are the skeletons, elves hooded rogues, knights and a mage. No enemy wears exactly the parts of a hero (a test). The spec expected animation tracks to be most of a model; measured, a model is ~190 kB of mesh, ~40 kB of clips and 17 kB of texture, so no clip compression: the model budget went 6 -> 10 MB (9.8 MB now). The next model needs quantized meshes or fewer triangles.
- Palettes (`client/render/enemy-tints.ts`): humans steel blue and grey, orcs dark green and olive brown (hue at least 46°, out of the orange band 20-45°), undead bone white and sickly green, elves blue violet and turquoise. A lusted enemy glows red; root circles are green, boss circles red.
- Sounds: new cues on files already encoded (`design/audio.yaml`), so a death never takes the voice of a hero's own cue: humans die with metal (cleaver-chop, castle-thud), orcs with heavy blows (stone-strike, stone-quake), undead with bones as before, elves light and airy (moon-whisper, moon-glimmer); bloodlust blood-fan, web mist-chill, roots bone-grasp (warning) and stone-tap (bound), raise bone-wail, a new faction the war horn.
- Autopilot: it leaves root circles like slams (they live in the slam fields), fights a target with a cloud from the cloud's edge (radius + 60, steps out under radius + 10) and goes for a bloodcaller or a gravebinder within `CHASE_DISTANCE` before anything else but the final boss. `sim:run` prints `factions: rooted s, cloud hp, raised` per hero.
- Balance (autopilot wins of 20; heroes in the order stonehorn, nightglaive, gravecaller, serpent-shaman, mistwarden, sparkshot, redcleaver, tidecaller):

  | | `main` | `factions` |
  |---|---|---|
  | seeds 1-20, no gear | 18 3 20 13 1 9 3 6 | 18 5 20 14 0 8 5 3 |
  | seeds 1-20, mid gear | 19 4 20 16 10 8 4 4 | 20 11 20 17 8 10 3 5 |
  | seeds 21-40, no gear | 11 6 20 12 6 6 2 2 | 16 9 20 13 5 6 5 5 |
  | seeds 21-40, mid gear | 18 5 20 18 13 4 4 5 | 19 13 20 18 6 11 4 5 |

  Seeds 1-20 without gear stay within ±3 for every hero. Off the band: Nightglaive with mid gear (+7, +8 on both seed sets), and on seeds 21-40 Stonehorn (+5), Sparkshot mid (+7) and Mistwarden mid (-7). Every run is decided in the finale (castle losses at 16-20 minutes, as on `main`); no losses gather in the 50 s after a faction arrives. The autopilot is never rooted (it leaves every circle), loses 100-2100 hp a run in clouds and sees 100-370 risen a run.
- Co-op note (Petr, 2026-11-20; not built here): there is no AI ally for the player (the ally was only meant for simulations); co-op makes the game several times harder (by the number of players); a fallen teammate is revived by standing on him for 5 s; several heroes in the simulation are built at the start of the multiplayer phase.
- Co-op level-up (Petr, 2026-11-21; not built yet): a single player keeps the level-up pause; in co-op a card choice lasts 10 s, then the autopilot does not pick, the offer stays open and the hero becomes vulnerable again (open: does he attack and cast before he picks).

## Gravecaller: smaller Bone Stampede, half the Grave Grasp heal (2026-11-19; Petr's wish, the numbers are Claude's)

- Why: Petr found the Gravecaller far too strong; its ultimate reaches much wider than any other hero's, and its heal should be halved.
- **Bone Stampede** (`design/abilities.yaml`): radius 1000, 1500 (map area) -> 700, 900 (other ultimates reach 500-1000). Bursts a second 20, 30 (map) -> 10, 11, so an enemy inside is hit about as often as before (`tps x hitRadius^2 / radius^2` = 1.5, 1.6 hits a second; with the old bursts a smaller circle would have hit everything inside three times as often). Damage, duration and burst radius (275, 350) stay. The whole spell deals about 0.5 x (level 1) and 0.35 x (level 2) of before.
- **Grave Grasp** `healPerHit` 2.5, 5, 7.5, 10, 15 -> 1.25, 2.5, 3.75, 5, 7.5.
- **Bone Stampede cooldown doubled** (Petr, after playing the change above: still too strong, it ran nearly all the time): design cooldown 120, 80 (map 60, 40), in the game 19.8, 13.2 -> 39.6, 26.4 s with 10 s of bones (it ran 50 % and 76 % of the time, now 25 % and 38 %, before Haste). Autopilot, seeds 1-20 / 21-40: 20 / 20 wins, castle of won runs 81 / 66 %, lowest hero hp avg 74 % (min 56 %).
- Autopilot, no gear, before -> after: seeds 1-20 20 -> 20 wins, castle of won runs 80 -> 73 %, lowest hero hp avg 80 -> 76 % (min 65 -> 60 %), never below 50 %; seeds 21-40 20 -> 20 (castle 67 %). Phase-20 burst 2165 -> 1745. The other heroes share no ability with it and are unchanged.
- **Open for Petr:** the autopilot still wins every run. Probes on top of this change (seeds 1-20, not committed): no heal at all 20, no Bone Stampede damage 20, Grave Grasp damage x0.5 20, Grave Grasp range 800 -> 500 20. Its strength in the simulation is the kit: three damage spells (Grave Grasp and Skull Ring every 1.98 s, Soul Bolt every 3.3 s with unlimited range) where the other heroes have one or two plus auras or on-hit. A player feels the ultimate and the heal more than the autopilot does; whether more is needed is Petr's call after he plays.

## Sustain (2026-11-19; Petr chose the direction, the numbers are Claude's)

Spec `docs/superpowers/specs/2026-11-19-sustain-design.md`, plan `docs/superpowers/plans/2026-11-19-sustain.md`. Why: after PR #18 Petr died in the 3rd minute ("it is really very hard") and asked for sustain instead of turning the spell knobs back. The spell knobs (0.5 / 0.005) and `rules.threat.heroDamageTaken 2` stay.

- **Rules** (`rules.sustain` in `design/rules.yaml`): `buffSeconds 15`; `lifesteal.capPerSecond 0.02`; `hearts { chance 0.04, healShare 0.08 }`; `orbs { maxOnMap 3, firstSeconds [8, 20, 32], respawnSeconds 30-45, minCastleDistance 300, maxCastleDistance 2000, minSpacing 500, chestSpacing 200, pickupRadius 70 }`; `boots.moveSpeed 2`, `berserk.damage 1.5`, `heal.share 1`. Petr's numbers (x2 speed, x1.5 damage, 100 % hp over 15 s, 15 s, respawn 30-45 s, a random place each time) are not tuned.
- **Lifesteal** is a share stat on items, 1 point = 0.25 %. It heals `lifesteal` x the damage dealt without overkill, for base attacks (source 0) and spells (source 1, which includes on-hit bonuses and gear effects); summons (source 2) do not heal. Cap: a budget refilled every step by `capPerSecond` x max hp x the step length and kept for at most one second; only the hp actually healed leaves the budget. It never heals a fallen hero or above max hp. The stat grows with item levels like every other row.
- **The ten lifesteal items** (one row of the same points replaced; no magic find, no effect and no sole main-attribute row touched):

| item | rarity, slot | replaced row | lifesteal at level 1 |
|---|---|---|---|
| greatblade-of-the-keep | epic mainHand | hp 48 | 1 % |
| staff-of-the-low-tide | epic mainHand | regen 0.4 | 1 % |
| masons-grip | rare hands | damage 2.5 % | 1.25 % |
| weavers-gloves | epic hands | attack speed 2 % | 1 % |
| oaken-shield | rare offHand | armor 1.75 | 1.75 % |
| moonlit-signet | rare ring | gold 5 % | 1.25 % |
| ring-of-the-keen-eye | epic ring | damage 3 % | 1.5 % |
| astrolabe-shard | epic trinket | hp 60 | 1.25 % |
| vial-of-clear-thought | rare trinket | spell power 2.5 % | 1.25 % |
| siegebreaker-vambraces | epic wrist | hp 60 | 1.25 % |

- **Hearts:** a third pickup store (64); elites and bosses always drop one, a common enemy with `chance`; it lies 24 west of the crystal (the coin lies east); the magnet pulls it; it heals `healShare` x max hp at once. A full store loses the heart.
- **Orbs:** `maxOnMap` places; place i spawns first at `firstSeconds[i]`, then 30-45 s after its pickup, each time at a random point in the band around the castle, inside the arena, `minSpacing` from the other orbs and from its own last spot, `chestSpacing` from chests (40 tries, then the last point in the band). The kind is uniform. The magnet does not pull orbs; the hero picks one up within 70. The same orb again restarts its effect at 15 s, it does not stack. Boots multiply the final move speed (`hero.speedScale`, not added to gear); berserk multiplies all damage the hero deals, summons included (Claude's reading: Serpent Shaman's orb would do little otherwise); the heal orb heals max hp / 450 a step from the current max hp, beside the lifesteal cap.
- **Random stream:** `run.sustainRng = new Rng((seed ^ 0x27d4eb2f) >>> 0)` draws the heart chance, orb places, kinds and respawns; the main `rng` and `chestRng` do not move, so enemies and chests of a seed stay the same.
- **Step order:** `updatePickups(hearts, 2)`, `updateOrbs`, `updateBuffs` after the coins and before `regenCastle` (the spec put `updateBuffs` after `updateGearEffects`; the end of the step sums the lifesteal of the whole step into one `HeroHeal` event).
- **Autopilot:** after dodging slams and charges, before a chest: the nearest boots or berserk orb within 900, a heal orb within 1500 only below 70 % hp; never in the finale.
- **Client:** orbs are drawn at radius 0.5 (about 2.8 x a crystal, not the spec's 1.5 x: at 1.5 x they were a few pixels in the 1280x720 shot), with a glyph leaning to the camera and a faint ring on the floor; colours boots #4fa8ff, berserk #e0444e, renewal #4fd18b. Heal numbers are green and summed over 0.5 s.
- **Balance** (autopilot wins of 20, seeds 1-20 / 21-40; `main` at `4b50a8c` -> this branch, defaults above):

| hero | none main | none sustain | mid main | mid sustain | full main | full sustain |
|---|---|---|---|---|---|---|
| Stonehorn | 3 / 1 | 18 / 11 | 12 / 13 | 19 / 18 | 20 / 20 | 19 / 19 |
| Nightglaive | 1 / 0 | 3 / 6 | 3 / 1 | 4 / 5 | 19 / 17 | 15 / 19 |
| Gravecaller | 20 / 20 | 20 / 20 | 20 / 20 | 20 / 20 | 20 / 20 | 20 / 20 |
| Serpent Shaman | 6 / 5 | 13 / 12 | 17 / 13 | 16 / 18 | 20 / 20 | 20 / 20 |
| Mistwarden | 0 / 0 | 1 / 6 | 2 / 1 | 10 / 13 | 17 / 15 | 16 / 13 |
| Sparkshot | 7 / 5 | 9 / 6 | 9 / 8 | 8 / 4 | 15 / 13 | 14 / 14 |
| Redcleaver | 0 / 0 | 3 / 2 | 1 / 2 | 4 / 4 | 6 / 4 | 6 / 10 |
| Tidecaller | 0 / 0 | 6 / 2 | 2 / 0 | 4 / 5 | 16 / 12 | 13 / 10 |
| all (of 320) | 68 | 138 | 124 | 172 | 254 | 248 |

  Losses by minutes, both seed sets: without gear `main` 0-2: 31, 2-4: 171, 4-6: 10, ..., 16-18: 23, 18-20: 8 -> sustain 0-2: 11, 2-4: 29, 4-6: 3, 12-16: 7, 16-18: 94, 18-20: 38 (losses before 4:00 202 -> 40); mid gear before 4:00 73 -> 4. The losses moved to the finale.
  `sustain` line of `sim:run` without gear, seeds 1-20 (per run): about 120-255 hearts, 4-6 boots, 4-5 berserk and 1-4 heal orbs; healed by lifesteal 4000-14000 (from chest items), by hearts 900-11000, by the heal orb 100-4100 hp.
- **Tuning:** the targets of spec 2 are met without gear (138 of 320, aim about 131) and with mid gear (172, most runs), and the losses before 4:00 fell by 80 %. Full gear stays at 248 (`main` 254): `capPerSecond 0.03` gave the same 248 and 170 mid, so the cap does not bind there; the full-gear losses are finale losses of Redcleaver, Tidecaller, Mistwarden and Sparkshot (their kits, out of scope). The defaults were kept.
- **Open for Petr:** full gear does not reach "almost all" (248 of 320, as on `main`); hearts heal a lot over a run (about 200 hearts at 8 %) but only 4 % of common kills drop one, so they matter most in fights; Gravecaller still wins 20 of 20; the orb size is Claude's (bigger than the spec's 1.5 x).

## Spell scaling, multishot on every arrow, chest compare (2026-11-19; Petr chose the direction, the numbers are Claude's)

Spec: `docs/superpowers/specs/2026-11-19-spell-scaling-chest-compare-design.md`. Plan: `docs/superpowers/plans/2026-11-19-spell-scaling-chest-compare.md`. Petr (playtest of PR #15 and #16): spells scale far too strong, globally; every multishot arrow should get the Searing Rounds bonus; a chest swap should show both items and let him keep or take. He chose direction A: tame the spell curves and Int's spell power, enemies unchanged.

- **Spell growth.** `design/scaling.yaml` `abilities.levelGrowthExponent: 0.5`. After the `abilities.damage` multiplier `data:build` (`tools/data-build/scaling.ts`) rewrites every `damage`, `tickDamage`, `amount` and `bonusDamage` row as `value[L] = value[1] x (value[L] / value[1]) ^ e` on the rounded row. Level 1 never changes; a row with 0 at level 1, a 0 at level L or a single level stays as it is; design values and ultimates go through it too. The sim gets the finished numbers (no `pow` in `sim/`). `parseScaling` requires the key, `0 < e <= 1`.
- **Spell power from Int.** `rules.hero.spellPowerPerInt` 0.01 -> 0.005. Gear and Arcane Focus unchanged. Note: this weakens spells from the first minute too (Int at level 1 is 20-40, so about -10 to -15 %), the spell values at level 1 do not change.
- **Spells, level 1 -> top level** (map values x 0.3, before -> after):

| spell | before | after |
|---|---|---|
| Forked Bolt (Serpent Shaman) | 90 -> 1500 (x16.7) | 90 -> 367 (x4.1) |
| Mending Tide (Serpent Shaman, heal) | 150 -> 3000 (x20) | 150 -> 671 (x4.5) |
| Rock Rupture (Stonehorn) | 150 -> 1500 (x10) | 150 -> 474 (x3.2) |
| Cleaver Toss (Redcleaver) | 61 -> 1475 (x24) | 61 -> 300 (x4.9) |
| Stunning Tide (Tidecaller) | 30 -> 1500 (x50) | 30 -> 212 (x7.1) |
| Searing Rounds bonus (Sparkshot) | 300 -> 1500 (x5) | 300 -> 671 (x2.2) |
| Meteor (shared) | 300 -> 1950 (x6.5) | 300 -> 765 (x2.5) |
| Groundbreaker (ultimate, 2 levels) | 1200 -> 2400 | 1200 -> 1697 |

- **Burst measurement.** `sim:run` prints a `burst` line per hero: at the start of phases 5, 10, 15 and 20 one cast of the strongest learned signature spell (first of `damage`, `bonusDamage`, `tickDamage` at the slot's level x spell power; heals not counted; armor ignored) and the average base attack hit, as the median over the runs that reached the phase, and their ratio to the hp of a Shieldbearer (`sb`) and a Lancer (`ln`) at that phase (`hp x timeScale`). Target of spec 4.3 at phase 20 without gear: `ln` under 1 (a Lancer does not fall to one cast), `sb` at least 0.33. Seeds 1-20, no gear, phase 20 (before = this branch's code with exponent 1 and 0.01):

| hero | spell before (sb / ln) | spell after (sb / ln) | attack after (ln) |
|---|---|---|---|
| Stonehorn | 5214 (19.8 / 4.53) | 1032 (3.92 / 0.90) | 329 (0.29) |
| Nightglaive | 7833 (29.7 / 6.81) | 1342 (5.10 / 1.17) | 406 (0.35) |
| Gravecaller | 14380 (54.6 / 12.5) | 2248 (8.54 / 1.95) | 335 (0.29) |
| Serpent Shaman | 7118 (27.0 / 6.19) | 1073 (4.07 / 0.93) | 313 (0.27) |
| Mistwarden | 2063 (7.83 / 1.79) | no run reached phase 20 | - |
| Sparkshot | 5804 (22.0 / 5.05) | 1823 (6.92 / 1.58) | 370 (0.32) |
| Redcleaver | 5778 (21.9 / 5.02) | 943 (3.58 / 0.82) | 336 (0.29) |
| Tidecaller | 6949 (26.4 / 6.04) | 904 (3.43 / 0.79) | 318 (0.28) |

  The base attack (spec 2: measured, not tuned) grows from about 75 at phase 5 to 310-410 at phase 20, a Lancer ratio of 0.10 -> 0.27-0.35, the same before and after.
- **Multishot.** Every split shot of Searing Rounds gets the `bonus` the main shot got from `onHitBonus` (no new chance roll, no second `Cast` event): `(roll + bonus) x (1 - armor)`. Empower and gear effects on attack (chain, splash) stay with the main shot. Split shots stay `extraTargets` 1, 1, 2, 2, 3 (supersedes the "split shots without the burn" rule of Sparkshot multishot below). `onHitBonus` does not multiply by spell power (it never did); the spec's "including spell power" is read as "like the main shot".
- **Chest Choice.** `ChestAction` is `New`, `Choice`, `Level` (Replace is gone). A worn slot whose rolled item differs from the worn one (any rarity) gets a `Choice` card with the rolled item; the same item is a `Level` card; an empty slot `New`. The roll and its randomness are unchanged. Keep or take travels in the step input: `InputAction.KeepWorn` (8) with `input.card`; without the bit a Choice is taken. Take = the old replace (the slot's whole level + 1 as chest levels, `base` 0, the loadout given to the run untouched); keep = a chest level for the worn item. `ChestPick` reports `New`, `Choice` (taken) or `Level` (also a kept Choice); the news line for a legendary or mythic names `New` and a taken `Choice`. Supersedes "a higher rarity replaces the worn item" of Chest loot below: a lower or equal rarity is now offered too and may be taken.
- **Autopilot at a chest.** Index: a `Choice` whose item has a higher rarity than the worn item (the highest first), else `New` (the highest rarity), else the offered slot with the lowest level. It keeps the worn item of a `Choice` unless the rolled item has a higher rarity. Picks and outcomes are the same as before, so `npm run sim:chests -- --seeds 1-50` prints the same lines as before the change (the rarity column counts the item left in the slot).
- **Compare panel (client).** A click or key on a `Choice` card opens `#chest-compare` inside the cards: keep (worn item, level +1) and take (new item, "level N for this run") side by side; stat rows lined up by stat (worn item's stats first, then the new item's own ones, marked "new"); green with ▲ for the better side, red with ▼ for the worse; an effect under its column; keys 1 keep, 2 take, Escape back to the three cards (the chest stays open, the run stays paused). One key listener in `Cards` decides where a key goes. Both columns share one CSS subgrid, so a long name on one side keeps the rows level. Navy and blue-grey, no orange.
- **Tuning (spec 4.3).** Knobs: `levelGrowthExponent` 0.4-0.7, `spellPowerPerInt` 0.003-0.01. The defaults 0.5 / 0.005 stay. Autopilot wins of 20 (seeds 1-20 / 21-40; `main` at `325af0f` -> this branch):

| hero | none before | none after | mid before | mid after | full before | full after |
|---|---|---|---|---|---|---|
| Stonehorn | 6 / 6 | 3 / 1 | 19 / 20 | 12 / 13 | 20 / 20 | 20 / 20 |
| Nightglaive | 4 / 3 | 1 / 0 | 6 / 7 | 3 / 1 | 20 / 20 | 19 / 17 |
| Gravecaller | 20 / 20 | 20 / 20 | 20 / 20 | 20 / 20 | 20 / 20 | 20 / 20 |
| Serpent Shaman | 15 / 16 | 6 / 5 | 18 / 19 | 17 / 13 | 20 / 20 | 20 / 20 |
| Mistwarden | 4 / 2 | 0 / 0 | 14 / 15 | 2 / 1 | 20 / 20 | 17 / 15 |
| Sparkshot | 4 / 7 | 7 / 5 | 18 / 17 | 9 / 8 | 20 / 20 | 15 / 13 |
| Redcleaver | 8 / 7 | 0 / 0 | 18 / 17 | 1 / 2 | 20 / 20 | 6 / 4 |
| Tidecaller | 3 / 6 | 0 / 0 | 14 / 13 | 2 / 0 | 20 / 20 | 16 / 12 |
| all (of 320) | 131 | 68 | 255 | 124 | 320 | 254 |

  Sweep without gear on seeds 1-20 (wins of 20 per hero in the order above; total of 160):

| exponent / per Int | wins | total | mid (of 160) | full (of 160) | burst p20 ln |
|---|---|---|---|---|---|
| 0.5 / 0.005 (kept) | 3 1 20 6 0 7 0 0 | 37 | 66 | 133 | 0.79-1.95 |
| 0.5 / 0.01 | 5 2 20 10 1 4 0 0 | 42 | 82 | 149 | 0.55-2.94 |
| 0.6 / 0.0075 | 4 3 20 13 0 8 0 0 | 48 | 82 | 148 | - |
| 0.6 / 0.01 | 5 1 20 13 1 8 2 1 | 51 | - | - | 0.55-3.51 |
| 0.7 / 0.01 | 5 2 20 14 3 7 3 2 | 56 | 117 | 157 | 0.91-5.27 |
| 1 / 0.01 (old curves, this branch) | 6 4 20 15 4 13 8 3 | 73 | - | - | 1.79-12.5 |

  No setting puts more than two heroes into 6-12 and Gravecaller wins 20 in every one. Losses fall at 2-4 minutes in every setting (also on `main`), under the doubled enemy damage of 2026-11-18 and before spell growth matters. The gear targets (mid: most runs, full: all) and the burst target pull in opposite directions: 0.7 / 0.01 nearly meets the gear targets and puts a phase-20 cast at 2-5 Lancers again. The defaults were kept because the burst target is Petr's complaint itself.
- **Open for Petr (the main decision of this plan):** tamed spells cost many wins: without gear 131 -> 68 of 320, mid gear 255 -> 124, full gear 320 -> 254 (Redcleaver 6 and 4 of 20 with the best gear). Choose: keep 0.5 / 0.005 (spells tamed, the game much harder), or go up to 0.7 / 0.01 (gear wins return, a late cast kills 2-5 Lancers again), or keep the curves and soften the early threat (the deaths at 2-4 minutes come from the doubled enemy damage, not from spells). Both knobs are one number in `design/scaling.yaml` and `design/rules.yaml`.
- **Open for Petr:** Gravecaller wins 20 of 20 in every setting (its spells still kill a Lancer twice over at phase 20); Mistwarden, Redcleaver and Tidecaller win none without gear; this needs their kits (out of scope here). The base attack grows about x4.5 over a run (from the primary attribute), measured, not tuned. `onHitBonus` (Searing Rounds and other on-hit bonuses) does not use spell power.

## Shared spells and passives (2026-11-18; Petr left the approval to Claude, the choices and numbers are Claude's)

Spec: `docs/superpowers/specs/2026-11-18-shared-spells-passives-design.md`. Plan: `docs/superpowers/plans/2026-11-18-shared-spells-passives.md`.

- **Slots.** 10 slots: 0-2 signature, 3 ultimate, 4-5 shared spells, 6-9 passives (`rules.progression.sharedSpellSlots` 2, `passiveSlots` 4). Shared slots start empty; a spell or passive can be in a hero's kit only once. One pool for every hero (no filter by hero).
- **New kinds.** `chain` (nearest target, then `bounces` leaps to the nearest enemy not struck yet within `bounceRange`; at most 8 leaps), `instant` with the new targeting `strongest` (a boss or an elite in range first, then the most hp; tie: lower slot), `passive` (no cast; params `attackBonus`, `spellPowerBonus`, `cooldownBonus`, `hpBonus`, `regenBonus`, `moveSpeedBonus`, `attackSpeedBonus`, `goldBonus`, `magnetBonus`). Passives add where gear adds: attack damage to the damage multiplier, spell power to the gear's spell power (it multiplies the power from INT), cooldown speed next to INT (`1 / (1 + INT x 0.01 + cooldownBonus)`), max hp multiplies the hp sum, attack speed under the existing cap, gold next to gold find, magnet next to the gear magnet.
- **Shared spells (map source, our names; damage, tick and heal values are map units x 0.3, cooldowns x 0.33 like every ability).** Sources are hero spells of the map none of our heroes uses; where the map's number would beat a signature spell or is missing, the value is a design value:

| id | kind, targeting | source | from the map | design |
|---|---|---|---|---|
| arc-lightning | chain, nearest | A069 (Chain Lightning) | cooldown 12 | damage 300-2000, range 900, bounces 2-6, bounceRange 500 |
| smite | instant, strongest | A03U (Storm Blast) | cooldown 8 | damage 500-4000, range 1000 |
| fire-bolt | projectile, nearest_elite_first | A0B0 (Shadow Strike) | cooldown 8 | damage 300-3000, range 1500, speed 1300 |
| frost-ring | nova, around_self | A00P (Thunder Clap) | cooldown 8, slowSeconds 2 | damage 300-2400, radius 400-600, slow 0.3-0.5 |
| meteor | area, densest_cluster | A00W (Rock Down) | damage 1000-6500, range 1000, cooldown 15 | radius 300-400 |
| holy-ground | ticking_area, around_self | A011 (Immolation) | radius 300 | tick 100-450, 2 per s, hit radius 200, 4 s, cooldown 12 |
| blade-fan | cone, nearest | A0AD (Breath of Fire) | damage 400-2000, length 800, endWidth 500-700, cooldown 10 | maxTargets 8-16 |
| shock-wave | line, move_direction | A09Z (Carrion Swarm) | length 1000, cooldown 8 | damage 300-2000, width 300, waveSpeed 1600 |
| sentry-ward | summon, densest_cluster | AUcb (Carrion Beetles) | cooldown 10 | 1-2 wards, at most 1-3 alive, damage 40-80, 0.5 s, 30 s |
| second-wind | heal, self | A017 (Healing Wave) | cooldown 15 | heal 600-3000 |

  Blade Fan and Sentry Ward use the targeting their updaters read (`cone` aims at the nearest enemy, `summon` wards go to the densest cluster), not the spec's `move_direction` and `around_self`. At level 5 a shared spell is about a signature spell of its kind at level 3-4.
- **Passives (design only, level 1 -> 5):** Might attack damage +8 -> +40 %; Arcane Focus spell power +8 -> +40 %; Haste cooldown speed +5 -> +25 %; Vigor max hp +8 -> +40 % and regen +1 -> +5 /s; Fleet Foot move speed +4 -> +20 % and attack speed +6 -> +30 %; Fortune gold +8 -> +40 % and pickup range +40 -> +200. The spec's values; no change in the tuning.
- **Cards.** Each card of an offer draws a group by `rules.progression.cardWeights` (signature 4, shared upgrade 3, new spell 2, new passive 2; only groups with cards left), then a card of the group uniformly; the card leaves the group. Attribute cards (STR, AGI, INT without repeats) fill the offer only when all groups are empty. Signature 6 was tried: no hero gained, Tidecaller and Stonehorn lost wins.
- **Autopilot.** Ultimate, signature (upgrade or learn), new shared spell, shared upgrade, new passive, passive upgrade, attribute; the earlier card on a tie. The idle player of the balance tests and `sim:run --idle` takes an attribute, else the card the autopilot wants least (attribute cards are rare now).
- **Balance.** Autopilot wins of 20 without gear, `main` at `dd88ff5` -> this branch (seeds 1-20 / 21-40; 1-100 in wins of 100 for a steadier picture):

| hero | 1-20 | 21-40 | 1-100 |
|---|---|---|---|
| stonehorn | 3 → 6 | 3 → 6 | 10 → 38 |
| nightglaive | 0 → 4 | 0 → 3 | 1 → 11 |
| gravecaller | 20 → 20 | 20 → 20 | 100 → 100 |
| serpent-shaman | 9 → 15 | 10 → 16 | 63 → 69 |
| mistwarden | 0 → 4 | 2 → 2 | 5 → 17 |
| sparkshot | 1 → 4 | 5 → 7 | 16 → 26 |
| redcleaver | 8 → 8 | 12 → 7 | 45 → 35 |
| tidecaller | 0 → 3 | 1 → 6 | 5 → 21 |

  With a rare item per slot (`--gear mid`), 1-20 / 21-40: Stonehorn 19/17 -> 19/20, Nightglaive 5/8 -> 6/7, Gravecaller 20/20, Serpent Shaman 17/20 -> 18/19, Mistwarden 12/14 -> 14/15, Sparkshot 20/20 -> 18/17, Redcleaver 17/18 -> 18/17, Tidecaller 18/13 -> 14/13 (all heroes 258 -> 255 wins). Full gear wins all 320 before and after. `sim:chests` does not change (it plays no cards).
- **Seismic Echo** reacts to every cast, shared spells included (the plan's risk). Stonehorn rises from 3 to 6 of 20 and stays in the band, so the echo is not limited to slots 0-3.
- **Full kit.** All 10 slots at their top level: median phase 19-20 of 20 in the runs that get there (the won ones); the target was phase 16 or later.
- **Tuning tried and dropped:** Arcane Focus at +5 -> +25 % (Serpent Shaman 15/17, nothing else moved); shared spell damage +30 % (wins within noise, Nightglaive and Mistwarden still die at 2-4 minutes). The spec's numbers stay.
- **Open for Petr.** Serpent Shaman leaves the band upwards on seeds 1-20 (9 -> 15), but over 100 seeds it moves only 63 -> 69 %: on `main` it already won about 13 of 20, the 9 of seeds 1-20 was early-death luck. Nightglaive, Mistwarden, Sparkshot and Tidecaller come closer to the band but stay under 6 on at least one set; Nightglaive and Mistwarden die between 2 and 4 minutes under the doubled enemy damage, before shared spells matter. Closing that needs their kits (spec: not this plan's task). Redcleaver stays in the band but loses wins over 100 seeds (45 -> 35): attribute cards (its STR) come only when the kit is full. Gravecaller still wins everything.

## Audio and music (2026-11-19/20; Petr chose fantasy sound, a theme per hero, recorded CC0 files and the music picks; the cue mapping and levels are Claude's)

- Every sound is a named cue in `design/audio.yaml`; recorded variants come first, the synth tone stays as the fallback. Families per hero (spec 5.1): Stonehorn stone and earth impacts, Nightglaive bows and ice shimmer, Gravecaller bones and roots, Serpent Shaman lightning, Mistwarden ice and wind, Sparkshot black-powder rifles and fire, Redcleaver axe and blade swings, Tidecaller waves and splashes; shared spells by their element.
- Sources (all CC0 1.0, rows in `assets/LICENSES.md`): 150 Combat Sound Effects (untamedpixels; it already holds lentikula's spell impacts, so the itch.io pack was not needed), Kenney RPG, Impact and Interface sounds, Medieval weapon textures and impacts and The Free Firearm Sound Library (Ben Jaszczak and Brian Nelson), Swishes (artisticdude), Bones rattle (congusbongus), Bones 2, Water Waves (transitking), 6 short water splashes (qubodup), War Horns (Eldritch Grim), Their Coming (StumpyStrust), Heartbeat (bart). No CC-BY file is used, so the credits need no attribution line.
- Not downloaded from the list: the Magic Sounds collection items (several are CC-BY) and the itch.io spell pack; the 150 pack covers those families.
- 161 effects, 1.6 MB; base attacks and pickups 0.1-0.6 s, spells cut to 0.8-1.8 s with a 0.12 s fade at the cut (`encodeArgs`), horns 2.3-5 s.
- Music (Petr, 2026-11-20: menu A, both boss slots B; the rest from what he downloaded): menu Fantasy Orchestral Theme (Joth), run Determined Pursuit loop (Emma_MA, the only run track: it loops), miniboss Boss Fight (Lisboa), final boss Epic Endgame Cinematic (cynicmusic, file "Heavy Concept A Bass Master"), victory Transformansion ending (Emma_MA), defeat Game Over sound (OpenGameArt node 54772). 5.8 MB.
- Levels: effects normalized to -16 LUFS, music to -18 LUFS; deaths and enemy hits at most 6 voices, hero and warnings priority 3, pickups priority 0; music ducks to 0.35 with a 900 Hz low-pass while the game stands, to 0.5 for 2.5 s after a horn.
- After Petr's first listen (2026-11-20: music too loud, too many sounds, sword clanging, drop the gold and XP pickup sounds): XP and gold pickups are silent (`pickup.xp`, `pickup.coin`: none; a game sound may be `none` now); the default music volume 0.6 -> 0.3; hero base attacks -4 -> -10 dB; every cue plays at most once at a time (Petr: one voice for all sounds, `maxVoices` default 1); the sword-on-sword take of the Redcleaver attack is gone; enemy deaths 0 -> -6 dB; the hero hit -6 -> -9 dB. A volume a player already saved in Settings stays.
- **Spell sounds review** (Petr, 2026-11-20: Falling Stars sounds like wood, every spell should sound like its name): 21 cues are now layered takes (`mix()` in `tools/audio-build/manifest.ts`: several sources with a start time, rate, tempo, reverse, filters and gain, mixed, with a `hall` reverb or an `echo`, cut to a length). The 150 pack has no celestial or ghostly sounds, so they are built from bells, glass chimes, swishes and pitched-down healing shimmers. Falling Stars: three stars, each a high swish, a Kenney bell at 2-3x and a glass chime, over a soft shimmer (the old Ice Spell Impact was a broadband crackle, spectral flatness 0.61 -> 0.34). Also changed: Shadow Sisters, Soul Bolt (no slime), Grave Grasp, Bone Stampede, Serpent Totem (hiss), Mending Tide (water), Spirit Ward (choir and bell, no lightning), the Mistwarden attack (gust and tinkle, no ice crackle), Soul Burst, Wailing Wave, Seismic Echo (a real echo), Rocket Fan (launch hiss), Beam Swarm (hum), Crushing Wave, Drowned Lake (deep and bubbling), Smite (bell), Holy Ground (bell), Meteor (fiery rush before the blast), Frost Ring (glassy ring), Second Wind (a breath). The other spells kept their sounds. `npm run audio:encode -- --only id,id` encodes only those cues.
- After Petr's listen (2026-11-20): Falling Stars and Mending Tide swap sounds (`design/audio.yaml`: falling-stars plays `storm-mend`, mending-tide plays `moon-starfall`); Bone Stampede made much darker (bones pitched down, deep hoofbeats at 0.6x, a low wind drone and a moan at 0.4x, hall; spectral centroid about 1600 -> 480 Hz).
- `npm run audio:build` is its own script, not part of `data:build` (that needs the map and cannot run in CI).

## Chest loot, Magic Find and enemy threat (2026-11-18; Petr chose the direction, the numbers are Claude's)

Spec: `docs/superpowers/specs/2026-11-18-chest-loot-threat-design.md`. Plan: `docs/superpowers/plans/2026-11-18-chest-loot-threat.md`.

- **Threat.** Every enemy hit on the hero goes through `damageHero` (`sim/combat.ts`) and is multiplied there by `rules.threat.heroDamageTaken` (2) and the hero's `damageTaken` (`design/heroes.yaml`: 0.75 for Stonehorn and Redcleaver, missing = 1). Melee heroes take x1.5, the others x2. The castle takes damage as before; the shield still blocks everything.
- **Magic Find.** A new item stat `magicFind` (a share; 1 budget point = 2 %). The hero sums it over the worn items, chest items included. Effective MF = MF x 1.5 / (MF + 1.5) (50 % -> 37.5 %, 100 % -> 60 %, 300 % -> 100 %; only a division, `sim/magic-find.ts`). Every rarity above the lowest one of a weight table gets its weight x (1 + effective MF x factor), factor 1 rare, 1.5 epic, 2 legendary, 2.5 mythic; the lowest keeps its weight. Used by chest cards and by boss drops (`rollDrop` gets the hero's MF when the boss falls; MF 0 draws exactly as before).
- **Ten items carry Magic Find** in place of a gold find or pickup range row of the same points: tin-ring 12 %, band-of-resolve 10 %, falcon-charm 10 %, hunters-whistle 12 %, pendant-of-the-deep-well 10 %, ring-of-the-keen-eye 12 %, seal-of-the-archivist 12 %, belt-of-many-knives 10 %, compass-of-the-lost-scout 12 %, hourglass-of-the-hunt 10 %. The best epic-or-better MF build (neck, both rings, waist, both trinkets) has 66 % at level 1 and 106 % at level 5 (effective 62 %). Gold find stays on moonlit-signet and seal-of-the-royal-treasury.
- **Chest cards.** A chest offers 3 cards. Each rolls a rarity by `rules.chests.rarityWeights` raised by the hero's MF, then a slot not yet in the offer whose type has an item of that rarity (one rarity lower when none is free; legendary and mythic exist only for main hand, off hand and trinkets), then an item of that rarity and type, preferring one the twin slot (ring, trinket) does not wear. The pick: an empty slot takes the item at chest level 1 (**New**); a higher rarity than the worn item replaces it for the run and takes the slot's whole level + 1 as chest levels (**Replace**; the loadout given to the run is not touched, so a permanent item comes back after the run); else the worn item gains a chest level (**Level**). (Superseded 2026-11-19: a worn slot now gets a **Choice** card, keep or take, see Spell scaling above.) Effects of a legendary or mythic chest item work at once; picking one puts "Chest: <name>" on the news line in its rarity colour.
- **Chest levels.** An item's numbers with permanent level B and chest levels T are its level-1 numbers x (1 + 0.15 x max(B - 1, 0) + chestLevelStep x T) with `rules.gear.chestLevelStep` = 0.25; an item a chest gave has B = 0, so its first chest level counts too. This replaces "level L = B + T, x (1 + 0.15 x (L - 1))" of the gear section below for chest levels; permanent numbers are unchanged. Why: with the plan's weights (common 55, rare 30, epic 12, legendary 2.5, mythic 0.5) 15 chests gave x1.25, and at the plan's weight limits (common at least 25, legendary at most 6, mythic at most 2) at most x1.38. The plan's fallback formula left a chest item's first level out; 12 of 15 picks are new items, so it needed a step of about 1.25 (one chest level = +125 %, far above a permanent level). Counting every chest level reaches the band at 0.25.
- **Weights.** `rules.chests.rarityWeights`: common 25, rare 30, epic 37, legendary 6, mythic 2 (the plan's limits for common, legendary and mythic; the smallest chestLevelStep in the band).
- **Chest price halved** (Petr, 2026-11-18, before the merge): `rules.chests.basePrice` 200 -> 100, growth stays x1.12 (100, 112, 125, ...). Autopilot wins without gear, seeds 1-20 / 21-40, price 200 -> 100: Stonehorn 1 -> 3 / 1 -> 3, Nightglaive 0 -> 0 / 0 -> 0, Gravecaller 20 / 20, Serpent Shaman 7 -> 9 / 11 -> 10, Mistwarden 0 -> 0 / 0 -> 2, Sparkshot 0 -> 1 / 0 -> 5, Redcleaver 5 -> 8 / 5 -> 12, Tidecaller 0 -> 0 / 0 -> 1; over all 320 runs 70 -> 94 wins and 1310 -> 2448 chests opened. The table below is at the price of 200.
- **Autopilot.** A replacement with the highest rarity first, then a new item with the highest rarity, then a level for the offered slot with the lowest level; the first card on a tie.
- **Measure:** `npm run sim:chests -- --seeds 1-200` (a hero at level 25 from XP alone, no cards, 15 offers picked by the autopilot):

```
stonehorn: hp x1.39, attack x1.47, spells x1.48, mean x1.45 | picks new 11.8, replace 2.2, level 1.0 | rarities common 0.9, rare 2.8, epic 8.5, legendary 2.0, mythic 0.9
nightglaive: hp x1.50, attack x1.47, spells x1.48, mean x1.48 | picks new 11.8, replace 2.2, level 1.0 | rarities common 0.9, rare 2.8, epic 8.5, legendary 2.0, mythic 0.9
gravecaller: hp x1.50, attack x1.49, spells x1.41, mean x1.47 | picks new 11.8, replace 2.2, level 1.0 | rarities common 0.9, rare 2.8, epic 8.5, legendary 2.0, mythic 0.9
serpent-shaman: hp x1.46, attack x1.51, spells x1.43, mean x1.47 | picks new 11.8, replace 2.2, level 1.0 | rarities common 0.9, rare 2.8, epic 8.5, legendary 2.0, mythic 0.9
mistwarden: hp x1.48, attack x1.51, spells x1.43, mean x1.47 | picks new 11.8, replace 2.2, level 1.0 | rarities common 0.9, rare 2.8, epic 8.5, legendary 2.0, mythic 0.9
sparkshot: hp x1.41, attack x1.45, spells x1.48, mean x1.45 | picks new 11.8, replace 2.2, level 1.0 | rarities common 0.9, rare 2.8, epic 8.5, legendary 2.0, mythic 0.9
redcleaver: hp x1.35, attack x1.45, spells x1.48, mean x1.43 | picks new 11.8, replace 2.2, level 1.0 | rarities common 0.9, rare 2.8, epic 8.5, legendary 2.0, mythic 0.9
tidecaller: hp x1.42, attack x1.50, spells x1.43, mean x1.45 | picks new 11.8, replace 2.2, level 1.0 | rarities common 0.9, rare 2.8, epic 8.5, legendary 2.0, mythic 0.9
all: hp x1.44, attack x1.48, spells x1.45, mean x1.46 | picks new 11.8, replace 2.2, level 1.0 | rarities common 0.9, rare 2.8, epic 8.5, legendary 2.0, mythic 0.9
```

Autopilot wins of 20, before (`main` at `cd54f2e`) -> after:

| hero | none 1-20 | none 21-40 | mid 1-20 | mid 21-40 | full 1-20 | full 21-40 |
|---|---|---|---|---|---|---|
| stonehorn | 8 → 1 | 6 → 1 | 19 → 13 | 20 → 16 | 20 → 20 | 20 → 20 |
| nightglaive | 2 → 0 | 9 → 0 | 18 → 4 | 17 → 4 | 20 → 20 | 20 → 20 |
| gravecaller | 20 → 20 | 20 → 20 | 20 → 20 | 20 → 20 | 20 → 20 | 20 → 20 |
| serpent-shaman | 17 → 7 | 18 → 11 | 19 → 16 | 19 → 20 | 20 → 20 | 20 → 20 |
| mistwarden | 4 → 0 | 7 → 0 | 16 → 10 | 14 → 13 | 20 → 20 | 20 → 20 |
| sparkshot | 10 → 0 | 13 → 0 | 10 → 19 | 18 → 18 | 20 → 20 | 20 → 20 |
| redcleaver | 12 → 5 | 9 → 5 | 20 → 17 | 17 → 15 | 20 → 20 | 20 → 20 |
| tidecaller | 7 → 0 | 5 → 0 | 17 → 12 | 18 → 11 | 20 → 20 | 20 → 20 |

- **Losses** (8 heroes x 40 runs = 320 per loadout). Without gear: before 167 wins, 99 hero deaths, 54 castle losses; after 70 wins, 249 hero deaths, 1 castle loss. Mid gear: before 282, 7, 31; after 228, 91, 1. Full gear: 320 wins before and after. The castle does not fall more often (it falls less: the hero dies first). Median time of a hero death without gear after the change: 1:50 (Serpent Shaman) to 4:16 (Sparkshot), most before the first miniboss (4:10) and before most chests (the first costs 200 gold).
- **Open for Petr.** Five heroes win 0 or 1 of 20 on both seed sets without gear: Stonehorn (1, 1), Nightglaive (0, 0), Mistwarden (0, 0), Sparkshot (0, 0), Tidecaller (0, 0). Not tuned here (spec 5.2); the shared-spells plan tunes kits to its band of 6-12 against this state. The autopilot does not kite, so x2 hits it harder than a player. Gravecaller still wins 20 of 20.

## Sparkshot multishot (2026-11-18; Petr asked for multishot on Searing Rounds, the numbers are Claude's)

- **Rule.** An `on_hit` spell may carry `extraTargets` (per level). The hero's base attack then also shoots that many other enemies in attack reach, nearest first (equal distance: lower slot; at most 8, `sim/hero-multishot.ts`). A split shot rolls its own base damage against its target's armor and carries the main shot's stun; the on_hit bonus damage, an empowered hit and the gear effects (splash, chain) stay with the main shot. The client draws every shot as a bolt (one `Hit` event of source 0 each).
- **Searing Rounds:** 1, 1, 2, 2, 3 extra targets.
- **Why the burn stays on the main shot** (superseded 2026-11-19: every split shot carries the burn, see Spell scaling above). Autopilot wins of 20 (seeds 1-20, before 0): split shots with the full burn and 1, 1, 2, 2, 3 targets 17 (21-40: 16); with the full burn and 1 target on every level 12; with half the burn and 1, 1, 2, 2, 3 targets 16; without the burn and 1, 1, 2, 2, 3 targets **10 (21-40: 13)**, chosen: it reads as a real multishot (four shots at level 5) and lands in the band of the other heroes. The hero drops below 50 % hp in 19 of 20 runs (5 with the full burn), so the Sparkshot is now a hero who wins by killing fast and has to watch its health.
- The other heroes are unchanged: none of their spells has `extraTargets`, so their runs draw the same random numbers as before.

## Gear, drops and chests (2026-11-13; Petr chose the design, the numbers and the catalogue are Claude's)

Spec: `docs/superpowers/specs/2026-11-13-items-gear-chests-design.md` (its section 12 lists what the build made precise). Plan: `docs/superpowers/plans/2026-11-13-items-gear-chests.md`.

- **Item numbers.** One budget point buys 0.5 attribute, 0.5 % of attack damage, attack speed or spell power, 12 hp, 0.25 armor, 0.1 regen, 1 % move speed or gold, or 10 pickup range. Budgets at level 1: common 6, rare 12, epic 20, legendary 30, mythic 42 (`data/generated.test.ts` checks every item within 10 %). The plan's first table gave 1 attribute and 1 % per point; with it the best gear at the top level multiplied attack by 3.2 to 3.7 and spells by 2.7 to 4 on a level-25 hero, against the spec's "about 2x". Halving attributes and the three offensive shares gives, on a level-25 hero: best gear hp x1.5 to 1.9, attack x1.9 to 2.1, spells x1.7 to 2.3; a rare item in every slot hp x1.15 to 1.2, attack x1.25 to 1.3.
- **Levels.** An item's numbers at level L are the level-1 numbers x (1 + 0.15 x (L - 1)); a duplicate from a boss raises the permanent level to at most 5; chest levels have no cap. Special effects do not grow with the level.
- **Chests.** 3 on the map, 700 to 2000 from the castle, 600 apart, pick 1 of 3 slots. The n-th chest costs 200 x 1.12^(n - 1) gold (first tries: 40 x 1.18, 150 x 1.13). Gold per type: shieldbearer and scout 1, musketeer and chaplain 2, lancer 3, captain 10, minibosses 100, 150 and 200. A won run brings about 9000 gold, so the autopilot opens 12 to 16 chests in a run it wins.
- **Chest places and offers use their own generator** (`run.chestRng`), so the enemies of a seed are what they were before this plan and the old balance numbers stay comparable.
- **Autopilot.** It walks to the nearest chest when it has the gold, the hero has at least 30 % hp, the castle at least 50 % and the final boss is not alive; it picks the offered slot with the lowest level. The plan said 60 % hero hp: the autopilot fights below that almost the whole run and then opened 2 to 4 chests in a won run.
- **Drops.** Tables per boss give rarity weights (`rules.drops`); the item is drawn from the rarity: first one the player does not own, then one more level of an owned one, then the boss's other rarities from the highest down, then nothing. The draw depends only on the run's seed, the order of the boss's death in the run and the collection.
- **Effects.** Six kinds on eight items (`sim/gear-effects.ts`): chain lightning on every n-th attack, splash on attack, a shield under low hp, faster cooldowns after an elite or a boss falls, a slowing aura, gold that heals the castle (2 hp per gold: about 18 000 hp in a won run, a third of the castle). Two worn items with the same kind do not stack; the later slot counts.
- **Saved data.** IndexedDB `defense-webgame`, store `save`, key `gear`: `{ version: 1, items: { itemId: level }, loadouts: { heroId: { slot: itemId } } }`. Data that does not fit the game is left out when it is read, never an error. A session with `?debug=1` starts from an empty collection and stores nothing.
- **Look.** Own SVG glyphs per slot type (no icon set, no licence), procedural chest and coin, one blue-grey figure on the doll for every hero (stonehorn's hero colour is orange), rarity colours white, blue, purple, pale gold, crimson.

Autopilot wins of 20, without gear. "Before" is the branch `elite-boss-threat` (the same as chests nobody can pay for):

| Hero | before, seeds 1-20 | with chests, 1-20 | before, 21-40 | with chests, 21-40 | chests in a won run |
|---|---|---|---|---|---|
| Stonehorn | 8 | 8 | 6 | 6 | 13 |
| Nightglaive | 8 | 2 | 4 | 9 | 13 to 15 |
| Gravecaller | 20 | 20 | 20 | 20 | 16 |
| Serpent Shaman | 17 | 17 | 18 | 18 | 16 |
| Mistwarden | 4 | 4 | 6 | 7 | 16 |
| Sparkshot | 0 | 0 | 0 | 0 | - |
| Redcleaver | 14 | 12 | 11 | 9 | 16 |
| Tidecaller | 2 | 7 | 3 | 5 | 12 |

With gear, seeds 1-20: a rare item of level 1 in every slot (`--gear mid`) wins 19, 18, 20, 19, 16, 2, 20, 17; the best gear at level 5 (`--gear full`) wins 20 of 20 with every hero, also on seeds 21-40.

Open after the tuning:
- The plan's bar was "within 3 wins of before" per hero. Nightglaive (-6 on seeds 1-20, +5 on 21-40; 12 and 11 of 40 in sum) and the Tidecaller (+5, +2) are outside it. Both lose or win on a knife edge between 2:00 and 6:00, so one chest trip changes the run; the sum over 40 seeds moved only for the Tidecaller (5 -> 12).
- Chests give less than the spec's "+50 % at the end of a run": 16 chests on a hero without gear are about +10 % hp, attack and spells at level 25 (a common item of level 1 per slot). Stronger chests made the run without gear easier at once (40 x 1.18: Nightglaive 8 -> 14, Tidecaller 2 -> 8). The knobs: `rules.gear.levelStep`, the price curve, or a chest that gives more than one level. Petr's call after a playtest.
- A rare item in every slot already lifts most heroes to 16 to 20 wins of 20: the losses of a bare hero come in the first six minutes, where flat item numbers weigh most. The difficulties planned later are meant to take this up.

## Elite and boss threat (2026-11-12; Petr chose the direction, the numbers are Claude's)

- Petr's playtest of 2b-3: elites are not strong enough, a player who runs kills everything easily, and bosses near the castle have neither the range nor the speed to hurt or catch him. He chose "they catch you, with attacks you can dodge" over "raw speed" and over "the boss locks you in an arena". Spec: `docs/superpowers/specs/2026-11-12-elite-boss-threat-design.md`.
- The elite (captain) hunts the hero (`hunter: true`) and charges like a lancer; hp 3 -> 5, moveSpeed 0.8 -> 1.0 (396 against a hero's 420-448). A harder elite (hp 6, damage 1, moveSpeed 1.1) left the autopilot 1-3 wins of 20.
- Minibosses come as hunters. Every boss has a strike from afar (`strike`): a warning circle of 1 s where the hero stands, range 450-1300 (Gunmaster 1500); Iron Marshal, Pale Abbot and Dread Regent leap into it, the Gunmaster shoots and stays. Lancers of a rush stay siegers so the castle keeps its pressure.
- Miniboss hp stayed: the autopilot kills each in about 20 s, but with hp x1.5 it lost more runs. Open for Petr's playtest.
- Autopilot wins of 20 seeds, before -> after: Stonehorn 10 -> 8, Nightglaive 12 -> 8, Gravecaller 20 -> 20, Serpent Shaman 17 -> 17, Mistwarden 7 -> 4, Sparkshot 0 -> 0, Redcleaver 15 -> 14, Tidecaller 14 -> 2. Most new losses fall between 2:00 and 6:00 (the first elites and the Iron Marshal at 4:10). The autopilot defends the castle and does not kite, so a player should do better; the Tidecaller is the one to watch.

## Phase 2b-3: the full run with a boss (2026-11-12, the plan's and Claude's choices unless Petr is named)

- Scope (Petr, 2026-11-12): 20 phases (16:40) with the six enemy types, five elite rushes, three minibosses, a final boss with an enrage; the run is won when the final boss falls. Factions, difficulties and the minimap come later.
- Where the plan sharpened the spec (the spec now says the same):
  - A boss is sized by `collision` (80 for minibosses, 96 for the final boss), because the client scales a model by its collision; a "scale 2.5" would have made a small boss of the chaplain.
  - `?duration` and `RunOptions.durationSeconds` move only the arrival of the final boss. Phases and timed events keep their times; tests that need a fast end call `debug.killBoss()`. `?duration` is 5-1200.
  - The enrage counts from the arrival of the final boss (`finale.enrageAfterSeconds: 200`, 20:00 in a normal run), not from the start of the run.
  - `?phase=N` gives the hero the XP of the hand-filled table `rules.debug.phaseXp`, measured with `sim:run --phase-xp`.
- Other choices made while building it:
  - In the finale the spawner uses the table of the last phase whatever the clock says, at `finale.packScale` of the pack size.
  - `debug.spawnEach()` spawns the six common types only; bosses come by the timeline (`?phase=6`, `11`, `16`, `21`).
  - Only the next pending rush is announced. Two rushes closer than `rushWarningSeconds` would leave the second without a warning (the data has none).
  - The autopilot leaves a slam circle (with the dash when it is ready) and in the finale goes for the final boss, ignoring other threats.
  - On a win the end screen shows "Final boss fell at" in place of the time line.
- Balance, tuned in 10 rounds on seeds 1-20 with `npm run sim:run -- --hero all --seeds 1-20` (the plan allowed 12; the last three rounds tried a slower XP curve and were dropped, see the open points):
  - Start of the phase (the plan's first numbers): every hero but the Gravecaller lost between 2:00 and 8:00, 2 wins in 140 runs.
  - Final values: `xpStep` 9 (was 8 in the 5-minute run; the plan's 14 lost every run early), castle hp 58 000 (was 14 000 for 5 minutes), first rush 2 captains + 3 lancers, phase 4 one pack of 9-13, phase 5 packs of 7-10, phases 6-8 packs of 8-12, `finale.packScale` 0.35, final boss hp 257 000 (multiplier 400; the spec's 60 000 fell in 11-26 s).
  - Results on seeds 1-20, wins of 20 (seeds 21-40 in brackets, not tuned on): Stonehorn 10 (6), Nightglaive 12 (11), Serpent Shaman 17 (19), Mistwarden 7 (8), Sparkshot 0 (1), Redcleaver 15 (16), Tidecaller 14 (8), Gravecaller 20 (20, outside the bands).
  - Met: an idle run loses by 3:27 for every hero in the bands (Gravecaller 4:27); every miniboss falls in a median of 12-48 s (target 45: the Serpent Shaman's Gunmaster takes 48 s); the final fight takes a median of 41-52 s (Mistwarden 98 s) and no run reached the enrage; the castle of the won runs ends at 21-57 % on average; no hero has more than half of its losses in one two-minute window on seeds 1-20.
  - **Open 1:** the win band of 6-12 holds for Stonehorn, Nightglaive and Mistwarden. Serpent Shaman, Redcleaver and Tidecaller win more (14-17), Sparkshot never wins: it reaches the finale in most runs with the castle almost gone and loses it within 30 s (a castle of 70 000 hp did not help). The spread between heroes is wider than the run-wide numbers can close; it needs work on the kits or on how the autopilot plays a ranged hero in the finale.
  - **Open 2:** the autopilot has the full kit (4 spells x 5 levels) in phases 7-9, not 12-14, and wins at level 49-50, not 35-45. `xpStep` 11 with smaller packs brought the level to 41-44 and the kit to phases 8-11, but the heroes then died between 2:00 and 6:00 (Stonehorn 0-3 wins, Tidecaller 2-4). A slower curve needs the early phases retuned with it.
  - **Open 3:** the runs are chaotic: between seeds 1-20 and 21-40 the Stonehorn moves from 10 to 6 wins and the Tidecaller from 14 to 8. Read a difference of 3-4 wins of 20 as noise.
  - CI guards only the shape of a run on seeds 1-3 a hero (`sim/bot.test.ts`): it ends within 1400 s by a loss or by the fall of the final boss, and an idle player loses within 240 s (Gravecaller 300 s).

## Visual pass A (2026-11-11, the plan's choices, not Petr's)

- Models come from pinned CC0 KayKit packs (Kay Lousberg); heroes are five adventurer bodies with different weapons and colours, enemies are six skeleton types, the environment is the castle set and eight tree and rock models. Built by `tools/assets-build/`; the pipeline has no KTX2 and no meshopt (textures stay PNG inside the GLB, `simplify` replaces meshopt), see spec section 6.
- Trees and rocks stand only outside the arena rectangle grown by 150 sim units and outside `spawn.radius + 250`, up to 900 past the arena edge. The simulation has no obstacles and the hero can reach every corner, so nothing may stand where he or the enemies walk (the first version put the forest in the corners, which lie beyond the spawn ring, and buried the hero). The layout is a jittered grid (cell 230, fill 0.6, shift in a disc of 80, scale 0.9-1.4, fixed seed 1), 150-900 props.
- The ground plane reaches 6000 sim units past the arena on every side (was 1800 in the plan). With 1800 the end of the plane showed as a blue wedge in the `corner` shot; fog is fully dense at 105 scene units (6720 sim units) from the camera, so 6000 hides the edge. Checked on `corner.png`.
- Models are scaled by height: scene height = 2.2 x the collision diameter (`MODEL_HEIGHT_FACTOR`), not by footprint width, because the rest pose and the weapons widen the footprint.
- Hero ring radii are 1.6 and 1.9 x the collision radius (the plan said 0.9 and 1.15), because the figure hid the ring.
- Enemy models may have up to 3000 triangles (see Engineering below). Blob shadows: opacity 0.6, diameter 1.6 x collision (see Engineering below).
- Prop sizes (`PROP_MODELS` in `client/render/props.ts`), times the placement scale: trees 4.5 scene units tall, rocks 2 at their largest extent (at most 2.8, below the hero's height of 3.08, so a rock is never a building); the kit models are tiny.
- Castle: the kit castle scaled so its footprint corner to corner fits a circle of 2 x castle.radius x 1.1; four towers on the diagonals at 0.95 radius, height 0.8 of the castle, a flag (30 % of the tower height) on each.

## Product (Petr)

- 2026-11-12 (Petr, after the first playtest of visual pass A): Serpent Totem and Wisp Ward share one shape. Both raise 1, 2, 2, 3, 3 wards a cast and keep at most 2, 4, 4, 6, 6 alive; a cast over the cap replaces the oldest ward, so the group moves to the fight. Reasons: the map's Wisp Ward count is 1, 2, 1, 2, 2 (level 3 raised fewer wards than level 2), and wards that stand still cannot be steered, so a large standing group (the totem's cap was 3 to 15) made little sense. The Serpent Totem cast is slower: 4.95 s on every level (design 15; the map has 5 to 15, in the game 1.65 to 4.95 s), the same as Wisp Ward. `design/abilities.yaml` got an optional top-level `cooldown: { design: [...] }` for this.
  - Serpent Totem damage 50 -> 60 (in the game 15 -> 18 a hit; Claude's tuning, Petr may change it): with the small cap, 50 won 1 of 5 test seeds and 75 won 15 of 15 on seeds 1-15. At 60 the Serpent Shaman wins 4 of 5 (9 of 15 on seeds 1-15), drops below 50 % HP in 4 of 5, castle of the won runs 26 %, level 17.6. Its `GAPS` entry in `sim/bot.test.ts` is gone: it meets the common bands. Open gap 1 is now only the Gravecaller.
  - Mistwarden: 3 of 5 wins (was 2), below 50 % HP in 5 of 5, castle of the won runs 66 %, above the common 60 % band; `GAPS` allows 70 % for it. Wisp Ward damage stays 93 (80 and 85 gave 3 and 0 wins of 5: the runs are chaotic, see open gap 2).
  - The other six heroes are unchanged.
- 2026-11-11 evening (Petr, after the result of phase 2b-2): Serpent Totem damage is halved (design 101 -> 50, in the game 30 -> 15 a hit) and Grave Grasp heals 75 % less (`healPerHit` 2.5, 5, 7.5, 10, 15; the map has 50 to 300). Measured on seeds 1-5: both heroes still win 5 of 5 and never drop below 50 % HP. Serpent Shaman: castle of the won runs 61 % (was 83 %), level 19.0, an idle run loses by 2:01. Gravecaller: castle 93 %, level 16.0, an idle run now loses by 2:38 (was 4:20; seed 1 at 2:08). The other six heroes are unchanged. Open gap 1 below stays open: the two need more than these cuts.
- 2026-11-11 (phase 2b-2, ring arena, enemy AI, four heroes; Petr chose the first four points after his playtest of 2b-1, the rest is the plan's choice):
  - why (Petr): 2b-1 was too easy, enemies mostly never reached him, and four heroes were too few. He chose +4 heroes (8 in all), the castle in the middle with packs from every side and the difficulty "hard"; the enemy AI was ours to design. Visual pass A moved behind this phase;
  - arena: 6000 × 6000, castle at (0, 0), the hero starts at (0, 500). Gates and lanes are gone; `arena.spawn` is the ring (`radius` 2400, `spread` 150). This replaces the spec's "castle in the south, gates in the north" (spec 3.2 is updated);
  - packs: every interval draws one random direction without trigonometry; a phase sends `packs` (1 to 3) at once, spread evenly around the ring (2 opposite, 3 at 120°). Each pack rolls its own size and role. The elites of a phase come with the first pack of its first interval;
  - behaviours: Shieldbearer and Captain `siege`, Scout `flank` (comes at 45° until 300 from the hero and always hunts the hero), Musketeer `skirmish` (backs off from the hero while it reloads when the hero is nearer than 0.6 of its reach; never from the castle), Chaplain `support` (follows its nearest ally of another behaviour within 600, holds at 250, flees a hero within 350; without an ally it walks on like `siege`), Lancer `charge`;
  - charge: aimed at a hero 300–700 away; 0.5 s windup (a red line warns), then a straight run in the locked direction at speed × 2.5 for at most 900; a touch deals the attack × the charge multiplier and ends it; cooldown 6 s; a stun cancels it; a hero who steps out of the line is missed;
  - Captain's aura: enemies within 400 of a living Captain (other Captains excepted) walk and hit × 1.25; auras do not stack;
  - arrows: a new pack shows an arrow on the edge of the screen for 4 s, red `0xd94a4a` for siegers and violet `0xb84ad8` for hunters;
  - new heroes (map sources only in `design/`): Mistwarden, Sparkshot, Redcleaver, Tidecaller, built only from spell kinds the simulation already had. `on_hit` gained a plain bonus (damage, chance, stun) next to `empower` for Searing Rounds and Stunning Tide. Script-backed values are in the `review` notes of `design/abilities.yaml`;
  - Gravecaller: `grave-grasp.healPerHit` is 10, 20, 30, 40, 60 (was 50 to 300).
- 2026-11-11 (phase 2b-2, tuning result of task 6, not Petr's choice):
  - targets per hero over seeds 1–5: the autopilot wins 2–4, an idle run loses within 2:30, the hero drops below 50 % HP in at least 4 runs, the castle of the won runs ends below 60 % on average, the average level is 10–18 and 700–1200 enemies come;
  - what the measurements showed first: Musketeers dealt most of the damage to the hero and the castle (they stand off and fire all the time), and the autopilot lost half of its runs around 2:30 for two reasons of its own: it took a random card at a level-up (often an attribute instead of a spell) and it retreated as far as the spawn ring;
  - autopilot (`sim/bot.ts`): it defends the castle (the enemy nearest to the castle within 1400, else the enemy nearest to the hero within 400, else its post 400 from the castle); **it takes the first spell card of an offer before an attribute**; it never goes farther than 2150 from its post; below 30 % HP it keeps 350 from every enemy; it stands still for a step to aim a line spell that is ready (a line flies where the hero walks); it sidesteps a charge that winds up within 700 and dashes when it can;
  - enemy numbers: damage multipliers Shieldbearer 0.5, Scout 0.3, Musketeer 0.32, Chaplain 0.65, Lancer 0.5, Captain 0.75 (of the map's damage); charge multiplier 1.5 (plan: 2); `scaling.yaml` enemy HP 0.35 (was 0.3) and speed 1.32 (was 1.22);
  - rules: castle 14000 HP (was 12000) with 1 % regeneration a minute (was 2); `xpFirst` 10 and `xpStep` 8 (was 7 and 4.5); packs 6–10, 8–11, 8–12 × 2, 10–14 × 2, 9–13 × 2 and 11–15 × 3; `hunterShare` as in the plan;
  - new heroes' spells against the first numbers of task 5: Wisp Ward 93 damage, Wailing Wave 933 / 4660, Mist Surge ticks × 0.6, Rocket Fan and Beam Swarm × 0.48, Cleaver Toss and Rot Field × 0.41, Riptide and Drowned Lake × 0.6, Crushing Wave level 1 400 (map 500);
  - result on seeds 1–5 (autopilot wins, runs with the hero below 50 %, castle of the won runs, average level, enemies | longest idle run): Stonehorn 2, 5, 17 %, 15.0, 759 | 2:29. Nightglaive 3, 5, 39 %, 17.6, 884 | 1:55. Mistwarden 2, 5, 56 %, 14.8, 780 | 1:54. Sparkshot 3, 5, 32 %, 17.4, 907 | 2:16. Redcleaver 3, 5, 53 %, 15.6, 804 | 2:39. Tidecaller 2, 5, 19 %, 17.6, 901 | 2:32. These six meet every target (the idle test plays seed 1; on other seeds the Redcleaver and the Tidecaller last up to 9 s longer than 2:30);
  - **open gap 1, two heroes are too strong:** Gravecaller 5 wins, never below 50 %, castle 93 %, level 16.0, idle up to 4:20. Serpent Shaman 5 wins, never below 50 % (Mending Tide heals at 60 %), castle 83 %, level 18.4. Nothing the plan let us tune reaches them (enemy HP × 1.45 with packs × 0.7 to 0.8 was tried: both still won every run). First trials of their own spells did not bring them into the band either (Gravecaller: all spell damage × 0.5, or Grave Grasp cooldown × 2.5 with Skull Ring cooldown × 2 and no heal; Serpent Shaman: Serpent Totem damage × 0.5 with Mending Tide × 0.5; each still won 5 of 5). They need a redesign, which is Petr's decision. The tests keep the level that is met (`GAPS` in `sim/bot.test.ts`);
  - **open gap 2, the targets are noisy:** a run is chaotic, so 5 seeds measure little. The numbers above were fitted to seeds 1–5. On seeds 6–15 the same build gives the autopilot (of 10): Stonehorn 1, Nightglaive 7, Mistwarden 7, Sparkshot 5, Redcleaver 9, Tidecaller 3. Read the balance as "about half of the autopilot runs are lost, mostly after 2:30", not as exact win rates. A steadier measure (more seeds, wider bands) belongs to the next balance pass;
  - not tried: `run.timeScaling`, `autocast` and hero stats, which the plan did not open.
- 2026-11-11 (phase 2b-1, swarms and enemy types; Petr approved the four marked points on 2026-11-10, the rest is the plan's choice):
  - types (Petr): the map's four humans with their numbers plus a runner and an elite as variants. Shieldbearer (Footman), Scout (runner, Footman), Musketeer (Rifleman), Chaplain (Priest), Lancer (Knight), Captain (elite, Knight). The elite is only bigger and has its own colour for now;
  - ranged attack (Petr): an instant hit like a hero's; the shot is only an effect. The only way to dodge is to leave the range;
  - length (Petr): 5 minutes, 6 phases of 50 s;
  - chaplain (Petr): heals wounded enemies in range, itself too: 8 HP × the time scaling, every 1 s, range 450, the most wounded target first. The map uses the default WC3 Heal (25 HP for mana); 8 ≈ 25 × 0.3, the factor of enemy HP;
  - variants: Scout HP ×0.5, speed ×1.5, size ×0.8, damage ×0.6. Captain HP ×3, damage ×1.5, size ×1.5, speed ×0.8. They multiply the map's numbers, then `scaling.yaml` applies. The Lancer keeps the map's speed (faster than the Shieldbearer); it is a tank by HP;
  - packs: one pack is one gate (gates alternate) and one role (hunters with the chance `hunterShare`). All appear at once in a square around the gate with the half side `gateRadius × max(1, √(size/8))`. The first pack comes at 2 s;
  - cap 150: a pack fills only the free slots, the rest is dropped and nothing is banked;
  - elites: the phase's Captains come with its first pack, ahead of the others. Elite rushes at 3:00, 6:00 … come with the rest of 2b;
  - XP: Shieldbearer 1, Scout 1, Musketeer 2, Chaplain 2, Lancer 4, Captain 12;
  - colours: Shieldbearer red `0xc23b3b`, Scout yellow `0xd8c84a`, Musketeer blue `0x3b7bd9`, Chaplain white `0xe6e6f2`, Lancer steel `0x7a8296`, Captain violet `0xb84ad8`. No orange;
  - performance: effect meshes are not uploaded to the GPU while they show nothing, the `?fps=1` overlay names the GPU, and the menu warns on software rendering (SwiftShader, llvmpipe, Microsoft Basic Render Driver or a fallback adapter).
- 2026-11-11 (phase 2b-1, tuning result, not Petr's choice):
  - targets per hero over seeds 1–5: the autopilot wins 3–5, an idle run loses, the hero drops below 70 % HP in at least 3 runs, the average level is 10–18 with the lowest hero at 70 % of the median or more, and 600–1000 enemies arrive;
  - changes against the plan's first numbers: `xpFirst` 7 and `xpStep` 4.5 (was 5 and 3), `hunterShare` ×0.8 in every phase (0.24 / 0.28 / 0.28 / 0.32 / 0.32 / 0.36), and the Chaplain's damage ×0.5 (its 600-range attack outranged every hero but one);
  - the autopilot changed too: a ranged hero now steps up to an enemy nearer than 800 that its base attack does not reach. Before, it stood on its post while shooters hit it, so the Nightglaive bot lost every run whatever the numbers were;
  - result (autopilot | idle): Stonehorn 4 of 5 won, level 17.0, in danger 5 of 5 | idle loses 5 of 5. Nightglaive 3 won, level 20.0, in danger 5 | idle loses 5. Gravecaller 5 won, level 16.0, in danger 0 | idle wins 5. Serpent Shaman 5 won, level 15.6, in danger 5 | idle loses 5. About 670–770 enemies a run;
  - **open gap:** Gravecaller never drops below 70 % HP and wins even an idle run, because Grave Grasp heals 50 HP per enemy hit from range 800. Phase numbers that would threaten it kill the other three heroes, and this phase was not allowed to change one hero's spell. The tests keep the level that is met (`sim/bot.test.ts`). The Nightglaive's average level (20.0) is above the 10–18 target. Both wait for Petr's decision (lower `healPerHit`, or leave it until the rest of 2b);
  - the run of 2a was 3 minutes with one type, about 360 enemies and level about 11; this entry replaces that pace.
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
- 2026-11-10 (phase 2a tuning, Task 8): `abilities.damage` = 0.3 in `design/scaling.yaml` (the map's ratios between spells stay). At tuning time the autopilot won 5/5 with every hero, 318-339 kills, average levels 11.2/10.0/7.2/9.6 (stonehorn, nightglaive, gravecaller, serpent-shaman). After the Spirit Ward rule from the final review the serpent-shaman wins 4/5.
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

- Co-op loop (Petr's net test, 2026-11-21): the co-op client steps the sim on a timer that browsers do not throttle (a Web Worker), not on `requestAnimationFrame`, and catches up to the wall-clock step target as far as inputs are ready; drawing stays on `requestAnimationFrame`.
- Multiplayer spike (2026-11-20, Claude's choices): the determinism matrix (`client/determinism/matrix.ts`, digest `73372c52` at `3d48341`) is the regression test of the multi-hero refactor: a step that must not change the one-player game keeps the digest, and the hash must mix the same values in the same order for one player. `stateHash` covers every field that can change a later step; `prevX/prevY`, constructor tables, the event buffer and the spatial grid stay out.
- Co-op networking (spike): deterministic lockstep, `INPUT_DELAY = 3` steps (100 ms), a hash exchange every 30 steps, a ring of 256 steps per player; `peerjs` 1.5.5 (MIT, exact) with the PeerJS cloud signalling for now; network code only in `client/net/` and `client/net-spike/`, importing the sim only through `sim/index.ts`.
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
- Enemy models may have up to 3000 triangles instead of 2000 (2026-11-11, visual pass A Task 2). The KayKit skeleton characters use a palette texture, so nearly every edge is a UV seam and meshopt stops at about 1800 triangles for the body alone (error 0.16, repeated passes); with weapons the shieldbearer stays at 2451. Heroes meet 5000 easily. All six enemies build at 2982-2997 triangles; check skinning on the screenshots of Tasks 3 and 4.
- Blob shadows: centre opacity 0.6 and diameter 1.6 x collision (the plan said 0.35 and 1.1; changed 2026-11-11, visual pass A Task 6, because the dusk ground and the taller figures hid them). The ward circle grew by the same ratio.
