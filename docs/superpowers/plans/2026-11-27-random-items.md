# Random items: implementation plan

> For agentic workers: one task = one commit (or a few), `npm run check` before each. Read only the files a task names.

**Goal:** Diablo-like random items next to the 70 named items, as approved in
`docs/superpowers/specs/2026-11-26-random-items-design.md` (Petr's answers in its section 9).

**Branch:** a new `claude/...` branch per session, one draft PR for the whole plan (or one per stage when a stage is big).

## Architecture in one paragraph

An item instance is either **named** (index into `data.items`, as now) or **rolled** (a base + rarity + affix rows).
In the run, `GearState` (`sim/gear.ts`) gets per-slot typed arrays for rolled rows (`rowStat: Int8Array(16 x 5)`,
`rowValue: Float32Array(16 x 5)`, `rowCount`, `base: Int16` base index, `effect: Int8` effect kind or -1), and
`recomputeGear` sums named stats or rolled rows the same way. Chests roll with `run.chestRng`, so the step never
allocates more than the card offer already does. Between runs `meta/` keeps a list of item records (save version 2).

## Data (stage 1)

1. `design/item-bases.yaml` + `data/schema/item-base.ts`: ~45 bases, 3-4 per slot type: `id`, `name` (EN, CS),
   `gender` (`m` | `f` | `n`, for CS adjectives), `slotType`, `flavour` (`str` | `agi` | `int` | `any`), `implicit`
   (`{ stat, value }`, 2 budget points), `icon` (game-icons.net name, stage 6).
2. `design/affixes.yaml` + `data/schema/affix.ts`: per stat: `tags` (roles), `tiers` (T1-T4 values at item level 1;
   T4 ~ 2x T1), `minPower` per tier, and name parts: `prefix` (EN; CS in three genders) or `suffix` ("of the Bear",
   "medvěda"). Lifesteal is tagged str, agi and int (Petr 2026-11-27; one lifesteal for attacks and spells).
3. `rules.loot` in `design/rules.yaml`: `smartShare: 0.6`, `collectionLimit: 200`, `salvageGold` per rarity,
   `namedShare` per rarity (epic 0.1, legendary 0.25, mythic 0.4), `affixCount` per rarity (1, 2, 3, 4, 4 + effect),
   item power per source (boss order, chest phase, world, difficulty).
4. data-build: copy bases, affixes and loot rules into `data/generated/items.json` (or new `bases.json`,
   `affixes.json`); no map involved, so this stage can run `data:build`-free in the cloud as a pure copy step.
5. Tests: schema, budget check per rarity and tier (`data/generated.test.ts`: every possible roll stays within 10 %
   of its rarity budget), CS names have all three genders.

## Sim (stage 2)

6. New stats one at a time, each with a test and a budget price in the items header: `critChance`, `critDamage`
   (AGI; hero attack in `sim/hero.ts`), `dodge` (AGI; `damageHero`), `damageTaken` (STR, a share off), `thorns`
   (STR; melee hits on the hero), `cooldownSpeed`, `ultimateCooldown`, `areaSize` (INT; ability radius reads).
   `GearBonus` and `STAT_IDS` grow; every existing item keeps its numbers (digest of the named-item cases unchanged
   until chests change).
7. `sim/item-roll.ts`: `rollItem(run, slotType, rarity, power, heroPrimary, out)` writes into a slot's typed rows:
   pick base (flavour weighted by smart share), affixes without repeats (60 % from the hero's primary tags), tiers
   allowed by power, value uniform within the tier (seeded `Rng`, no `Math.pow`).
8. Chests (`sim/chests.ts`): a card offers a named item with `namedShare`, else a rolled one; compare / keep / take as
   now. `ChestCard` carries a rolled preview (small object, allocated only with the offer).
9. Gear effects: a mythic roll picks one of the six effect kinds of `sim/gear-effects.ts` with fixed numbers per kind.
10. `stateHash` mixes the rolled rows; new matrix case with chests on; update the digest.

## Meta and saves (stage 3)

11. `meta/item-record.ts`: `{ uid, named?: id, base?, rarity, level, rows?: [stat, value][], effect? }`.
12. `meta/save.ts` version 2: `items: ItemRecord[]` (at most `collectionLimit`), `loadouts` by `uid`; version 1
    `{ id: level }` turns into named records; tests for the migration and for broken data (never throws).
13. `meta/drop.ts`: boss drops roll records (named share, else rolled by the boss's item power), seed = run seed +
    boss order as now; a full collection still drops, the end screen asks to salvage first (stage 4).
14. `LoadoutEntry` carries either a named id + level or a rolled record; `loadGear` fills the typed rows.

## Client (stage 4)

15. Tooltips and compare (`client/ui/item-tooltip.ts`, `chest-compare*.ts`): rolled names (EN, CS with gender),
    rows, tier colour hint, effect line.
16. Gear screen: collection grid with filters (slot, role, rarity), sort by power, **salvage** button (gold for the
    next run's first chests: `progress` keeps `bankGold`, the run starts with it), limit 200 shown.
17. `window.__game`: `gear` slots get `rows` for rolled items; debug `grantRolled(slot, rarity, power)`.

## Balance (stage 5)

18. `tools/sim-run/gear-presets.ts`: `--gear rolled-mid|rolled-full` built from seeded rolls; `sim:chests` with rolled
    items; target as the spec: a rolled rare set ~ the old mid preset, best rolled mythic set within the old full
    preset +10 %. Table in `docs/DECISIONS.md`.

## Icons (stage 6)

19. `tools/assets-build/icons.ts`: pinned commit of the game-icons.net repository (CC BY 3.0), list of icon names
    per base and per named item, fetch into `assets-source/icons/` (untrusted, never run), optimise into
    `assets/icons/*.svg` (strip metadata, `currentColor` fill), licence rows with authors in `assets/LICENSES.md`,
    a Credits line in the menu. Budget test: all icons under 600 kB.
20. `client/ui/item-icons.ts` draws the base's or the named item's icon in the rarity colour; the slot glyph stays as
    the fallback.

## Done when

- `npm run check`, build, e2e (gear, chest, collection specs updated) pass; digest updated on purpose.
- `docs/STATUS.md` lists what Petr checks: chest cards with rolled names, the CS names, salvage, the limit,
  smart loot for each role, icons.
