# Status

Updated 2026-11-28 (new heroes, batch 2). Read this first when you resume work.

## Order (Petr, 2026-11-26)

1. **Solo playtest batch** (this branch, below): defence circle, level scaling, ranged reach, Redcleaver, ultimates,
   wards, 10 spell levels, tooltip, dash charges, blink (F), weather fixed to the map. Waits for Petr's playtest.
2. **Random items** like Diablo 2 / Project Diablo 2 with game-icons.net pictures: the spec
   `docs/superpowers/specs/2026-11-26-random-items-design.md`, approved by Petr on 2026-11-27 (answers in its section 9); plan `docs/superpowers/plans/2026-11-27-random-items.md` (6 stages), to build in fresh sessions.
3. **Petr's batch 2** (2026-11-27, done in PR #43, waits for the playtest): plan `docs/superpowers/plans/2026-11-27-petr-batch-2.md` (AoE -50 %, a quarter
   of the enemies casters, Serpent Totem 100 damage + 25 % a level, F teleports to the mouse, bosses x3 hp x2
   damage with their own names and looks per world, chest cards for worn slots only as upgrades, balance target
   about 10 % autopilot wins with no gear). After stage 3 of random items, before its stage 4.
4. Then the remaining heroes of the map and better spell graphics (from the order of 2026-11-23). **Heroes: plan
   `docs/superpowers/plans/2026-11-28-new-heroes.md` (36 heroes, 9 batches of 4); batch 1 DONE on branch
   `claude/new-heroes-1` (below), batch 2 next after Petr's playtest.** Spell graphics: not started.
5. **English only for now** (Petr, 2026-11-27): new texts need no Czech (DECISIONS, English only).
6. **Random items stage 4 and the damage meter** (PR #45, merged 2026-11-27, below).
7. **Petr's batch 3** (2026-11-27, after the 3-player playtest), DONE on `main` (below), waits for Petr's playtest:
   co-op restart, no white hit flash, weaker co-op scaling, spell levels 6 (ultimates 3, passives 5) with STR / AGI /
   INT cards after, level 60-70 at the end of a run, wards x5. Then Sentry Ward = Serpent Totem (10 s / 15 s),
   dash 3 charges from level 10, blink from 20, and random items stage 5 (balance), DONE on `main`.
   Random items stage 6 (icons) DONE on `main` (below): the random items plan is complete.
8. **Co-op gear between runs and group strength by size** (Petr, 2026-11-28; branch `claude/peaceful-galileo-qtu26s`,
   below). Then the remaining heroes of the map and better spell graphics (point 4).
9. **Named items only legendary / mythic, salvage for named items** (Petr, 2026-11-28): plan
   `docs/superpowers/plans/2026-11-28-named-items-legendary.md`, branch `claude/named-items-legendary` (from
   `claude/peaceful-galileo-qtu26s`), DONE (below), waits for Petr's playtest.

## New heroes, batch 2 (branch `claude/new-heroes-2`, PR #49 on top of batch 1 / PR #48, DONE, waits for Petr's playtest, 2026-11-28)

- Four more heroes of the map with our names: **Ashsinger** (INT ranged, bouncing shots: Cinder Wave, a ring of fire,
  Ember Comet; ultimate Phoenix Wrath), **Thunderhoof** (STR melee, cleaving axe: Ground Surge, Hoofstomp stun, Long
  March; ultimate Aftershock, a stunning ring after every spell), **Stormseer** (INT ranged: Spirit Pack wolves,
  Squall, Dread Call stun; ultimate Last Rites), **Mirrorblade** (AGI melee, two cleaving blades: Twin Shades and
  Mirror Dance copies, Flash Cut crits; ultimate Steel Cyclone). KayKit models of their own, our icons.
- Balanced by the damage meter as Petr asked (2026-11-28): spells 8-17 %, ultimates 15-25 %, the base attack 7-15 %,
  1-4 wins of 20 with no gear; table in `docs/DECISIONS.md`, section New heroes, batch 2. New mechanics: a
  bouncing base attack (`attack.bounce`, opt-in) and a stun on `nova`. Old heroes unchanged (the 24 older matrix cases
  are identical); digest `fa5a1ee3` -> `b04f8455`. `data/generated/` built by `npm run data:build` from v20.83.
- Then (Petr: yes to both): Nightglaive, Gravecaller, Sparkshot, Tidecaller and Frostweaver shoot bouncing shots, and
  batch 1 is retuned by the meter rule (Crossing Strike 31 %, Dawnhammer's faster attack, a stronger Ice Fall and
  Judgement); new powers in `docs/DECISIONS.md`, section Bouncing shots for the older ranged heroes. Digest ->
  `41172dce`. This PR now carries batch 1's final numbers: merge #49 (it holds #48's commits) or #48 first.
  - check the bounce: https://wizzik.github.io/defense-webgame/?debug=1&hero=sparkshot&phase=8 and
    https://wizzik.github.io/defense-webgame/?debug=1&hero=nightglaive&phase=8 (each shot leaps to 4 more enemies).
