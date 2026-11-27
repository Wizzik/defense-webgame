# Random items (design, 2026-11-26)

Petr (2026-11-26): instead of more hand-made items, a random generator like Diablo 2 / Project Diablo 2, so the number
of items is unlimited; the rarity gives the number of bonuses; items for casters (INT), tanks (STR) and assassins (AGI);
better pictures from free icons (game-icons.net, CC BY 3.0, chosen by Petr).

Status: **approved by Petr (2026-11-27)** with the answers in section 9.

## 1. What stays

- 16 gear slots, 14 slot types, the five rarities and their colours, the point budget of an item
  (`design/items.yaml` header: common 6, rare 12, epic 20, legendary 30, mythic 42 points at level 1), item levels
  1-5 and chest levels, gear effects (`sim/gear-effects.ts`), chests (3 on the map, 1 of 3 slots), boss drops by
  rarity tables (`rules.drops`).
- The 70 current items become **named items** (Diablo's "uniques"): fixed stats, fixed names, rarer than random ones.
  Nothing a player owns is lost.

## 2. Item = base + rarity + affixes

An item is no longer an index into `data.items` but a small record:

```
{ base: "iron-helm", rarity: "epic", level: 2, affixes: [["str", 3], ["hp", 1], ["armor", 0]] }
```

- `base`: one of about **45 bases**, 3-4 per slot type, each with a flavour and its own picture: heavy (STR),
  light (AGI), cloth (INT), and for weapons and trinkets a neutral one. A base carries one **implicit** row worth
  2 points (a heavy helm: armor; a cloth hood: spell power), so a base is worth choosing on its own (PD2 does this).
- `affixes`: rarity gives their number, as Diablo's magic and rare items do:

| rarity | affixes | budget (points, level 1) | named items in drops |
|---|---|---|---|
| common | 1 | 6 | - |
| rare | 2 | 12 | - |
| epic | 3 | 20 | 10 % |
| legendary | 4 | 30 | 25 % |
| mythic | 4 + 1 effect | 42 | 40 % |

- Each affix row is `[stat, tier]`; the value is the tier's roll. **Tiers** (as PD2's affix levels) split the
  budget: the rows of an item share its budget, and the higher tiers (bigger single rows) need a higher item
  power (section 4). So a mythic is never "five tiny rows"; it is a few strong rows and an effect.
- The **mythic effect** is one of the existing six effect kinds (chain lightning, splash, low-hp shield, cooldown
  rush, slowing aura, gold heals castle) plus new ones for the roles (section 3).

## 3. Roles: INT, STR, AGI

Every affix has role tags; the base's flavour and the hero both weigh the draw:

- **STR (tank):** str, hp, armor, regen, lifesteal, damage taken -x % (new), thorns (new: x % of melee damage back).
- **AGI (assassin):** agi, attack speed, damage, move speed, crit chance and crit damage (new), dodge (new),
  lifesteal and spell lifesteal (Petr 2026-11-27: an assassin sustains by both).
- **INT (caster):** int, spell power, cooldown speed (new), ultimate cooldown (new), area size +x % (new),
  spell lifesteal (new).
- **Any:** magnet, gold find, magic find.

Smart loot (Diablo 3 style, which PD2 does not have): in a drop or chest, **60 %** of the affixes are drawn from the
hero's primary attribute's pool, the rest from all. Petr can tune the share (`rules.loot.smartShare`).

New stats (crit, dodge, thorns, cooldown, area) need sim code: each is a small change in `heroStats`/`combat`, with
its own point price added to the budget table.

## 4. Item power and tiers

- Item power = the source: a boss's place in the run (1-4), a chest's phase, the world and difficulty
  (world 5 Hell gives the top tiers). It picks which tiers may roll, as Diablo's item level gates affixes.
- Tier values per stat: T1-T4, T4 about twice T1, all within the rarity budget (the `data/generated.test.ts`
  budget check stays and now checks every tier table).

## 5. Names (EN and CS)

- EN: `[prefix] base [of suffix]`, Diablo style: "Stalwart Iron Helm of the Bear". The first affix gives the prefix,
  the second the suffix; a rare+ item with three or more affixes gets a two-word random name instead
  ("Grim Crown"), like Diablo's rares.
- CS needs the grammatical gender of the base (helma f., štít m., roucho n.): every base carries its gender and every
  prefix its three forms ("Pevná železná helma medvěda", "Pevný štít medvěda"). Written fresh, nothing from the map.

## 6. Determinism and saves

- Chest items are rolled in the run with `run.chestRng` (deterministic, part of `stateHash`). Boss drops roll in
  `meta/drop.ts` from the run's seed and the boss's order, as now.
- Save version 2: `items` becomes a list of item records with an id (the collection), `loadouts` point to those
  ids. Version 1 data turns into named items at their levels. The collection holds at most **200** items; a
  "salvage" button turns an item into gold for the next run's first chest (or into nothing: question 9.2).
- Levels: a named item still levels by duplicates (up to 5). A random item drops at a level from its item power and
  never levels up (there are no duplicates of random items).

## 7. Pictures

- game-icons.net SVGs (CC BY 3.0: authors listed in `assets/LICENSES.md` and on a Credits line in the menu), one per
  base (~45) and per named item (70), drawn in the rarity colour with a darker frame. Fetched by a pinned manifest
  like the KayKit models (`tools/assets-build/`), committed as optimized SVG in `assets/icons/`.

## 8. Order of work (plan after the yes)

1. Data: bases, affix pools with tiers and tags, names (EN, CS with genders); schema and budget test.
2. Sim: item record in the run gear, chest rolls, new stats (one at a time with its test).
3. Meta: drop rolls, save version 2 and the migration from version 1.
4. Client: tooltips and compare for random items, collection screen with filters (slot, role, rarity), salvage.
5. Icons: manifest, fetch, build, licences.
6. Balance: `sim:chests` and `sim:run --gear` with random loadouts.

## 9. Petr's answers (2026-11-27)

1. The 70 current items stay as rarer **named items**.
2. Unwanted items are **salvaged for gold** (gold for the next run's chests).
3. **Smart loot 60 %** of the affixes from the hero's primary attribute's pool.
4. The collection holds at most **200** items.
5. AGI affixes may also roll **lifesteal and spell lifesteal** (section 3).
