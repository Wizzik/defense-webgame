# Named items only legendary / mythic, and salvage for named items (2026-11-28)

Petr (2026-11-28): "the 70 items with their own names and great icons should be legendary / mythic only; common,
epic and so on are useless as fixed items. Adding items by import works, but I would like to sell them or throw them
away too." His answers: **part legendary, part mythic** (not all legendary, not deleted), and **Salvage for every
item** (named ones too, gold = rarity x level). Rulings below are Claude's; record them in `docs/DECISIONS.md`.

Today: 70 named items, 14 common, 24 rare, 24 epic, 5 legendary, 3 mythic (`design/items.yaml`); boss drops and
chests give named items only by `rules.loot.namedShare` (common 0, rare 0, epic 0.1, legendary 0.25, mythic 0.4), so
the common to epic named items mostly come from imports and old saves. Every legendary and mythic has an effect
(`sim/gear-effects.ts`, 6 kinds; effects of one kind do not stack, the later slot counts). Salvage
(`meta/salvage.ts`) refuses named records.

## Rulings

1. **New rarities.** Every common and rare named item becomes **legendary**. Every epic becomes **mythic**, except
   in the slot types that already have a mythic (trinket, mainHand, offHand: `astrolabe-shard`,
   `compass-of-the-lost-scout`, `greatblade-of-the-keep`, `staff-of-the-low-tide`, `parrying-dagger`), which become
   legendary. Result: 48 legendary, 22 mythic; every slot type has at least one of each. Ids, names and icons stay.
2. **Stats.** Legendary 4 rows, 30 points; mythic 5 rows, 42 points (the budgets of the items.yaml header). Keep
   each item's existing rows (stat and order) as its first rows, give every row the same share of the budget, and
   add rows that fit the item's theme (its primary attribute, the slot's usual stats: hp/armor on armour, magnet or
   magicFind on jewels, damage/attackSpeed/spellPower on weapons) without a stat twice. Do it with a small script in
   the scratchpad (unit prices from the items.yaml header and `design/affixes.yaml`), not by eye, and round as the
   existing rows are rounded.
3. **Effects on every slot.** Drop the "weapons, off-hands and trinkets only" line. Every new legendary and mythic
   gets an effect. Add **five new effect kinds** in `sim/gear-effects.ts` (fixed fields, no allocation in a step,
   deterministic, a `METER_ITEM` source for their damage), each with a legendary and a stronger mythic version
   (mythic about 1.4-1.5 x the legendary's strength or a shorter cooldown):
   - `heal_on_kill`: every `kills` kills the hero heals `hp`;
   - `nova_when_hit`: when the hero takes damage, at most once per `cooldown` s, `damage` to every enemy within
     `radius`;
   - `elite_slayer`: `share` more damage against elites and bosses;
   - `death_burst`: a killed enemy bursts with `chance`, `damage` to the enemies within `radius` (a burst does not
     start another burst);
   - `castle_ward`: the castle takes `share` less damage.
   Spread the 11 kinds over the items so that one doll can hold many different kinds (the slot types of one kind
   should differ). Add the mythic versions of the new kinds to `rules.loot.mythicEffects` (random mythics roll them).
   Tooltip texts in English (`effect.text.en`; keep `cs` filled as the schema wants, English copy is allowed).
4. **Saved records.** A named record stores a rarity (`meta/item-record.ts`); the reader must take a named item's
   rarity from the catalogue, so old saves and imports show and price the new rarity. Owned items keep id and level
   and simply get stronger.
5. **Salvage for named items.** `canSalvage`: any record that no doll wears (named too). Gold
   `rules.loot.salvageGold[rarity] x level` (a random item's level is its record's level, as for named). The bank
   limit 500 stays. The salvage tooltip says the gold. A salvaged named item can drop again later (new, level 1).
6. **Drops and chests.** `namedShare` stays (legendary 0.25, mythic 0.4): with 48 and 22 named items more of those
   drops are named, which Petr wants. Common to epic drops and chest cards are always random (no named item has that
   rarity any more; the code already falls back to a rolled item).
7. **sim:run presets.** `mid` (a rare named item of level 1 per slot) has no rare named items any more: make it a
   **legendary named item of level 1 per slot**; `full` stays (the best named item per slot at level 5, now mostly
   mythic). Update AGENTS.md and the presets' docs.

## Steps (small commits, `npm run check` before each)

1. Schema and data: rarities and stats (script), effects for every new legendary and mythic using the 6 old kinds
   only, the reader rule of ruling 4, the items.yaml header. `data/generated/items.json` edited by the same rule
   (no `data-source/` in the cloud: the data-change skill). Fix tests that assumed common/rare/epic named items
   (`sim/chests.test.ts`, gear and drop tests): use rolled items or the legendary ones, never skip a test.
2. The five new effect kinds (sim, schema, tests one per kind, tooltips in `client/ui/item-lines.ts` if needed),
   then move items onto them as ruling 3 says; `rules.loot.mythicEffects` += the mythic versions.
3. Salvage for named items (meta, gear screen, tests), the `mid` preset.
4. Balance check: `sim:run --hero all --seeds 1-20 --quiet` with `--gear none`, `mid`, `full`, `rolled-full`
   before and after (no-gear numbers must not move much: chest cards may be named legendary/mythic), and
   `sim:chests -- --seeds 1-200`. A short table into DECISIONS. If `full` becomes far stronger than `rolled-full`,
   say so (it is expected; Petr decides).
5. Determinism: `npm run sim:digest`, new value into `client/determinism/digest.test.ts`, say so in the commit/PR.
6. `npm run shots` (gear screen), STATUS.md with Petr's checks (links with `?debug=1`, `__game.debug.grantItem`),
   DECISIONS.md, push, PR.