- **What Petr checks** (after the merge of #48 and this PR):
  - the menu shows 16 heroes: https://wizzik.github.io/defense-webgame/
  - Ashsinger (shots leap between enemies, a fire ring around her, a slow wide comet):
    https://wizzik.github.io/defense-webgame/?debug=1&hero=ashsinger&phase=8
  - Thunderhoof (fast cleaving chops, stomps stun, every spell sends a shock ring once the ultimate is learned):
    https://wizzik.github.io/defense-webgame/?debug=1&hero=thunderhoof&phase=8
  - Stormseer (wolves by the crowd, lightning around him, the call stuns the crowd, Last Rites):
    https://wizzik.github.io/defense-webgame/?debug=1&hero=stormseer&phase=8
  - Mirrorblade (two quick cleaving blades, copies at his side, the cyclone):
    https://wizzik.github.io/defense-webgame/?debug=1&hero=mirrorblade&phase=8 and from the start
    https://wizzik.github.io/defense-webgame/?debug=1&hero=mirrorblade
  - the damage meter in the run shows the shares above; say which spell feels too weak or strong.

## New heroes, batch 1 (branch `claude/new-heroes-1`, DONE, waits for Petr's playtest, 2026-11-28)

- Four heroes of the map with our names: **Razorwind** (AGI melee: cleave, crits, a frenzy aura; ultimate Crossing
  Strike), **Dawnhammer** (STR melee: Holy Burst, Judgement, Fan of Light; ultimate Dominion), **Frostweaver** (INT
  ranged: Frost Slice, Frost Slap chain, Chill Field slow aura; ultimate Ice Fall), **Deadeye** (AGI ranged: spread
  shots, Blasting Powder stuns, Hot Blood; ultimate Doubles, up to 6 copies). KayKit models of their own, our icons.
- New spell mechanics: critical strike and cleave on `on_hit`, a slowing `aura`. Old heroes unchanged (the 20 older
  matrix cases are identical); digest `82150491` -> `fa5a1ee3` (four new cases). Numbers and the balance table:
  `docs/DECISIONS.md`, section New heroes, batch 1 (2-4 autopilot wins of 20 with no gear each).
- `data/generated/` was built by `npm run data:build` from the v20.83 export in the cloud (`constants.json`
  `mapVersion` v20.75 -> v20.83, nothing else changed for the older data).
- **What Petr checks** (after the merge):
  - the menu shows 12 heroes: https://wizzik.github.io/defense-webgame/
  - Razorwind: two quick blades, cleave around the target, crit numbers, the ultimate hits the crowd:
    https://wizzik.github.io/defense-webgame/?debug=1&hero=razorwind and later
    https://wizzik.github.io/defense-webgame/?debug=1&hero=razorwind&phase=8
  - Dawnhammer: https://wizzik.github.io/defense-webgame/?debug=1&hero=dawnhammer&phase=8
  - Frostweaver (enemies near you walk slower with Chill Field, the frost hand leaps):
    https://wizzik.github.io/defense-webgame/?debug=1&hero=frostweaver&phase=8
  - Deadeye (each shot hits more enemies, copies at the ultimate):
    https://wizzik.github.io/defense-webgame/?debug=1&hero=deadeye&phase=8
  - each hero with no gear should be hard, like the older ones; say which kit feels dull or too strong. The spells
    reuse the older effects and sounds until the spell graphics task.

## Named items only legendary / mythic, salvage for named items (branch `claude/named-items-legendary`, DONE, 2026-11-28)

- The 70 named items are 48 legendary and 22 mythic (every slot type has both); new stats by the budget, an effect on
  every item, five new effect kinds (heal on kill, nova when hit, elite slayer, death burst, castle ward); random
  mythics roll them too. Old saves keep id and level, the item shows its new rarity and is stronger.
- **Salvage** takes named items too (any item no hero wears): gold = rarity's salvage gold x level (legendary 90,
  mythic 150 per level; the bank holds 500). A salvaged named item can drop again.
