# Decisions

Decisions that still apply. Check here before you change a rule. Newest first in each section.

**Archive:** the decisions of 2026-11-11 to 2026-11-24 (co-op for 3-4 players and older: multiplayer migration,
difficulties and worlds, factions, sustain, spell scaling, shared spells, audio, chest loot and magic find, gear,
drops and chests, elite and boss threat, phase 2b-3, visual pass A) are in `docs/archive/decisions-2026-11-11-to-24.md`.
They **still apply** unless a section here overrides them. A section that code or yaml names and that is not in this
file is there; search it (`grep -n`) before you change a rule of those areas, do not read it whole.

## New heroes, batch 2 (2026-11-28; Petr: "the remaining heroes of the map", the picks and numbers are Claude's)

- Batch 2 of the plan `docs/superpowers/plans/2026-11-28-new-heroes.md` (section Batch 2): **Ashsinger** (O004, INT
  ranged: Cinder Wave, Pyre Mantle, Ember Comet; ultimate Phoenix Wrath), **Thunderhoof** (O003, STR melee: Ground
  Surge, Hoofstomp, Long March; ultimate Aftershock), **Stormseer** (O01A, INT ranged: Spirit Pack, Squall, Dread
  Call; ultimate Last Rites), **Mirrorblade** (O001, AGI melee: Twin Shades, Flash Cut, Mirror Dance; ultimate Steel
  Cyclone). Names and texts are ours; the map's numbers and script lines are in the review notes.
- **New spell mechanic:** `nova.stunSeconds` (optional): the nova stuns what it hits (Hoofstomp, Dread Call). The
  map's stuns (War Stomp 3-5 s every 6.5 s, All Stop 5-25 s on the whole map) would hold the crowd for good at our
  cooldowns, so both stuns are design values (1-2 s, 1.5-3.5 s within 350).
- **Left out of the map's scripts:** the execute of Life's Ended (every enemy on the map under 2000 / 4000 hp dies),
  the final slam of Bladestorm (Steel Cyclone's bursts deal the map's damage of a second each instead), the pull of
  Kamezoko (Ember Comet hits each enemy once), the evasion and bonus damage of Imager's Critical Strike.
- **Imager's map ultimate is Critical Strike** (A006, level 10); the game makes Bladestorm (A003) the ultimate, as the
  plan said, and Critical Strike a spell (Flash Cut). Bladestorm has 5 map levels, so Steel Cyclone has no `source`.
- **Mirrorblade's blades sweep** (`attack.splash` 160 / 0.5, like Redcleaver's axes): with a single-target kit he fell
  in the first 2 minutes at any power (0 of 20 at power 1, 1.8 and 2.6). Stormseer opens with Spirit Pack and
  Mirrorblade with Twin Shades (slot 0 must deal damage early).
- **Spirit Pack's wolves** are wards in Serpent Totem's units (map 100 -> 330 before the x0.3 of data-build), 2-3 at a
  time for 20 s.
- **Ability order and digest:** the blocks come last in `design/abilities.yaml`; the 24 older matrix cases are
  identical, the matrix gains four `h-<id>` cases. Digest `fa5a1ee3` -> `51871bd1`.
- **Balance** (`sim:run --seeds 1-20 --gear none`, world 1 normal), wins of 20 by `power`:

  | hero | power 1 | tries | kept |
  |---|---|---|---|
  | Ashsinger | 13 | 0.5: 1, 0.7: 7, 0.6: 1 | **0.65: 4** |
  | Thunderhoof | 20 | | **0.4: 4** |
  | Stormseer | 11 (Squall first) | Spirit Pack first: 0.6: 1, 0.8: 6 | **0.7: 4** |
  | Mirrorblade | 0 | no sweep: 1.8: 2, 2.6: 0; sweep: 0.6: 0, 1.2: 1 | **1.0: 2** |

  The damage meter of the kept numbers: Ashsinger Ember Comet 29 %, Cinder Wave 24 %, Phoenix Wrath 11 %; Thunderhoof
  Aftershock 39 %, Ground Surge 25 %; Stormseer Last Rites 69 %, Spirit Pack 13 % (Squall and Dread Call about 1 %);
  Mirrorblade attack 28-30 %, the copies 10 %, Steel Cyclone 2-4 % (the shared spells carry the rest). Most losses come
  in the first 4 minutes, as with the older heroes.

## New heroes, batch 1 (2026-11-28; Petr: "the remaining heroes of the map", the picks and numbers are Claude's)

- Plan: `docs/superpowers/plans/2026-11-28-new-heroes.md` (all 36 remaining map heroes in 9 batches of 4, first the
  ones whose spells fit our kinds). Batch 1: **Razorwind** (O00M, AGI melee), **Dawnhammer** (O00Z, STR melee),
  **Frostweaver** (O00T, INT ranged), **Deadeye** (O00J, AGI ranged). Names, roles and texts are ours; the map's
  numbers and script lines are in the review notes of `design/abilities.yaml`.
