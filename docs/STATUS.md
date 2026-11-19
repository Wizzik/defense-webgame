# Status

Updated 2026-11-19 (Gravecaller nerf on top of the sustain merge; both wait for Petr's playtest). Read this first when you resume work.

## Gravecaller nerf: smaller Bone Stampede, half the Grave Grasp heal (2026-11-19); waits for Petr's playtest

- Petr's wish: the Gravecaller is so strong because its ultimate reaches much wider than other heroes' ultimates; halve its heal too.
- Then (Petr played it: still too strong, it ran nearly all the time) the Bone Stampede cooldown doubled: 19.8/13.2 -> 39.6/26.4 s (PR #22).
- Bone Stampede radius 1000/1500 -> 700/900 with bursts 20/30 -> 10/11 a second (same hits per enemy inside, the spell deals about half to a third of before); Grave Grasp heal per hit halved (1.25-7.5). Numbers: `docs/DECISIONS.md`, section Gravecaller.
- The autopilot still wins 20 of 20 (castle 80 -> 73 %): probes show its strength is the kit (three damage spells, two of them every 1.98 s), not the ultimate or the heal. Open for Petr after he plays.
- What Petr checks: does the ultimate feel smaller (bones fall closer around the hero, fewer of them), is the Gravecaller still too easy; quick link https://wizzik.github.io/defense-webgame/?debug=1&hero=gravecaller, `__game.debug.setAbilityLevel(3, 2)` for the ultimate at its top level (R casts it).

## Sustain: lifesteal, hearts and map orbs: merged (PR #19 as `e20da9a`, 2026-11-19); waits for Petr's playtest

- All 7 tasks of `docs/superpowers/plans/2026-11-19-sustain.md` are done (inline in one chat, one final self-review against spec 4.1-4.7 and `AGENTS.md`: the chat starts no separate reviewer). `npm run check`, the build and the e2e project `webgl2-fallback` (33 of 33) pass. Spec: `docs/superpowers/specs/2026-11-19-sustain-design.md`. Numbers, the ten items and the win table: `docs/DECISIONS.md`, section Sustain.
- Why: Petr played PR #18 ("it is really very hard", he died in the 3rd minute) and asked for sustain instead of turning the spell knobs back. The knobs (0.5 / 0.005) and the doubled enemy damage stay.
- What it brings:
  - **orbs on the map** (up to 3, the first at 8, 20 and 32 s, then 30-45 s after a pickup, each time at a random place 300-2000 from the castle): boots x2 move speed, berserk x1.5 damage (spells and summons too), renewal 100 % hp over 15 s; each lasts 15 s, the same orb again restarts it; the magnet does not pull orbs, walk within 70;
  - **hearts:** elites and bosses always drop one, other enemies 4 %; the magnet pulls them; a heart heals 8 % of max hp;
  - **lifesteal** on ten rare and epic items (one row each replaced, 1-1.75 % at level 1): heals that share of the damage of attacks and spells, at most 2 % of max hp a second;
  - the HUD shows the running effects with seconds over the ability bar; heals rise as green numbers; lifesteal stands in tooltips, the chest compare and the totals under the doll; two new sounds;
  - the autopilot walks to boots and berserk orbs within 900 and to a renewal orb within 1500 below 70 % hp; `sim:run` prints a `sustain` line.
- Balance (autopilot wins of 320, seeds 1-20 and 21-40, `main` -> `sustain`): without gear 68 -> 138, mid gear 124 -> 172, full gear 254 -> 248; losses before 4:00 without gear 202 -> 40, so the losses moved to the finale (16-20 minutes).
- What Petr checks in the playtest:
  - can the first minutes be survived now, is the game still a challenge later;
  - is an orb visible and worth the walk (they are drawn bigger than the spec said: about 2.8 x a crystal, with a ring on the floor), do berserk and boots feel strong, does renewal save a bad moment;
  - hearts: are they noticeable, is 8 % right;
  - lifesteal in the tooltips and under the doll; the effect bar over the ability bar at 1280x720;
  - quick links after the merge: https://wizzik.github.io/defense-webgame/?debug=1, then in the console `__game.debug.spawnOrb("heal")` (or `"boots"`, `"berserk"`), `__game.debug.dropHeart()`, `__game.debug.wear("ring1", "moonlit-signet")` for lifesteal.
- **Open for Petr:** full gear does not reach "almost all" (248 of 320, `main` 254); a higher lifesteal cap changed nothing, the full-gear losses are finale losses of Redcleaver, Tidecaller, Mistwarden and Sparkshot (their kits). Gravecaller still wins 20 of 20.
- Merged at Petr's word after green CI, Pages deployed.
- Next: Petr plays the live game.

## Spell scaling, multishot on every arrow, chest compare: merged (PR #18 as `4b50a8c`, 2026-11-19); Petr played it and asked for sustain (above)

- All 7 tasks of `docs/superpowers/plans/2026-11-19-spell-scaling-chest-compare.md` are done (inline in one chat, one final self-review). `npm run check`, the build and the e2e project `webgl2-fallback` pass. Spec: `docs/superpowers/specs/2026-11-19-spell-scaling-chest-compare-design.md`. Numbers, rulings and tables: `docs/DECISIONS.md`, section Spell scaling, multishot on every arrow, chest compare.
- What it brings:
  - spells grow from level 1 by the square root of their map curve (`design/scaling.yaml` `abilities.levelGrowthExponent: 0.5`): Forked Bolt 90 -> 367 instead of 1500, Mending Tide 150 -> 671 instead of 3000; level 1 is unchanged;
  - Int gives half the spell power (`rules.hero.spellPowerPerInt` 0.01 -> 0.005);
  - a cast at phase 20 without gear now hits for 900-2250 instead of 2000-14400: a Lancer survives one cast for four of the seven heroes that reach phase 20 (the Serpent Shaman: 7118 -> 1073; Nightglaive, Gravecaller and Sparkshot still one-shot it);
  - every multishot arrow of Searing Rounds carries the burn (still 1, 1, 2, 2, 3 extra arrows);
  - a chest card for a worn slot is now a choice: click it (or its key) and a panel shows the worn item (one level up) and the new one (at the slot's level + 1) side by side, stat rows lined up, better green with ▲, worse red with ▼; 1 keeps, 2 takes, Esc goes back to the three cards. A lower or equal rarity is offered too now;
  - `sim:run` prints a `burst` line per hero (spell cast and base attack against Shieldbearer and Lancer hp at phases 5, 10, 15, 20).
- **Open for Petr (the main decision):** tamed spells cost many autopilot wins: without gear 131 -> 68 of 320, mid gear 255 -> 124, full gear 320 -> 254 (Redcleaver 6 and 4 of 20 with the best gear). The deaths fall at 2-4 minutes under the doubled enemy damage, before spells grow, so no setting of the two knobs reaches 6-12 of 20 for most heroes. Choose: keep 0.5 / 0.005 (spells tamed, much harder game), go up to 0.7 / 0.01 (gear wins return: mid 117, full 157 of 160 on seeds 1-20, but a late cast kills 2-5 Lancers again), or keep the curves and soften the early threat. Sweep table in `docs/DECISIONS.md`.
- **Open for Petr:** Gravecaller still wins 20 of 20 in every setting; Mistwarden, Redcleaver and Tidecaller win none without gear (their kits, out of scope); the base attack grows about x4.5 over a run (measured, not tuned); on-hit bonuses do not use spell power.
- What Petr checks in the playtest:
  - is the second half of a run a challenge now, is the Serpent Shaman no longer immortal, are the first minutes too hard;
  - the Sparkshot: does every arrow burn, does it feel strong enough;
  - the compare panel at 1280x720: readability, the lined-up rows, keys 1, 2 and Esc, the mouse;
  - quick links: https://wizzik.github.io/defense-webgame/?debug=1 after the merge; in the console `__game.debug.grantGold(5000)`, then walk to a chest (a worn slot shows a Choice after the first few chests); `__game.debug.setAbilityLevel(0, 5)` for a signature spell at its top level; `__game.debug.wear("head", "travelers-hood")` to wear an item at once.
- Merged at Petr's word after green CI, Pages deployed. Petr kept the knobs and asked for sustain instead (the Sustain section at the top).

## Chest loot, Magic Find and enemy threat: merged (PR #15 as `dd88ff5`, 2026-11-18); waits for Petr's playtest

- All 7 tasks of `docs/superpowers/plans/2026-11-18-chest-loot-threat.md` are done (executed inline in one chat, one final self-review: the chat could not start a separate reviewer). `npm run check` and the build pass; the e2e project `webgl2-fallback` passed 30 of 30 after Task 5 and 29 of 30 at the end ("pack arrows point at a new pack" ran out of its 5 s on this container's ~2.5 fps software rendering, the same timing on `main`; CI decides). Numbers, rulings and the win table: `docs/DECISIONS.md`, section Chest loot, Magic Find and enemy threat.
- What it brings:
  - enemies hit the hero twice as hard; Stonehorn and Redcleaver take a quarter less (x1.5); the castle as before;
  - a chest offers 3 rolled items in all five rarities (glyph, name in the rarity colour, rarity, "new for this run" / "replaces X for this run" / "level 3 -> 4", stat rows compared with the worn item); a higher rarity replaces the worn item for the run, the permanent item comes back after the run;
  - a new stat Magic Find on 10 items (rings, necks, trinkets, a belt): raises the odds of better rarities in chests and boss drops, with diminishing returns; shown in tooltips and in the totals under the doll (gear screen and panel C);
  - a legendary or mythic from a chest is named on the news line in its colour;
  - chests cost half (Petr, before the merge): 100, 112, 125, ...; without gear the autopilot wins 94 instead of 70 of 320 runs and opens almost twice as many chests;
  - chest levels count 0.25 each (permanent levels 0.15), also the first level of an item a chest gave; `npm run sim:chests` measures chest power: 15 chests give a bare level-25 hero x1.46 (hp 1.44, attack 1.48, spells 1.45).
- What Petr checks in the playtest:
  - do chests feel worth the walk now, and do the cards and rarities read (colours, the replace line);
  - does a mistake hurt now: running away should no longer be safe; is x2 too much early (the autopilot dies at 2-4 minutes, before the first miniboss);
  - the news line for a legendary or mythic from a chest;
  - Magic Find: is the stat clear in tooltips and under the doll.
- Quick links (with `debug=1` the collection starts empty and nothing is stored): https://wizzik.github.io/defense-webgame/?debug=1 after the merge; in the console `__game.debug.grantGold(5000)`, then walk to a chest; `__game.chestCards` lists the offer; `__game.debug.grantItem("seal-of-the-archivist", 5)` for Magic Find.
- **Open for Petr (wins without gear):** five heroes win 0 or 1 of 20 on both seed sets: Stonehorn, Nightglaive, Mistwarden, Sparkshot, Tidecaller (table in `docs/DECISIONS.md`). Not tuned here (spec 5.2); the shared-spells plan tunes kits to 6-12 of 20 against this state. Gravecaller still wins 20 of 20. With a rare item in every slot wins fell less (e.g. Nightglaive 18 -> 4, Sparkshot 10 -> 19); full gear wins everything.
- **Open for Petr (rulings):** chest levels count also the first level of a chest item (the plan's formula would have needed a step of about 1.25); weights common 25, rare 30, epic 37, legendary 6, mythic 2. Both are his to change in `design/rules.yaml`.
- Minor notes from the final review (not fixed): `basicItemIndex` is no longer used by the game; two cards of one offer can show the same ring or trinket; the debug snapshot caches `chestCards` per offer.
- Merged at Petr's request after halving the chest price (2026-11-18 evening), CI green.
- Next: Petr plays the live game.

## Shared spells and passives: merged (PR #16 as `d66d9a0`, 2026-11-18); waits for Petr's playtest

- All 9 tasks of `docs/superpowers/plans/2026-11-18-shared-spells-passives.md` are done (inline in one chat, one final self-review of the whole diff against spec 4.1-4.8 and `AGENTS.md`). `npm run check`, the build and the e2e project `webgl2-fallback` (31 of 31) pass. Approved and merged by Claude at Petr's word ("vše si schval, sluč a nasaď"). Numbers, sources from the map, rulings and the win table: `docs/DECISIONS.md`, section Shared spells and passives.
- What it brings:
  - 10 ability slots: the kit (0-3), two shared spells (4-5) and four passives (6-9); the new slots start empty and fill from level-up cards marked **New** (glyph, name, text, level 1 values);
  - 10 shared spells any hero can learn: Arc Lightning (a chain that leaps 2-6 times), Smite (a strike from above on the strongest enemy, bosses and elites first), Fire Bolt, Frost Ring, Meteor, Holy Ground, Blade Fan, Shock Wave, Sentry Ward, Second Wind; all cast on their own;
  - 6 passives with 5 levels: Might, Arcane Focus, Haste, Vigor, Fleet Foot, Fortune (attack, spell power, cooldowns, hp and regen, speed, gold and pickup range);
  - cards come from four weighted groups (signature 4, shared upgrade 3, new spell 2, new passive 2); attribute cards only when nothing else can be learned or raised;
  - the ability bar: signature spells, the two shared spells and the ultimate in one row, a small row of four passive glyphs under it; empty slots are dashed frames;
  - the autopilot takes the ultimate, signature, new spell, shared upgrade, new passive, passive upgrade, attribute; `sim:run` prints what it took and when the whole kit was full (median phase 19-20 of 20).
- Wins without gear, seeds 1-20 (`main` -> branch): Stonehorn 3 -> 6, Nightglaive 0 -> 4, Gravecaller 20, Serpent Shaman 9 -> 15, Mistwarden 0 -> 4, Sparkshot 1 -> 4, Redcleaver 8, Tidecaller 0 -> 3 (seeds 21-40 and 1-100 in DECISIONS). Mid gear: 258 -> 255 of 320; full gear wins all.
- What Petr checks in the playtest:
  - does the second half of a run feel full now: a real choice at every level-up, a build that differs between runs of one hero;
  - the New cards and the passive row under the ability bar (readability at 1280x720, the glyphs);
  - the effects: the Arc Lightning bolt along its leaps, the Smite flash from above;
  - the strength of shared spells next to the signature ones (target: a shared spell at level 5 is about a signature spell at level 3-4) and of the passives;
  - quick links: https://wizzik.github.io/defense-webgame/?debug=1 then in the console `__game.debug.learn(4, "arc-lightning")`, `__game.debug.learn(5, "smite")`, `__game.debug.learn(6, "might")` (passives into slots 6-9), `__game.debug.setAbilityLevel(4, 5)`; `__game.abilityIds` lists the slots.
- **Open for Petr (balance band 6-12 of 20):** Serpent Shaman reads 15 and 16 on the two seed sets, but over 100 seeds it moves only 63 -> 69 % (it already won about 13 of 20 on `main`; 9 on seeds 1-20 was luck). Nightglaive, Mistwarden, Sparkshot and Tidecaller come closer but stay under 6 on at least one set: Nightglaive and Mistwarden die at 2-4 minutes under the doubled enemy damage, before shared spells matter; closing that needs their kits. Redcleaver stays in the band but loses over 100 seeds (45 -> 35 %). Gravecaller still wins everything. Tried and dropped: weaker Arcane Focus, shared spells +30 %, signature weight 6.
- Minor notes from the final review (not fixed): the client keeps the chain's last bolt point per slot in a small growing array; `botCard` builds the slot range per card (only at offers); the spec's `move_direction` for Blade Fan and `around_self` for Sentry Ward were changed to what the updaters read (`nearest`, `densest_cluster`).
- Merged by Claude after green CI (Petr's word: approve, merge and deploy), Pages deployed.
- Next: Petr plays the live game (both PR #15 and PR #16).

## Sparkshot multishot: merged (PR #14, 2026-11-18)

- Petr's wish (2026-11-18): Searing Rounds shoots more enemies. Each base attack also hits 1, 1, 2, 2, 3 other enemies in reach (by the spell's level); the split shots deal the base attack without the burn. Rule and numbers: `docs/DECISIONS.md`, section Sparkshot multishot.
- Autopilot wins of the Sparkshot: 0 -> 10 of 20 (seeds 21-40: 1 -> 13). The other heroes are unchanged.
- What Petr checks in the playtest: does it feel like a multishot (the bolts), is the Sparkshot fun now, does it die too often (below 50 % hp in 19 of 20 autopilot runs).
- Merged as `cd54f2e`, Pages deployed. The PR also fixed the e2e test of the gear panel: a level-up offer can open right after a chest pick (it failed once on software WebGPU in CI).

## Gear, boss drops and chests: merged (PR #12 into `elite-boss-threat`, PR #13 into `main`, 2026-11-13); waits for Petr's playtest

- All 11 tasks of `docs/superpowers/plans/2026-11-13-items-gear-chests.md` are done (executed inline in one chat with one final review). `npm run check`, the build and the e2e project `webgl2-fallback` pass. Spec: `docs/superpowers/specs/2026-11-13-items-gear-chests-design.md` (section 12: what the build made precise). Numbers and the table of wins: `docs/DECISIONS.md`, section Gear, drops and chests.
- Merged at Petr's request (2026-11-13 evening). Lesson: a PR stacked on another PR's branch is merged into that branch, not into `main`, when the lower PR is merged first without deleting its branch; open PRs against `main`, one after another.
- What it brings:
  - gold coins from kills, gold and the next chest's price in the HUD;
  - 3 chests on the map (a pointer at the screen edge shows the nearest one, bright when the gold is there): pay, pick 1 of 3 gear slots; an empty slot gets a common item for this run, a worn one a level for this run;
  - C opens the gear panel in a run (the run pauses);
  - every boss drops one item (the news line names it in its rarity colour, the end screen lists the loot); it is kept when the run is lost; a duplicate raises the item's level up to 5;
  - the menu has the button Gear: the hero's doll with 16 slots, the collection of 70 items in five rarities with a filter, tooltips that compare with the worn item, export to a file and import;
  - 5 legendary and 3 mythic items with a special effect (chain lightning, splash, a shield under low hp, faster cooldowns after an elite kill, a slowing aura, gold that heals the castle);
  - the gear is stored in the browser (IndexedDB), never with `?debug=1`.
- What Petr checks in the playtest:
  - chests: is the price curve right (200, 224, 251, ...; about 12 to 16 chests in a won run), is a chest worth the walk, do the chest and its price read on the ground;
  - **chests are weak on purpose for now:** 16 chests give a hero without gear about +10 % (the spec wanted +50 % at the end of a run); stronger chests made the run without gear easier at once. Stronger chests, or keep them and make gear the main source of power? (Answered 2026-11-18: stronger chests, see the chest-loot spec at the top.)
  - the gear screen: readability, the icons (own simple glyphs), the doll (one blue-grey figure for every hero), the tooltip;
  - the names of the 70 items (EN and CS) and the texts of the eight effects;
  - how strong gear feels: a rare item in every slot already wins most autopilot runs; the best gear at level 5 is about 2x hp, attack and spells at hero level 25.
- Quick links (with `debug=1` the collection starts empty and nothing is stored):
  - https://wizzik.github.io/defense-webgame/?debug=1&phase=6 : first miniboss at once; kill it for a drop, or `window.__game.debug.killBoss()` in the console;
  - console helpers: `__game.debug.grantGold(2000)`, `__game.debug.grantItem("skysplitter", 5)` (ids are in `design/items.yaml`), `__game.debug.clearGear()`.
- **Open for Petr 1 (balance without gear):** with chests the autopilot wins about as before for six heroes; Nightglaive swings (2 and 9 of 20 on the two seed sets, 8 and 4 before) and the Tidecaller gains (7 and 5, before 2 and 3). Sparkshot still won none without gear (closed by the multishot, 2026-11-18).
- **Open for Petr 2 (chest power):** answered by the chest-loot spec (2026-11-18).
- Left from the final review as minor notes (not fixed): the drop rides on the event buffer (a full buffer of 1024 events would lose it); stored data of another version loads as empty and the first drop overwrites it; a write that fails later in a session turns saving off without a word; the export revokes its link right after the click; pack arrows hide while a chest slot is chosen; the gear screen builds a whole run for the totals on every click; a chest's fallback place skips the spacing check; a chest can put the same common ring into both ring slots.
- Later, not in this plan: difficulties as a combination of another environment and a chosen difficulty (Petr, 2026-11-12); they are meant to take up the power of gear.

## Elite and boss threat: merged (PR #11, 2026-11-13); waits for Petr's playtest

- Why: Petr's playtest of 2b-3 (elites too weak, running away kills everything, bosses cannot reach or catch the hero). Spec: `docs/superpowers/specs/2026-11-12-elite-boss-threat-design.md`; numbers and the balance table: `docs/DECISIONS.md`, section Elite and boss threat.
- What it brings: elites hunt the hero and charge; minibosses hunt the hero; every boss strikes from afar with a 1 s warning circle on the hero (three of them leap into it, the Gunmaster shoots). `npm run check`, the build and the e2e project `webgl2-fallback` pass.
- What Petr checks in the playtest: is running away still safe; is 1 s enough to leave the circle; are the elites and the first boss (4:10) too hard now; do minibosses still die too fast (about 20 s for the autopilot, their hp did not change). Quick links: `?debug=1&phase=6` (first miniboss), `&phase=4` (elite rush after 30 s), `&phase=21` (finale).
- Next: Petr plays.
- Open: the Tidecaller fell from 14 to 2 autopilot wins of 20; Sparkshot still wins none.

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
3. Then the rest of 2b: 20 phases, elites and bosses are done (2b-3); factions and difficulties remain. Gold, chests, items and the collection (parts of 2c economy and 2e meta progression) are merged. Then the rest of 2c, 2d shared abilities, the rest of 2e.
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