- `sim:run --gear mid` = a legendary named item of level 1 per slot. Balance numbers: `docs/DECISIONS.md`, section
  Named items only legendary / mythic. The named full set is stronger than a random mythic set (world 3 hell: 33 vs
  23 autopilot wins of 80); Petr: the named items stay the top, the random mythic budget stays 34.
- Digest `62622e34` -> `82150491`. `data/generated/items.json` and `rules.json` edited in the cloud by the data-build
  rule: **run `npm run data:build` locally and check that nothing changes.**
- **What Petr checks** (after the merge, https://wizzik.github.io/defense-webgame/):
  - the gear screen: https://wizzik.github.io/defense-webgame/?debug=1 then in the console
    `__game.debug.grantItem("travelers-hood", 1); __game.debug.grantItem("hood-of-the-night-watch", 3)` and open
    Gear: the hood is Legendary, the night watch Mythic, the tooltip has 4 / 5 rows and an effect line;
    the rarity filters L / M show all 70 items, C / R / E none of them;
  - the new effects in a run: https://wizzik.github.io/defense-webgame/?debug=1&hero=redcleaver&phase=8 then
    `__game.debug.wear("hands", "masons-grip")` (heal every 10th kill), `__game.debug.wear("back", "banner-cloak-of-the-keep")`
    (mythic nova when hit), `__game.debug.wear("wrist", "bindings-of-the-high-tide")` (mythic death burst),
    `__game.debug.wear("legs", "trackers-leggings")` (elite slayer), `__game.debug.wear("chest", "bulwark-plate")`
    (mythic castle ward): the damage meter (N) shows the item row grow; C shows the effect lines;
  - **salvage a named item**: https://wizzik.github.io/defense-webgame/?debug=1 then
    `__game.debug.grantItem("skysplitter", 2)`, Gear, Salvage, hover Skysplitter ("Salvage: 180 gold"), click it:
    "Bank: 180 gold", the item is no longer owned; without `debug=1` the bank goes into the next run;
  - an old save: your own collection in the browser (without debug) shows the former common / rare / epic items as
    legendary / mythic with the same levels.

## Co-op gear between runs and group strength by size (branch `claude/peaceful-galileo-qtu26s`, DONE, 2026-11-28)

- The end screen of a co-op run has **Gear for the next run** (host and guests): wear what the run dropped, Back
  returns to the end screen; the host's Again starts the next run with everyone's new gear (protocol version 6).
- `rules.coop.extraPlayers` [1, 1.7, 2.4]: 3 and 4 players count as 1.7 and 2.4 extra players (was 2 and 3).
  Autopilot wins without gear: 2 players 20 %, 3 players 9 % -> 25 %, 4 players 1 % -> 16-25 %, solo 25 %.
  Numbers: `docs/DECISIONS.md`, section Co-op gear between runs and group strength by size.
- `data/generated/rules.json` edited in the cloud (one new row, `coop.extraPlayers`): **run `npm run data:build`
  locally and check that nothing changes.**
- **What Petr checks** (after the merge, https://wizzik.github.io/defense-webgame/):
  - co-op with a friend (both pages need the new version, protocol 6): play until the run ends; both end screens show
    **Gear for the next run**; the guest wears another item, goes Back, the host presses **Again (same group)**: the
    guest's new run wears the new item (C in the run shows it);
  - 3 and 4 players without gear on normal feel about as hard as 2 players, not much harder.

## Random items stage 6: item icons (straight to `main`, DONE, 2026-11-27)

- Every item base (46) and named item (70) has a picture from game-icons.net (CC BY 3.0), 104 files, 180 kB in all
  (`assets/icons/<author>-<icon>.svg`, test budget 600 kB). The mapping is `client/ui/item-icon-names.ts`;
  `npm run assets:icons` fetches the files at the pinned commit into `assets-source/icons/` (untrusted, read as text
  only), keeps only plain `<path>` data (a strict check, the black background square dropped), writes one path filled
  with `currentColor` and rewrites the icon rows of `assets/LICENSES.md` with the authors.
- The icon is a CSS mask filled with the rarity colour (the frame colour stays); a random item shows its base's
  icon; empty slots and the slot filters keep our glyphs. Shown in the gear screen's collection and doll, the in-run
  gear panel (C), the chest cards and the keep / take compare. Credits line in the menu (icon authors, KayKit).
- **What Petr checks:**
  - the gear screen with a few items: https://wizzik.github.io/defense-webgame/?debug=1 then in the console
    `__game.debug.grantItem("skysplitter", 3); __game.debug.grantRolled("head", "mythic", 12)` and open Gear: each
    picture readable at that size, in its rarity colour;
  - chest cards and the compare: https://wizzik.github.io/defense-webgame/?debug=1&phase=5 then
    `__game.debug.grantGold(2000)` and walk to a chest;
  - any icon that fits badly: say the item and I swap the picture (one line in `client/ui/item-icon-names.ts`).
  - the Credits line at the bottom of the menu.

## Sentry Ward, dash, blink and random items stage 5 (straight to `main`, DONE, 2026-11-27)

- Sentry Ward has Serpent Totem's numbers and lives 10 s, a serpent totem 15 s; dash 3 charges from level 10, blink
  from level 20; hero power tuned again (2-5 autopilot wins of 20 each). Stage 5: `sim:run --gear rolled-mid |
  rolled-full`, crit damage from gear capped at +150 %, a random mythic's budget 34. Numbers: `docs/DECISIONS.md`,
  sections Random items, stage 5 and Sentry Ward, Serpent Totem, dash and blink.
- **What Petr checks:**
  - Sentry Ward (any hero, a shared spell) and Serpent Totem: many wards, short-lived (10 s and 15 s), similar damage:
    https://wizzik.github.io/defense-webgame/?debug=1&hero=serpent-shaman&phase=8 and in the console
    `__game.debug.learn(4, "sentry-ward")`;
  - 3 dash charges from level 10, F from level 20: https://wizzik.github.io/defense-webgame/?debug=1&phase=6
  - a mythic random item feels like a named one, crits not absurd:
    https://wizzik.github.io/defense-webgame/?debug=1 then `__game.debug.grantRolled("weapon", "mythic", 12)` and wear it
    in the gear screen.
- Generated json edited in the cloud again (`abilities.json`, `heroes.json`, `rules.json`): **run
  `npm run data:build` locally and check that nothing changes.**

## Petr's batch 3 (straight to `main`, DONE, 2026-11-27)

Plan `docs/superpowers/plans/2026-11-27-petr-batch-3.md`; rulings and numbers in `docs/DECISIONS.md`, section Petr's
batch 3. `npm run check` (1434 tests) on every commit, e2e `webgl2-fallback`, `npm run shots`.

- **Done:**
  - no white flash on hit (task 2);
  - co-op **Again (same group)** for the host after a run ended; guests wait ("Waiting for the host...") or Leave
    (task 1); tested by hand in two windows over a local PeerServer, no desync;
  - spells 6 levels, ultimates 3, passives 5, level 1 and top unchanged; a full kit offers STR, AGI, INT in that
    order (task 4);
  - wards x5: Serpent Totem 20-30, Sentry Ward 5-15 alive (task 6);
  - XP curve with a square term (`xpQuad` 0.3): a won run ends at level 65-69; co-op XP x 1 / pack-size multiplier,
    the same curve, a won 3-player run ends near 66 (task 5);
  - balance pass by hero `power`: 2-4 autopilot wins of 20 per hero with no gear (task 7);
  - co-op enemies per extra player hp +0.5, damage +0.22 (was 0.9 / 0.45): 3 players without gear win about as often
    as one hero (task 3).
  - Digest `f0490b01` -> `4d1136d4`.
- **Generated data edited in the cloud** (no `data-source/`): `abilities.json`, `heroes.json`, `rules.json` by the
  data-build rule. **Petr: run `npm run data:build` locally and check that `data/generated/` does not change.**
- **Not done / open:** a guest keeps the gear of the last start on Again (to change gear he leaves and joins again);
  2 players are easier (35 % autopilot wins) than 3 (18 %) and 4 (8 %) with one linear rule.
- **What Petr checks** (https://wizzik.github.io/defense-webgame/):
  - enemies hit by spells: no white flash, the type colours and the red bloodlust stay:
    https://wizzik.github.io/defense-webgame/?debug=1&phase=3
  - co-op: Host, two friends join, play until everyone is down; the host's end screen shows "Again (same group)",
    the guests "Waiting for the host"; Again starts a fresh run with the same heroes in every window; a guest who
    pressed Leave is not in it. Locally: https://wizzik.github.io/defense-webgame/?debug=1&mate=gravecaller,tidecaller
    then `__game.debug.down(0); __game.debug.down(1); __game.debug.down(2)` and Play again;
  - spell tooltips show "Level N / 6" (ultimates / 3, passives / 5); maxed spells feel as strong as before; late
    level-ups offer STR, AGI, INT in that order: https://wizzik.github.io/defense-webgame/?debug=1&phase=18
  - Serpent Shaman holds many more totems (up to 30), Sentry Ward up to 15:
    https://wizzik.github.io/defense-webgame/?debug=1&hero=serpent-shaman&phase=10
  - level at the end of a run about 60-70 (solo and in 3-player co-op), far fewer clicks;
  - 3-player co-op without gear on normal is winnable, with full gear easy.

## Random items stage 4 (client) and the damage meter (branch `claude/random-items-client`, DONE, 2026-11-27)

Plan `docs/superpowers/plans/2026-11-27-random-items.md`, tasks 15-17; rulings in `docs/DECISIONS.md`, sections
Damage meter and Random items, stage 4. English only. `npm run check` passes on every commit of the branch.

- **Done:**
  - task 15: random items say "<Rarity> random item" and mark each affix row T1-T4 in tooltips, chest cards and the
    keep / take compare;
  - task 16: gear screen filters by role and rarity (plus slot), sort by power, at most 200 shown, **salvage** mode
    (a random item nobody wears -> 10-150 gold into a bank of at most 500, the next solo run starts with it);
  - task 17: `window.__game.gear[].rows`, `debug.grantRolled(slot, rarity, power)` (AGENTS.md);
  - **damage meter** (Petr's wish mid-session): a panel of bars per source (spells, attack, item effects, thorns)
    with damage, share, total and DPS; N toggles it; the end screen lists the top five; `window.__game.meter`;
    `sim:run` prints a `meter` line per hero.
  - **co-op lobby** (Petr's wish): Gear and Settings buttons; a worn random item now travels to the teammates
    (protocol version 5), before it was left out of their windows;
  - Digest `fa569e92` -> `f0490b01` (matrix case `loot-t3` starts with 300 gold; the meter itself changes nothing).
- **Checks:** `npm run check` (1425 tests), e2e `webgl2-fallback` (gear, chest, random item, damage meter specs),
  `npm run shots`.
- **What the meter already says** (autopilot, no gear, seeds 1-3): Stonehorn rock-rupture 49 %, Nightglaive
  falling-stars 37 %, Gravecaller grave-grasp 55 %, Serpent Shaman forked-bolt 60 %, Mistwarden soul-burst 82 %.
- **What Petr checks** (after the merge, https://wizzik.github.io/defense-webgame/):
  - **damage meter**: https://wizzik.github.io/defense-webgame/?debug=1&hero=tidecaller&phase=5 - the panel on
    the right fills with bars, hover one for hits and the top hit, N hides it; at the end of a run (lost or won)
    the five biggest sources stand on the end screen;
  - **random item tooltips**: https://wizzik.github.io/defense-webgame/?debug=1 then in the console
    `__game.debug.grantRolled("head", "mythic", 12)` and open Gear: the hover says "Mythic random item", the rows
    have coloured T1-T4 marks, the effect line under them;
  - **filters and sort**: grant a few (`grantRolled("ring1", "rare", 3)`, `grantRolled("chest", "epic", 6)`), try
    the STR / AGI / INT / Neutral and C / R / E / L / M buttons and "Sort: power";
  - **salvage**: click Salvage, then a random item that no hero wears: it is gone and "Bank: N gold" grows; start a
    run: the gold counter starts with it (`debug=1` keeps nothing between pages, so try it without debug for the
    real save);
  - **co-op lobby**: menu Co-op -> the Gear and Settings buttons; with a friend (or two windows), wear a random
    item in the lobby's gear screen, host and join: the teammate's window shows your item (C in the run);
  - **chest compare with tiers**: `?debug=1&phase=12&world=3&difficulty=insane`, `__game.debug.grantGold(5000)`,
    open chests: the cards and the compare show T marks.

## Petr's batch 2 (branch `claude/petr-batch-2`, PR #43, DONE, waits for Petr's playtest, 2026-11-27)

Plan `docs/superpowers/plans/2026-11-27-petr-batch-2.md`; rulings and the autopilot tables in `docs/DECISIONS.md`,
section Petr's batch 2. `npm run check` passes on every commit of the branch.

- **Done:**
  - task 1, AoE -50 %: `design/scaling.yaml` `abilities.areaScale: 0.5` (radius, hitRadius, width, endWidth of every
    ability);
  - task 3, Serpent Totem: 100, 125 ... 325 over the ten levels;
  - task 4, blink: F teleports to the mouse at any distance (`rules.hero.blink.aheadDistance` without a mouse
    point), a flash at both ends, no streak; e2e "F teleports the hero ...";
  - task 5, first half: bosses x3 hp, x2 damage (`enemies.bossHp`, `bossDamage` in scaling.yaml);
  - task 6, chests: a card never offers a rarity at or below what its slot wears (Level card with
    `rules.loot.upgradeShare` 0.5, else it moves to a slot where it is an upgrade; mythic slots only Level);
    fix on the way: enemies push out of islands with at most `PASS_MARGIN`, so a big boss no longer sticks in a gap;
  - task 5, second half: worlds 2-5 have their own four bosses (`design/worlds.yaml` `bosses`: name, borrowed model,
    tint, size, ring colour; `client/render/boss-looks.ts`, `client/ui/boss-name.ts`); the sim type per slot and
    `rules.drops` stay (keyed by the slot's type); `window.__game.boss.name`.
  - task 2, casters: Battle Mage, Fire Caller, Bone Acolyte, Moon Priestess (`caster: true`, skirmish, own KayKit
    models, faction-coloured spell bolts and cues), 25-28 % of the phase mix from phase 3 (`data/generated.test.ts`);
    model budget 10 -> 11 MB;
  - the autopilot kites (Petr, mid-session): ranged heroes keep 60 % of their reach (max 450) from the nearest enemy,
    run to the emptiest side (every enemy within 1000, weight 1/d^2) and sideways towards the castle, dash out of a
    crowd of 4 within 220; melee heroes (Stonehorn, Redcleaver) never back off and take half (`damageTaken` 0.5);
    Serpent Shaman shoots (`attack: { kind: ranged, range: 1200 }` in heroes.yaml, data-build override);
  - balance knob `power` per hero (heroes.yaml, multiplies the base attack and spell power);
  - task 7, balance: line spells and cones aim themselves at the thickest crowd (Petr), Falling Stars is an area at the
    crowd, Rocket Fan a self-aimed cone, per-hero `power`; autopilot with no gear, seeds 1-20: 2-4 wins of 20 for
    every hero (23 of 160); table in DECISIONS;
  - Digest now `fa569e92`.
- **Checks:** `npm run check` (1408 tests), e2e `webgl2-fallback` (52; the orb test now picks level-up cards while
  it waits for the berserk buff), `npm run shots` (the `fight` shot at 15 s: an idle Stonehorn with no gear falls at
  about 23 s).
- **Open question for Petr:** with no gear most autopilot losses come in the first 4 minutes, and an idle hero falls
  in under half a minute; a run that survives phase 4 usually wins. If a fresh player should last longer, the
  next knob is the early phases (spawn rate or enemy hp in phases 1-4), not hero power.
- **What Petr checks** (after the merge, https://wizzik.github.io/defense-webgame/):
  - **spells aim themselves**: Tidecaller's wave and Stonehorn's rupture go into the thickest pack, also while you
    run away (https://wizzik.github.io/defense-webgame/?debug=1&hero=tidecaller&lang=cs and
    https://wizzik.github.io/defense-webgame/?debug=1&hero=stonehorn&lang=cs);
  - **Falling Stars** (Nightglaive) fall on the crowd within 800, not around you
    (https://wizzik.github.io/defense-webgame/?debug=1&hero=nightglaive&lang=cs); **Rocket Fan** (Sparkshot) is a fan
    that aims itself at the crowd (https://wizzik.github.io/defense-webgame/?debug=1&hero=sparkshot&lang=cs);
  - **balance with no gear** (a fresh browser or `debug=1`): each hero should be hard, the autopilot wins about one
    run in seven; does it feel too hard in the first minutes;
  - spell circles half as big (https://wizzik.github.io/defense-webgame/?debug=1&phase=10&lang=cs), the shaman's
    totem tooltip shows 100 at level 1 and the shaman shoots;
  - F teleports to the mouse from level 40 (https://wizzik.github.io/defense-webgame/?debug=1&phase=20&lang=cs, aim
    far and press F);
  - bosses: much tougher (https://wizzik.github.io/defense-webgame/?debug=1&phase=6&lang=cs); world 2 has its own
    boss "Dunový pustošitel" (https://wizzik.github.io/defense-webgame/?debug=1&world=2&phase=6&lang=cs), worlds 3-5
    too (`world=3`, `4`, `5`);
  - chest cards for a worn slot are only Level cards or higher rarities (`__game.debug.grantGold(5000)`);
  - casters from phase 3 (https://wizzik.github.io/defense-webgame/?debug=1&phase=3&lang=cs, blue bolts with a
    flash; `__game.debug.spawnEach()` shows all seven human types).

## CI in parallel jobs (branch `claude/ci-parallel`, 2026-11-28)

- Petr: "can the CI checks be faster?". One serial job took 32 min (e2e 28.5). Now `unit` (typecheck, vitest,
  python) and seven e2e jobs run side by side: webgl2-fallback and webgpu-swiftshader in three shards each,
  sim-chromium, sim-firefox, sim-webkit; each installs only its browser. `playwright.config.ts` `fullyParallel: true`
  so a shard splits by test (workers stay 1, tests still run one at a time). Local `npm run e2e` is unchanged.
- Two shards: 12 min; three shards: 11.3 min (the first webgl2 third holds the heaviest tests). Merged as PR #50.

## Older entries

Finished work before 2026-11-26 (and the random items stages 1-3, the solo playtest batch): `docs/archive/status-2026-11-04-to-27.md`.
Read it only when a task needs the history of a feature; `docs/DECISIONS.md` holds the rules that still apply.

## Open questions for Petr

- Branch previews (Cloudflare Pages, spec §4) need his Cloudflare account. Until then the game is played from `main` after a merge.
- Branch protection for `main` is a GitHub setting he controls.
- The WebGPU e2e project runs only in CI (it fails in the cloud container for an environmental reason); the local gate is `--project=webgl2-fallback`.

## Environment notes (cloud container)

- `gh` GraphQL does not work here; use the REST API (`gh api`), for example `gh api -X POST repos/Wizzik/defense-webgame/pulls ...`. A draft PR cannot be marked ready without GraphQL, so open PRs as ready or close and reopen them.
- Commits must use the identity `Claude <noreply@anthropic.com>` (set in the repo's git config), or GitHub shows them as Unverified. Add the session's co-author trailers.
- Push access: `add_repo` with `access: push` is sometimes refused by the auto-mode classifier (it worked in the 2b-1 planning chat and was refused in both 2b-2 execution sessions). Without it nothing can be pushed; tell Petr.
- The shell cannot reach github.io or Actions artifact storage. Check the live site with WebFetch, or measure it on Petr's computer through the desktop app's built-in browser (`javascript_exec` can read `window.__game` and time frames).
- The map (v20.83) is in the private repository `Wizzik/wizziks-assets` (`maps/X_Hero_Siege_F-Day_v20.83_AI.w3x`): `add_repo` it (read), clone it to `/home/user/wizziks-assets`, run `npm run map:extract -- /home/user/wizziks-assets/maps/X_Hero_Siege_F-Day_v20.83_AI.w3x v20.83` (output `data-source/v20.83/out/`, untracked). Then **`npm run data:build -- --source data-source/v20.83/out --out data/generated` works in the cloud** (checked 2026-11-28: the same data as the repo but `constants.json` `mapVersion`). Never commit the map or the export. `.claude/settings.json` denies reading `data-source/` with the file tools; query it with `python3 -I -c` / `node -e` (AGENTS.md).
- Playwright uses the pre-installed Chromium (`/opt/pw-browsers/chromium-1243`), so `@playwright/test` stays at 1.63.0.

## Resume after a break

Read this file, then the task you are on in the current plan, then `git log --oneline -15`. During execution the SDD ledger at `.superpowers/sdd/<plan>/progress.md` lists the finished tasks; trust it and git over memory.