- **New spell mechanics:** `on_hit.multiplier` (with `chance`: a critical strike that multiplies the base attack;
  the highest of the procs counts, on top of the gear's crit), `on_hit.splashRadius` / `splashPercent` now work (a
  cleave around the target, added to a hero's own `baseAttack.splash`; the AoE scale halves `splashRadius` too),
  `aura.slow` + `aura.radius` (every 10 steps the enemies within the radius walk `slow` slower, like the gear's slow
  aura; the larger slow wins).
- **Timed self buffs of the map become permanent auras with smaller numbers** (Berserk, Bloodlust: about 40 % of
  the map's attack speed), as Swift Pace and Hunter's Focus before.
- **Kits that ride on the base attack** (Razorwind, Deadeye: three passives and an ultimate) start with their damage
  passive in slot 0 (the cleave, the spread shots), and their attack is faster: Razorwind `cooldownScale` 0.5 with 2
  strikes, Deadeye `cooldownScale` 0.5 (reach x2 as every ranged hero). Without that they fell in 30 s at level 1.
- **Ultimates and spells with more map levels than ours** (A004 Mirror Image 5 levels, A039 Multishot 10) have no
  `source` and design rows (Doubles: the map's levels 1, 3, 5; Fan Fire: the first five), so an ultimate keeps 3
  levels and a spell 6.
- **Ability order:** the new heroes' abilities come after the shared spells and passives in `design/abilities.yaml`,
  so the indices of the older ones stay (the state hash mixes them); the 20 older matrix cases are unchanged
  checkpoint by checkpoint, the matrix gains the four `h-<id>` cases. Digest `82150491` -> `fa5a1ee3`.
- **Model budget:** a run loads only its heroes, so the 11 MB budget counts the enemy models, the common env models,
  the four heaviest hero models and the heaviest world (it counted every hero; 44 heroes at about 330 kB would not
  fit).
- **Balance** (`sim:run --seeds 1-20 --gear none`, world 1 normal), wins of 20 by `power`:

  | hero | power 1 | tries | kept |
  |---|---|---|---|
  | Razorwind | 0 (12 with the faster attack) | 0.75: 11, 0.5: 5, 0.42: 5 | **0.36: 4** |
  | Dawnhammer | 20 | | **0.35: 4** |
  | Frostweaver | 19 | 0.55: 6, 0.48: 5, 0.42: 1 | **0.44: 2** |
  | Deadeye | 0 (1 with the faster attack) | 1.4: 8, 1.3: 6, 1.2: 2 | **1.25: 2** |

  The damage meter of the kept numbers: Razorwind Crossing Strike 45 %, attack 17 %; Dawnhammer Holy Burst 25 %,
  Fan of Light 14 %, Dominion 12 %; Frostweaver Frost Slice 22 %, Frost Slap 9 %, Ice Fall 8 %; Deadeye attack 63 %,
  Doubles 26 %. Most losses come in the first 4 minutes, as with the older heroes.

## Named items only legendary / mythic, salvage for named items (2026-11-28; Petr's words, Claude's rulings and numbers)

Plan `docs/superpowers/plans/2026-11-28-named-items-legendary.md`. Petr: "the 70 items with their own names and
great icons should be legendary / mythic only"; "part legendary, part mythic"; "Salvage for every item".

- **Rarities:** every common and rare named item is legendary; every epic is mythic, but the five epics of trinket,
  mainHand and offHand (the slot types that had a mythic) are legendary. 48 legendary, 22 mythic; every slot type has
  both. Ids, names and icons stay; owned items keep id and level and get stronger.
- **Stats:** legendary 4 rows / 30 points, mythic 5 rows / 42 (the items.yaml budgets). The old rows stay first;
  every row gets the same share in whole points (30 = 8+8+7+7, 42 = 9+9+8+8+8), rows of the item's theme are added
  (its attribute, the slot's usual stats; a scratchpad script, not by eye). The old 5 legendaries and 3 mythics are
  unchanged.
- **Effects:** every named item has one; 11 kinds, the items of one slot type differ in kind (but the two old pairs
  Skysplitter / Glaive of the Last Storm and Last Rampart / Oathkeeper's Wall). Effects of one kind still do not
  stack. Legendary / mythic version of each kind (one version per rarity everywhere):

  | kind | legendary | mythic |
  |---|---|---|
  | chain_on_attack | every 4th attack, 90 x SP, 3 jumps, 350 | every 3rd, 160, 5 jumps, 400 |
  | splash_on_attack | 30 %, 220, 60 % | 40 %, 250, 80 % |
  | low_hp_shield | under 30 %, 3 s, cooldown 45 s | under 40 %, 4 s, cooldown 30 s |
  | haste_on_elite_kill | +50 % for 8 s | +60 % for 10 s |
  | slow_aura | 25 % in 350 | 35 % in 400 |
  | gold_heals_castle | 1.25 hp per gold | 2 hp per gold |
  | heal_on_kill (new) | every 10th kill heals 40 hp | every 10th kill heals 60 hp |
  | nova_when_hit (new) | 150 x SP in 250, once in 4 s | 200 x SP in 300, once in 3 s |
  | elite_slayer (new) | +20 % damage to elites and bosses | +30 % |
  | death_burst (new) | 20 % of kills burst, 60 x SP in 180 | 25 %, 70 x SP in 200 |
  | castle_ward (new) | the castle takes 20 % less | 30 % less |

  A nova fires in the step after the hit and a burst in the step after the kill (`updateGearEffects`), so no enemy
  dies inside the enemies' own loop; at most 16 bursts wait at once, the kills of a burst do not burst. elite_slayer
  counts for the hero's hits and his allies', not for the world's hazards; castle_ward: the strongest of all
  players counts. Random mythics roll the mythic versions of the five new kinds too (`rules.loot.mythicEffects`,
  11 entries).
- **Saves:** a named record takes its rarity from the catalogue (already so since stage 3), so old saves and
  imports show and price the new rarity.
- **Salvage:** any record no doll wears, named ones too; gold `rules.loot.salvageGold[rarity] x level` (a random
  item's record level the same way); the bank limit 500 stays. A salvaged named item can drop again (new, level 1).
- **Drops and chests:** `namedShare` stays (legendary 0.25, mythic 0.4); common to epic cards and drops are always
  random items.
- **Balance check** (autopilot wins before -> after, world 1 normal unless said; `none` seeds 1-20, the gear presets
  1-10, `mid` was rare named items before and is legendary now):

  | hero | none | mid | full | rolled-full | full, world 3 hell | rolled-full, world 3 hell (after) |
  |---|---|---|---|---|---|---|
  | stonehorn | 4 -> 3 | 7 -> 10 | 10 -> 10 | 10 -> 10 | 0 -> 6 | 3 |
  | nightglaive | 4 -> 5 | 6 -> 10 | 10 -> 10 | 10 -> 10 | 0 -> 7 | 1 |
  | gravecaller | 3 -> 3 | 2 -> 10 | 10 -> 10 | 10 -> 10 | 1 -> 3 | 0 |
  | serpent-shaman | 3 -> 2 | 9 -> 10 | 10 -> 10 | 10 -> 10 | 5 -> 8 | 9 |
  | mistwarden | 4 -> 2 | 7 -> 10 | 10 -> 10 | 9 -> 10 | 0 -> 1 | 8 |
  | sparkshot | 3 -> 4 | 7 -> 10 | 10 -> 10 | 9 -> 10 | 2 -> 5 | 1 |
  | redcleaver | 5 -> 5 | 5 -> 10 | 8 -> 10 | 7 -> 10 | 0 -> 1 | 0 |
  | tidecaller | 6 -> 3 | 1 -> 9 | 10 -> 10 | 10 -> 10 | 0 -> 2 | 1 |
  | all | 32 -> 27 of 160 | 44 -> 79 of 80 | 78 -> 80 | 75 -> 80 | 8 -> 33 of 80 | 23 of 80 |

  Without gear the runs stay near the 10-20 % target (the chests' named legendary / mythic cards are a little
  rarer per card now that their share is the same but the item stronger; the change is within the seeds' noise).
  `sim:chests -- --seeds 1-200` (level 25, 15 chests, no permanent gear): mean x1.25 -> x1.26. **The named full set
  is now clearly stronger than the random mythic set** (world 3 hell: 33 vs 23 wins of 80; it was about equal before
  with the old epics): named mythics keep 42 points and an effect in every slot, a random mythic has 34. **Petr
  (2026-11-28): the named items stay the top; the random mythic's budget stays 34.**
- **sim:run presets:** `mid` is a legendary named item of level 1 per slot (was rare); `full` the best named item per
  slot at level 5 (mythic everywhere but the second trinket). The determinism matrix case `loot-t3` wears
  `rolled-mid` (under `full` a chest offers only Level cards).

## Balance target (Petr, 2026-11-27)

- The autopilot without gear (`npm run sim:run -- --hero all --seeds 1-20 --gear none`, world 1 normal from
  phase 1) wins about 10 % of the runs, for every hero (1-4 of 20 per hero). Every balance change keeps to it;
  the plan of the changes that get there: `docs/superpowers/plans/2026-11-27-petr-batch-2.md`.

## English only (Petr, 2026-11-27)

- "Let's not deal with Czech, keep it all in English for now; it saves work." New player-facing texts are English
  only. The existing Czech stays in the game: `?lang=cs` or a stored choice still shows it, a message key missing from
  `client/ui/messages-cs.ts` falls back to English, and a Czech browser no longer picks Czech by itself (`pickLang`).
  Where a data schema still requires `cs` (`{ en, cs }`, the gendered rare names), new rows repeat the English text.
- Petr, 2026-11-28 (again): "Forget Czech. English is enough, write it down." **Never write new Czech** anywhere in
  the game (messages, `design/*.yaml` rows, names of heroes, spells, items): `cs` repeats `en`. Talking to Petr in
  chat stays Czech.

## Random items, stage 6: icons (2026-11-27; the picks are Claude's)

- Pictures from game-icons.net (CC BY 3.0) at the pinned commit `82d9488` of `game-icons/icons`: one per base and
  named item, chosen by Claude (`client/ui/item-icon-names.ts`); several items may share one. Files are named
  `<author>-<icon>.svg` (two authors have a `trousers`). Built by `npm run assets:icons` (`tools/assets-build/icons.ts`):
  only `<path>` elements with plain path data are accepted, the black background square is dropped and all paths
  become one, filled with `currentColor`. Budget: all icons under 600 kB (`tests/assets.test.ts`), now 180 kB.
- Drawn as a CSS mask (`--icon: url(...)`, `background-color: currentColor`), so the text colour (the rarity's)
  fills it and the files load on demand (not bundled into the script). A random item shows its base's picture; an
  item without one, empty slots and the slot filters show our slot glyph.
- Attribution: a row per file in `assets/LICENSES.md` (author, CC BY 3.0, link to the icon's page) and a Credits
  line in the menu naming the authors.

## Random items, stage 5: balance (2026-11-27)

- `sim:run --gear rolled-mid` (a rare rolled at power 2, level 1, in every slot) and `rolled-full` (a mythic rolled
  at power 12, level 5, tier 4), rolled for the hero's primary attribute from a seed fixed per hero and slot
  (`tools/sim-run/gear-presets.ts`). Targets of the plan: rolled-mid about the named `mid`, rolled-full within the
  named `full` + 10 %.
- Stats at level 30 (average of 10 roll seeds, rolled / named): rolled-mid hp 0.86-1.02, attack 0.90-1.19, spell
  0.96-1.04. Rolled-full first: the main attribute +30 % (spell x1.3 for Int heroes, hp x1.7 for Str heroes) and the
  attack of Agi heroes x5: crit damage stacked over 16 slots (+3.6).
- **`rules.loot.caps.critDamage` 1.5**: gear adds at most +150 % crit damage (a crit is then at most x2.0 at the
  60 % crit chance cap). **A random mythic's budget 42 -> 34**; named mythics keep 42 (`design/items.yaml`).
- Autopilot wins: world 1 normal, seeds 1-10, of 80: `mid` 46, `rolled-mid` 39. World 3 hell, seeds 1-10, of 80:
  `full` 13, `rolled-full` 21 (budget 42) -> 13 (budget 34). Agi heroes still show a higher attack (crit) and a lower
  spell power (0.62) with rolled-full; in wins they do not stand out.
- Digest `4facf838` -> `62622e34`.

## Sentry Ward, Serpent Totem, dash and blink (Petr, 2026-11-27, after batch 3)

- "uprav hodnoty sentry wards na stejné hodnoty jako serpent totem, mělo by to mít ve výsledku podobné dps": Sentry
  Ward takes Serpent Totem's cooldown, count, range, bite and cap. "jejich duration má být 10s pouze": a sentry ward
  lives 10 s; "pro serpent totem platí 15s" (was 60). Both scale with the hero's `power`, so the same ward deals
  more for a hero of a higher power.
- Plan task 7 (Petr): 3 dash charges from level 10 (was 20), the blink (F) from level 20 (was 40).
- Hero power after these: Gravecaller 0.29, Sparkshot 0.74, Redcleaver 0.38, Tidecaller 0.51 (others as in batch 3).
  Wins of 20, gear none: Stonehorn 4, Nightglaive 4, Gravecaller 4, Serpent Shaman 3, Mistwarden 4, Sparkshot 2,
  Redcleaver 4, Tidecaller 5 (30 of 160). Sentry Ward deals 9-26 % of the damage of the heroes who take it. Win counts
  jump by 3-6 for a power step of 0.02-0.04 (a cliff), so read them as +-2.
- Digest `4d1136d4` -> `4a120fc3` (wards) -> `4facf838` (dash, power, crit cap).

## Co-op gear between runs and group strength by size (2026-11-28; Petr's words, Claude's numbers)

- **Gear before Again** (Petr: "we must be able to wear the gear we looted"): the end screen of a co-op run has a
  **Gear for the next run** button (`#end-gear`) for the host and the guests. It opens the gear screen of the hero
  this window plays; Back returns to the end screen. A guest whose gear changed sends `{ t: "gear", g }` to the host
  (protocol version **6**), who keeps it as that guest's row for the group's next `start`; the host reads his own
  gear again when he presses Again. A start that comes while the screen is open closes it and the run comes up (a
  change made then counts for the run after). The hero stays the same (to change it, leave and join a new room).
  Tested by hand: two windows over a local PeerServer, lost -> guest wears an item -> Again -> the guest's new run
  wears it, hashes matched, no desync.
- **Group strength** (Petr: "3 and 4 players need easier enemies, the sequence of the numbers is wrong"): hp, damage
  and pack size are each x (1 + perPlayer x (n - 1)) and they multiply, so the threat grew faster than the group.
  New `rules.coop.extraPlayers` = **[1, 1.7, 2.4]**: the count of extra players that the enemy multipliers, the
  castle hp and the XP share use for 2, 3 and 4 players (was 1, 2, 3); `perPlayer` and the chests (n - 1) stay.
  Autopilot, gear none, world 1 normal, 80 runs per cell (8 groups x 10 seeds); solo 25 % (seeds 1-10):

  | extraPlayers for 3 / 4 | 3 players | 4 players |
  |---|---|---|
  | 2 / 3 (before) | 9 % | 1 % |
  | 1.3 / 1.5 | 68 % | 90 % |
  | 1.5 / 1.8 | 48 % | 76 % |
  | 1.8 / 2.5 | 8 % | 14 % |
  | 1.7 / 2.3 | 24 % | 29 % |
  | **1.7 / 2.4** | 25 % (seeds 11-20) | 16 % (1-10), 25 % (11-20) |

  2 players (unchanged, 1): 20 % (seeds 1-10), 21 % (11-20). Every group size now wins about as often as one hero.
  The digest does not change (the matrix has no co-op case).

## Petr's batch 3 (2026-11-27; plan `docs/superpowers/plans/2026-11-27-petr-batch-3.md`, Petr's words, Claude's numbers)

- **No white hit flash** (task 2): enemies no longer flash white after a hit; the type-colour glow and the red of
  bloodlust stay (`client/render/enemy-crowd.ts`; `anim.w` is unused, 0).
- **Co-op restart** (task 1): a co-op run that ended (lost or won) shows the host **Again (same group)**: he sends a
  new `start` (new seed, same course) over the links he already has; a guest who left is not in it and the rest are
  numbered again (`client/game/coop-restart.ts`). A guest's end screen says "Waiting for the host to start again..."
  and its button is **Leave** (back to the menu, which closes his link). The old net loop is detached (links stay
  open), the guest detaches his at once when the new `start` comes, so nothing of the old run is in flight. Only an
  ended run can restart. Guests keep the gear of the last start (the host's is read again); since 2026-11-28 they can
  change it on the end screen (section Co-op gear between runs). Protocol version stays 5 (`start` may now come again). Tested: unit test of the
  new group, e2e local co-op (`?debug=1&mate=`), and by hand two windows over a local PeerServer (lost -> Again ->
  a new run, hashes matched, no desync).
- **Spell levels** (task 4, Petr confirmed: "the same strength, fewer steps"): signature and shared spells 6 levels
  (was 10), ultimates 3 (was 2; the middle is halfway), passives 5 (was 10). Level 1 and the top keep today's values;
  data-build spreads each kind over its own count (`design/scaling.yaml` `levels 6`, `ultimateLevels 3`,
  `passiveLevels 5`; an ultimate is the hero's `ultimate` in `heroes.yaml`). Serpent Totem's bite: 100, 145, 190,
  235, 280, 325. When nothing is left to learn or raise, an offer holds only STR, AGI, INT; attribute cards always come
  last and in that order. The kit is 3 x 6 + 3 + 2 x 6 + 4 x 5 = 53 picks.
- **Wards x5** (task 6): `serpent-totem` maxAlive 20 ... 30 and the shared `sentry-ward` 5 ... 15 over the 6 levels
  (the design rows x5, spread); the count per cast stays. `ALLY_CAPACITY` 32 -> 256 (4 players x 45 wards and images).
- **Hero levels** (task 5): XP to leave level L is `xpFirst + xpStep (L - 1) + xpQuad (L - 1)^2`, rounded:
  10, 9, **0.3** (`rules.progression.xpQuad`, new and optional). The first levels come as fast as before; a won run
  ends at level 65-69 (was about 102). A plain xpStep 22 also slowed the first minute and the autopilot fell in it.
  **Co-op** (Petr: one curve for both): every kill's XP is x `1 / (1 + coop.perPlayer.packSize x (n - 1))`
  (`DifficultyMods.xp`), so the bigger packs of a group do not level it faster; a won 3-player run ends near level
  66. Debug grants and `?phase=` XP are not scaled. `rules.debug.phaseXp` from `sim:run --phase-xp`.
- **Balance pass** (task 7, target of batch 2: 1-4 autopilot wins of 20 per hero, gear none, world 1 normal): only
  `power` moved. Wins of 20 after tasks 4-6 -> after the pass: Stonehorn 6 -> 3 (power 0.42 -> 0.38), Nightglaive
  6 -> 4 (0.7 -> 0.62), Gravecaller 2 -> 2 (0.33), Serpent Shaman 18 -> 4 (0.38 -> 0.24; the wards x5), Mistwarden
  3 -> 3 (1), Sparkshot 5 -> 3 (0.85 -> 0.82), Redcleaver 0 -> 3 (0.39 -> 0.43), Tidecaller 1 -> 4 (0.6 -> 0.64);
  in sum 41 -> 26 of 160 (16 %). Most losses still come in minutes 0-4.
- **Co-op strength** (task 3, done after the balance pass so the group is measured against the tuned heroes):
  `rules.coop.perPlayer` hp 0.9 -> **0.5**, damage 0.45 -> **0.22** (packSize, eliteHp, castleHp, chests stay).
  Autopilot, gear none, seeds 1-10, wins of 80 per group size:

  | perPlayer (hp, damage) | 2 players | 3 players | 4 players |
  |---|---|---|---|
  | 0.9, 0.45 (before, old power) | - | 0 of 16 (seeds 1-2) | - |
  | 0.5, 0.25 | 20 | 7 | 5 |
  | 0.45, 0.2 | 29 | 21 | 12 |
  | **0.5, 0.22** | 28 | 14 | 6 |

  3 players win about as often as one hero (18 % against 16 %); 2 players are easier and 4 a little harder (a linear
  rule per player cannot hold all three). Full gear: 3 and 4 players win 40 of 40.
- Digest `f0490b01` -> `f874baf3` (spell levels) -> `207b558f` (wards) -> `8820dd81` (XP curve) -> `4d1136d4` (power);
  the co-op numbers and the restart leave it.

## Petr's batch 2 (2026-11-27; plan `docs/superpowers/plans/2026-11-27-petr-batch-2.md`, Petr's words, Claude's numbers)

- **Balance target** (Petr): about 10 % autopilot wins with no gear, every hero
  (`npm run sim:run -- --hero all --seeds 1-20 --gear none`); the table of every balance step is below.
- **AoE -50 %** (task 1): `design/scaling.yaml` `abilities.areaScale: 0.5` multiplies `radius`, `hitRadius`, `width`
  and `endWidth` of every ability (heroes, shared spells, passives, ultimates), applied last on the spread rows and
  rounded; reach (`range`, `length`, `attackRange`, `bounceRange`) stays. Radius x 0.5 as said (a quarter of the
  area); gear's `areaSize` multiplies on top. The cone's start half width (60) stays, so cones grow less now.
  Tests that sit enemies at fixed distances moved them in; the world tests of `sim-run` and the matrix cases
  `w4-blizzard` (gear full) and `loot-t3` (seed 27) keep their heroes alive long enough; the 4-player lockstep test
  softens hits to 0.25. Digest `36fd80a2` -> `22ae189d`.
- Autopilot, world 1 normal, gear none, seeds 1-10 (wins of 10), before -> after AoE -50 %: Stonehorn 10 -> 0,
  Nightglaive 8 -> 1, Gravecaller 10 -> 10, Serpent Shaman 2 -> 2, Mistwarden 3 -> 1, Sparkshot 8 -> 0, Redcleaver
  10 -> 9, Tidecaller 10 -> 0; in sum 61 -> 23 of 80. Gravecaller (summons) and Redcleaver (melee) barely feel it;
  the tuning toward 10 % each comes after the bosses and casters (task 7 of the plan).
- **Serpent Totem** (task 3, Petr): a bite of 100 at level 1 and +25 % of that a level, linear: 100, 125 ... 325 at
  level 10 (times spell power). Written as design values (333, 810, 1510, 2410, 3520) that give this row after
  `abilities.damage`, `levelGrowthExponent` and the spread to 10 levels; `data/generated.test.ts` pins the row.
  Serpent Shaman, gear none, seeds 1-10: 2 -> 10 wins. Digest `22ae189d` -> `e81a39b0`.
- **Blink** (task 4, Petr): F puts the hero at the mouse point in the same step at any distance, only kept in the
  arena and off the obstacles; `rules.hero.blink.maxDistance` became `aheadDistance` (900), the jump straight ahead
  when there is no mouse point. The burst, the stun and the 10 s cooldown stay. The look: a flash where the hero
  left and the burst where he landed, no streak between them. The autopilot does not blink, so the digest stays.
- **Boss strength** (task 5, first half, Petr): `design/scaling.yaml` `enemies.bossHp: 3` and `bossDamage: 2`; data-build
  multiplies a boss's rounded hp, its attack, slam and strike damage (the charge multiplies the attack). Boss hp
  targets 36 000, 60 000, 90 000 and 771 000 (`data/generated.test.ts`). Digest `e81a39b0` -> `1000e1ab`.
- **Bosses per world** (task 5, second half; the plan's reading, "level" = world): every world has its own four
  bosses; world 1 keeps today's. A boss stays the same sim type in every world (the slot: iron-marshal, pale-abbot,
  gunmaster, dread-regent), so its mechanics, hp, xp, gold, sounds and `rules.drops` (keyed by that type = by slot)
  do not change; `design/worlds.yaml` `bosses` gives it a name (EN, CS), a model borrowed from a common type, a body
  tint, a drawn size (x1-1.25, the collision stays) and the colour of a new ring under every boss (the final boss's
  ring is its aura's reach). Red Waste: Dune Reaver, Ash Oracle, Red Slinger, Sand Warlord; Shadewood: Thorn
  Stalker, Hollow Druid, Bark Archer, Grove Colossus; Frostreach: Rime Charger, Frost Seer, Ice Marksman, Frost
  Giant; Blightscar: Blight Rider, Plague Abbess, Cinder Spitter, Blight Lord. The crowd draws them as extra meshes
  (`client/render/boss-looks.ts`), so the digest stays. The item tooltip still names the world 1 bosses as sources.
- **Chest cards as upgrades** (task 6, Petr): a card never offers an item at or below the rarity its slot wears. The
  rarity and the slot are drawn as before; when the slot wears that rarity or a higher one, the card is a Level card
  of the worn item with `rules.loot.upgradeShare` 0.5, else it moves to another slot of the offer's free ones that is
  empty or wears a lower rarity (New or Choice there); with no such slot it is a Level card too, so a mythic slot only
  ever gets Level cards. A Level card of a worn random item carries a copy of it (`rolled`) for the UI. The bot's
  order (upgrades first) is unchanged. Digest `1000e1ab` -> `4316afa9` (with the fix below).
- **Big enemies and island gaps** (fix found with task 6): islands keep gaps of 120 and the flow field routes for a
  radius of `PASS_MARGIN` (36), but an enemy was pushed out of the islands with its whole collision, so the final boss
  (96) stuck in a gap for good (Gravecaller, seed 2: no end of the run). The push-out radius is now at most
  `PASS_MARGIN`; a big enemy overlaps an island a little where it squeezes through. Charges and leaps as before.
- **Casters** (task 2, Petr: "at least 25 % casters"): each faction gets a new caster type at the end of
  `design/enemies.yaml` (the type index order stays): Battle Mage / Bitevní mág (human), Fire Caller / Vyvolavač ohně
  (orc), Bone Acolyte / Kostěný akolyta (undead), Moon Priestess / Měsíční kněžka (elf). `behavior: skirmish` and the
  new flag `caster: true` (schema, data-build). Numbers: the source and multipliers of the faction's support caster
  (Priest x0.65, Shaman x0.6, Necromancer x0.65; the elf one the Priest), so each hits like the chaplain, bloodcaller
  or gravebinder (13-14 every 1.5-2.1 s from 600) without the support spell; the json rows were written in the cloud
  by that rule (no map export there): `data:build` must give the same files. From phase 3 the caster is at least a
  quarter of `rules.phases[].mix` (25-28 %), its weight mostly taken from the foot types (shieldbearer, scout, brute,
  ghoul, huntress), the other roles keep theirs; phases 1-2 have none (`data/generated.test.ts`). The look: a
  thicker beam (0.14) that lives 0.22 s in the faction's colour (arcane blue, fire orange, grave green, moon violet)
  and a flash where it lands (`client/render/enemy-fx.ts`); the sound: the enemy's `attack` cue in
  `design/audio.yaml` (`enemy-bolt-arcane`, `-fire`, `-bone`, `-moon` on files already encoded, -16 dB, two voices,
  priority 0) when the bolt hits the hero or the castle. The hit stays instant like every enemy shot.
- **Caster models and the model budget:** each caster has its own KayKit model (`tools/assets-build/manifest.ts`: a
  mage with a wand, a barbarian with a staff, a skeleton rogue with a staff, a caped rogue with a staff), about
  250-300 kB each. The common models plus the heaviest world grew to 10.9 MB, so the budget went 10 -> 11 MB
  (`tests/assets.test.ts`, AGENTS.md). Quantizing the meshes (gltf-transform `quantize`) was measured first: it
  saves only about 20 % and dropped the skin, so it was not taken; borrowing a model would break the rule that every
  common type has its own. Digest `4316afa9` -> `2b384fc3`.
- **The autopilot kites** (Petr, 2026-11-27: "it must move like a player and run from the enemies; the melee ones with
  axes do not run, they fight and take less damage"): balance is measured with a bot that moves. A ranged hero keeps
  the nearest enemy at 60 % of its attack range (at most 450; +150 below 30 % hp), walks away from every enemy within
  1000 weighted by 1/d^2 and sideways towards the castle (it circles), loses the outward part near the edge of the
  castle's defence circle and dashes out of 4 enemies within 220. Melee heroes (Stonehorn, Redcleaver) never back off
  and take half (`damageTaken` 0.75 -> 0.5). The late-phase speed test may take 15 s (more enemies alive).
- **Serpent Shaman shoots** (Petr): `attack: { kind: ranged, range: 1200 }` in heroes.yaml replaces the map's melee
  125 (data-build: `attack.kind`, `attack.range`); its `damageTaken` 0.75 went.
- **Hero power** (balance knob): `power` in heroes.yaml multiplies the base attack and the spell power (damage and
  heals of every ability and summon); `damageTaken` may go up to 2. Four rounds against the old standing bot were
  thrown away when the bot changed.
- **Spells aim themselves at the thickest crowd** (Petr, 2026-11-27: "line spells must target the biggest nearest
  pack: five enemies side by side beat one alone"; "never at the enemies in front of you, that does not work while we
  run, it must aim itself"): a line spell (`sim/abilities/line.ts`) and a cone (`cone.ts`) no longer fly where the hero
  walks or at the nearest enemy; they aim at the enemy whose direction puts the most enemies inside the line of the
  spell's length and half width (`densestLine`, `sim/abilities/targeting.ts`; a cone counts with its mean half width;
  ties: the nearer, then the lower slot). The autopilot no longer stops to aim a line.
- **Novas around the hero become aimed spells** (task 7, Petr: "maybe the type of the heroes' spells must change"): a
  ranged hero keeps its distance, so a nova around it never had an enemy inside. Falling Stars (Nightglaive) is an
  `area` at the thickest crowd within 800 that slows (area takes `slow`, `slowSeconds`); Rocket Fan (Sparkshot) is a
  cone of length 900, end width 300 (600 before areaScale) and 16 targets that aims itself. Forked Bolt and Blade Fan
  (cones) aim at the crowd too; their texts and the three `targeting` fields read `densest_cluster`.
- **Hero power** (task 7): Stonehorn 0.42, Nightglaive 0.7, Gravecaller 0.33, Serpent Shaman 0.38, Mistwarden 1,
  Sparkshot 0.85, Redcleaver 0.39, Tidecaller 0.6. The Int card shows the spell power without the hero's power (the
  player's bonus, `client/ui/card-lines.ts`); spell values in the tooltips include it (what the spell really deals).
- Autopilot, world 1 normal, gear none, seeds 1-20 (wins of 20): kiting bot -> aimed lines and cones, Falling Stars
  and Rocket Fan, no power -> with power. Stonehorn 0 -> 18 -> 2; Nightglaive 0 -> 18 -> 4; Gravecaller 20 -> 20 -> 4;
  Serpent Shaman 20 -> 19 -> 2; Mistwarden 1 -> 3 -> 3; Sparkshot 1 -> 7 -> 2; Redcleaver 9 -> 19 -> 2; Tidecaller
  1 -> 18 -> 4. In sum 23 of 160 (14 %). Most losses come in the first 4 minutes (the run is won or lost in phases
  1-4); a win is a cliff in power: a step of 0.05 moves a hero by 3-6 wins, so 20 seeds give about +-2.
- Autopilot, gear none, seeds 1-20, with casters, before -> after the kiting bot (no power): Stonehorn 0 -> 0,
  Nightglaive 0 -> 0, Gravecaller 18 -> 20, Serpent Shaman 20 -> 20, Mistwarden 1 -> 1, Sparkshot 0 -> 1,
  Redcleaver 9 -> 9, Tidecaller 1 -> 1. The ranged heroes die in 0-2 min: their early damage is too low (task 7).
- Autopilot, gear none, seeds 1-10, after tasks 1, 3, 4 and boss strength: Stonehorn 0, Nightglaive 0, Gravecaller
  10, Serpent Shaman 10, Mistwarden 1, Sparkshot 1, Redcleaver 7, Tidecaller 0 (29 of 80). Far from 10 % each:
  the summoners (Gravecaller, Serpent Shaman) and Redcleaver are too strong, the rest die early (Stonehorn and
  Tidecaller before 3 min). Tuning per hero is task 7, after the casters (task 2) and the chest rule (task 6).

## Co-op lobby: gear and settings (Petr, 2026-11-27: "in multiplayer you cannot choose gear, import, or open the settings")
- The co-op lobby has Gear and Settings buttons. Gear opens the menu's gear screen for the chosen hero (doll,
  collection, filters, salvage, import and export) and Back returns to the lobby; a guest who changed his gear sends
  it to the host again (`join`), the host's own is read at Start. When the host starts while a guest looks at his
  gear, the screen closes and the run comes up. Settings opens the same panel as the menu's. In a co-op run C (gear)
  and O (settings) open as in a solo run, without pausing it.
- Fix: a worn random item did not travel in co-op (the wire carried only slot, id and level, so the teammates'
  windows skipped it). Protocol version 5: a random item's entry carries its roll (`NetRolled`: base, rarity,
  effect, name, stats, values, tiers; `client/net/net-gear.ts`); every window checks it against its game data and
  leaves out the same entries, so the run stays in lockstep. A window of version 4 and one of 5 refuse each other.

## Damage meter (Petr, 2026-11-27: "we need a damage meter to know which spell deals the most", after the WoW addon Details; the design is Claude's)
- The sim counts, per player, the damage that landed (no overkill), hits, the top hit and kills of each source
  (`sim/damage-meter.ts`): the ten ability slots (a summon's hits count for the slot that summoned it), the basic
  attack (with multishot and the hero's splash), item effects (the chain and splash of gear) and thorns. World
  damage (storm, meteors, fire pools) counts for nobody. It is a readout: no system reads it and the state hash
  leaves it out, so it never changes a run (digest unchanged).
- In the run a panel on the right lists the bars, the biggest first, with damage and share, total and damage per
  second in its head; a hover gives hits, average, top hit and kills. N shows or hides it (remembered in the
  browser); it steps aside while a level-up or chest offer is open. The end screen lists the five biggest sources.
  `window.__game.meter` and the `meter` line of `sim:run` give the same numbers for tests and balance.

## Random items, stage 4: client (2026-11-27; the plan's tasks 15-17, English only, the details are Claude's)
- **Tooltips, chest cards, compare:** a random item says "<Rarity> random item"; each affix row carries a tier mark
  T1-T4 (grey, green, blue, gold), the base's own row none; the effect line as before; the source line reads "From
  chests and bosses" (the boss list is for named items).
- **Gear screen:** filters by slot, role and rarity; the role of a random item is its base's flavour (heavy str,
  light agi, cloth int, neutral any), of a named item the first primary attribute among its rows, else any. Sort by
  rarity (as before) or by power: the item's rows in budget points (value / the affix unit of its stat) at its
  level, owned before not owned. The grid draws at most `rules.loot.collectionLimit` (200) entries and says
  "showing N of M" beyond that; the count turns red at 200.
- **Salvage** (Petr's answer 9.2): the Salvage button switches the grid into salvage mode, where a click on a random
  item that no hero's doll wears removes it and puts `rules.loot.salvageGold` of its rarity (10 / 25 / 50 / 90 /
  150) into the bank; named items (owned once, they level up) and worn items cannot be salvaged. The bank holds at
  most `rules.loot.bankLimit` 500 (about the first four chests); the next solo run takes the whole bank as starting
  gold (`RunOptions.gold`, `PlayerOptions.gold` in the sim) and empties it. Co-op runs leave the bank alone (every
  peer would have to know it). Deviation from the plan: the bank lives in the gear save (`SaveData.bankGold`), not in
  `progress`, so a salvage removes the item and adds its gold in one write.
- **Debug:** `debug.grantRolled(slot, rarity, power)`; `window.__game.gear[]` has `rows` for random items.
- **Determinism:** the matrix case `loot-t3` starts with 300 gold; digest `fa569e92` -> `f0490b01`.
- The gear screen's grid is 268 px high (it scrolls), so the doll, the filters and the buttons still fit.

## Random items, stage 3: meta and saves (2026-11-27; the plan's tasks 11-15, the details are Claude's)

- **Item records** (`meta/item-record.ts`): one record per item of the collection, `uid` + rarity + permanent level,
  and either `named` (a catalogue id) or a rolled item stored by value (`base`, rows `[stat, value at level 1,
  tier]`, `effect`, two-word `name`), so a later change of the affix numbers never changes an owned item. A named
  item is owned once and gains levels; every rolled item is its own record and keeps the level it dropped with.
- **Save version 2** (`meta/save.ts`): `items: ItemRecord[]`, `nextUid`, loadouts by uid. Version 1 (item id to
  level, loadouts by id) migrates on read: every item becomes a named record in key order, the dolls keep what they
  wore. The reader keeps at most 2 x `rules.loot.collectionLimit` (200) records; salvaging a full collection is
  stage 4. A rolled record whose base, rarity or rows the game does not know is left out and counted in `dropped`;
  an unknown effect or name is dropped and the item kept. Import takes version 1 or 2 and refuses a file with no
  item this game knows.
- **Boss drops** (`meta/drop.ts`): the rarity is drawn as before (table + magic find); with the rarity's
  `namedShare` the drop is a named item (new, or one more level of an owned one), else (and when every named item of
  that rarity is at the top) a random item for a random slot, rolled for the local hero's primary attribute with the
  boss's item power (`bossPower`: order, world, difficulty) at `levelAtPower` of that power. A boss therefore never
  drops nothing any more. Common and rare drops are always random (named share 0). Same seed, order, course and
  collection give the same drop.
- **Loadouts** (`meta/equip.ts`, `sim/gear.ts`): `toLoadout` gives rolled entries (`item: rolled-<base>`, `rolled`);
  `loadGear` wears them at their record's level; `rolledFits` refuses one in a slot of another type.
- **Client:** the gear screen lists the named items as before, then the rolled records of the filter (highest
  rarity first, then in the order they came); a click equips by uid. The count reads "records of 200". The end
  screen and the news line read a rolled drop as new. `window.__game.collection` stays named id to level
  (`namedLevels`); `collectionSize` counts every record.
- **Determinism:** unchanged (`36fd80a2`); the matrix wears named loadouts only.

## Random items, stage 2: sim (2026-11-27; the plan's tasks 6-10, the numbers and details are Claude's)

- **New stats** (STAT_IDS, `GearBonus`, `HeroStats`; prices in `design/affixes.yaml`): crit chance and crit damage
  (a crit multiplies one basic attack and its extra blows by 1 + `rules.loot.critDamage` 0.5 + gear crit damage),
  dodge (an enemy's hit, not a cloud, a storm or fire; event `HeroDodge`), damage taken (a share off
  `heroDamageScale`, so the hazards that divide by it stay exact shares of max hp), thorns (a share of the damage
  a melee hit dealt, paid back by `applyThorns` right after `updateEnemies` as damage of source 2: no lifesteal, no
  knockback; the enemy is never killed inside its own update), cooldown speed (joins the INT and passive cooldown
  sum), ultimate cooldown (only the ultimate, on top) and area size (radius of nova, area, ticking area with its
  bursts, and on-cast spells). Caps of the gear sum: crit chance 60 %, dodge 40 %, damage taken 50 %
  (`rules.loot.caps`). Crit and dodge draw from the run's generator only for a hero who has them.
- **Rolled items in the run:** `GearState.item` is ROLLED_ITEM (-2) for a rolled item, whose base, rarity, effect,
  rare name and up to five rows (implicit + four affixes) sit in fixed typed arrays; `recomputeGear` sums the rows
  like named stats, at the same item levels. The state hash mixes the rolled fields (named slots hash as before).
- **Chests:** a card draws its rarity as before, then a free slot (no longer only slots with a named item of that
  rarity), then a named item with `namedShare` (when one of that rarity fits), else a random item rolled for the
  hero's primary attribute with the chest's item power (`chestPower`: phase, world, difficulty). A rolled card is New
  or Choice, never Level (no two rolled items are the same). Common and rare cards are always rolled now, since
  their named share is 0.
- **Mythic rolls** draw one of `rules.loot.mythicEffects`; it works like the named item's effect (one per kind,
  the later slot counts).
- **Determinism:** the matrix gets `loot-t3` (gravecaller, world 3 insane from phase 11: 20 chests, T3 rows);
  `w4-blizzard` moved to seed 16 (with seed 15 the tidecaller fell before the blizzard ended). Digest `ff675613` ->
  `36fd80a2`.
- **UI until stage 4:** a rolled item is shown as an `Item` with its own name (`client/ui/rolled-item.ts`): the
  two-word name, or prefix + base + suffix; tooltips, chest cards, the compare and the gear panel read it like a
  named item. The labels of the new stats exist in EN and CS.

## Random items, stage 1: data (2026-11-27; Petr approved the spec, the numbers and the words are Claude's)

Spec `docs/superpowers/specs/2026-11-26-random-items-design.md` (Petr's answers in section 9), plan
`docs/superpowers/plans/2026-11-27-random-items.md`, tasks 1-5. The sim does not read the new data yet (stage 2).

- **Files:** `design/item-bases.yaml` (46 bases), `design/affixes.yaml` (22 affixes, one per stat),
  `design/item-names.yaml` (rare names), `rules.loot` in `design/rules.yaml`. data-build copies the three lists into
  `data/generated/loot.json` (`GameData.loot`: `bases`, `affixes`, `names`); no map record behind them, so the cloud
  writes the file with `mapLoot` of `tools/data-build/build.ts`, the same code `data:build` runs.
- **Bases:** every slot type has a heavy (str), a light (agi) and a cloth (int) base; neck, ring, trinket and main hand
  also a neutral one (`any`). The implicit row is worth 2 points (`rules.loot.implicitPoints`) and uses only stats the
  sim reads today.
- **Tiers split the budget, they never add points** (spec 4: "the rows of an item share its budget"): affix row i gets
  (budget - 2) x weight_i / sum of the weights x a roll in [0.92, 1.08]. Weights T1-T4 1 / 1.35 / 1.7 / 2 (T4 = 2 x
  T1), minPower 0 / 3 / 6 / 9. So every roll is within 8 % of the rarity budget (the test checks every tier combination
  and both ends of every roll), a strong source gives a lopsided item (one big row of the stat you want), and an item
  grows stronger only by its level. Deviation from the plan: the tier weights and minPower are one table in
  `rules.loot.tiers`, not per stat; an affix only caps its tier (`maxTier`: lifesteal, move speed, dodge and damage
  taken stop at T3). A one-row (common) item's tier changes nothing.
- **Prices of the new stats** (1 point at item level 1, in `affixes.yaml`, `unit`): crit chance 1 % (a crit deals
  +50 % at first), crit damage 5 %, dodge 0.5 %, damage taken 0.5 % less, thorns 5 % of a melee hit, cooldown speed
  0.5 %, ultimate cooldown 1 %, area size 0.5 %. Stage 2 may retune them with the sim. The old stats keep the prices
  of the `design/items.yaml` header (the test compares them).
- **Roles:** str pool str, hp, armor, regen, damage taken, thorns, lifesteal; agi pool agi, attack speed, damage, move
  speed, crit chance, crit damage, dodge, lifesteal; int pool int, spell power, cooldown speed, ultimate cooldown,
  area size, lifesteal; any: magnet, gold find, magic find. Every role pool alone fills a mythic (4 affixes).
- **Item power:** boss drops 2 / 4 / 6 / 8 by order, chests 1 + 0.3 x phase, + 0.5 per world above 1, + 1 Insane,
  + 2 Hell. World 1 Normal: the first boss only T1, the final boss up to T3, chests up to T3 (phase 20: 7); T4 needs
  power 9 (e.g. the final boss of world 3 or Insane); world 5 Hell's final boss is 12. A dropped item's level:
  power 0 / 3 / 6 / 9 / 12 for level 1-5 (`levelAtPower`).
- **Other numbers:** smart share 0.6, collection 200, named share epic 10 %, legendary 25 %, mythic 40 % (Petr),
  salvage gold 10 / 25 / 50 / 90 / 150 by rarity (chest base price 100).
- **Mythic effects:** the six existing kinds with fixed numbers between the named legendary and mythic items
  (`rules.loot.mythicEffects`); new role effects later.
- **Czech names:** a base carries the gender of its noun, `m`, `f`, `n` or `p`: a fourth form for plural nouns (boty,
  rukavice, nárameníky), one plural form for inanimate masculine and feminine nouns. Every prefix and first word of a
  rare name has the four forms; the test checks hard adjectives (-ý, -á, -é, -é) and soft ones (-í in all). The base's
  CS name starts with a capital and is lowercased behind a prefix: "Mocná železná přilba medvěda". "Ghost" was a map
  unit name (the clean-room test caught it): the rare name word is "Pale" / "Bledý".

## Petr's solo playtest batch (2026-11-26; Petr's wishes, the numbers are Claude's unless Petr is named)

Petr could not win alone: enemies from the far side walked to the castle while he fought on the other. Spec of the
random items that come next: `docs/superpowers/specs/2026-11-26-random-items-design.md` (approved 2026-11-27).

- **Defence circle** (Petr: 1000). `rules.enemies.heroDefendRange` 1000: while the target hero stands within it of
  the castle, every enemy goes for him (`sim/enemy-ai.ts`); beyond it the siegers turn to the castle again. The
  autopilot keeps 150 inside the circle when it walks to a target beyond it (`sim/bot.ts`, `DEFEND_EDGE_MARGIN`).
- **Enemy strength follows the hero's level.** It grew with time before (x1 to x1.83 at the final boss) and with the
  phases' types. Now `rules.enemies.levelScaling` hp and damage +0.9 % a hero level (player 0's level; XP is
  shared), and `run.timeScaling.cap` is 1. A hero ends a run near level 95 since the packs were doubled twice, so the
  end is about x1.85 as before; a hero who levels faster meets stronger enemies. A first try at +1.5 % hp and +1 %
  damage on top of the time scaling made the end x4.4 hp: Gravecaller won 1 of 6 instead of 8 of 8.
- **Ranged reach x2** (Petr). `design/heroes.yaml` `attack.rangeScale: 2` on the five ranged heroes: Nightglaive 700,
  Gravecaller and Mistwarden 1200, Tidecaller 1300, Sparkshot 1400. 1200-1400 reaches about the top and bottom edge
  of the screen; Petr checks whether it shoots at enemies he cannot see.
- **Redcleaver** (Petr: two axes, much faster, splash). `attack: { cooldownScale: 0.45, strikes: 2, splash:
  { radius: 160, share: 0.5 } }`: an attack every 0.34 s, two blows each rolling its damage, every blow hits the
  enemies within 160 of the target for half (`sim/hero-splash.ts`).
- **Ultimates burst like Bone Stampede** (Petr). Beam Swarm, Rot Field and Drowned Lake: 10 / 11 bursts a second of
  30 / 67 (x spell power) within 275 / 350, as the Gravecaller's. Rot Field lasts 10 / 12 s (was 10 / 20).
- **Serpent wards** (Petr: x1.5 a level, with spell power). Damage 20, 30, 45, 68, 101 (design values 67, 150, 337,
  770, 1700 before the scaling), then spread over 10 levels: 20 ... 101, x spell power as before.
- **10 spell levels** (Petr: level 1 as now, the top as level 5 now). `design/scaling.yaml` `abilities.levels: 10`:
  data-build spreads every ability with more than 2 levels last (`tools/data-build/spread-levels.ts`, linear between
  the old levels; whole rows stay whole, shares keep 4 decimals, cooldowns 2). Ultimates keep 2 levels. With heroes at
  level ~95 there are enough cards for the longer climb.
- **Dash charges** (Petr). From level 20 the dash holds 3 charges; a spent one comes back after the 4 s cooldown, one
  at a time (`rules.hero.dash.charges`, `maxDashCharges`).
- **Blink, key F** (Petr: level 40, 10 s, a teleport to the mouse with area damage, not too strong).
  `rules.hero.blink`: at most 900 to the pointer, then 300 x spell power within 300 and a 0.5 s stun; it ends a dash
  and breaks roots. The aim travels in `TickInput.aimX/aimY` (whole world units from the hero), net protocol 4.
- **Tooltip** (Petr). The pointer on a cell of the ability bar or the passive row shows the spell's level, its text
  and its values against the next level (`client/ui/ability-tooltip.ts`).
- **Serpent Shaman** (Claude, after the autopilot lost 7 of 8 before level 5 once every enemy came for him): 2
  totems from level 1 (count 2, 2, 2, 3, 3 before the spread, cap 4, 4, 4, 6, 6) and `damageTaken` 0.75 like the
  other melee heroes (his reach is 125).
- **Balance** (autopilot, world 1 normal, mid gear, seeds 1-8): wins 20 -> 62 of 64 (table in `docs/STATUS.md`).
  The determinism case `w2-sand` plays the Gravecaller now (the Mistwarden of seed 11 fell before the storm).
  Digest `ff675613`.
- **Weather on the map** (Petr). Snow, embers, dust and fireflies stay on the ground when the hero walks: positions are
  world points wrapped into the box around the hero (`client/render/particles.ts`).

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
  - autopilot (`sim/bot.ts`): it defends the castle (the enemy nearest to the castle within 1400, else the enemy nearest to the hero within 400, else its post 400 from the castle); **it takes the first spell card of an offer before an attribute**; it never goes farther than 2150 from its post; below 30 % HP it keeps 350 from every enemy; it sidesteps a charge that winds up within 700 and dashes when it can;
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
