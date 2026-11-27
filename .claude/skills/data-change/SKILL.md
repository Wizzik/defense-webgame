---
name: data-change
description: Use when changing game numbers or content (abilities, heroes, enemies, items, rules, worlds) in design/*.yaml and data/generated/*.json, especially in a cloud session without the map export.
---

# Change game data

The source of truth is `design/*.yaml`; `data/generated/*.json` is what the game bundles.

## With the map export (Petr's machine)
1. Edit `design/*.yaml`.
2. `npm run data:build -- --source data-source/<label>/out --out data/generated`.
3. Commit yaml and json together.

## Without it (cloud container: no `data-source/`)
1. Find the rule `tools/data-build` applies to the field (`tools/data-build/scaling.ts`: multipliers, `levelGrowthExponent`, rounding; the mapping code for `source` fields).
2. Edit `design/*.yaml`.
3. Write the same change into `data/generated/*.json` with a small Node script in the scratchpad (never by eye), applying the same rule. Query the JSON with `node -e`, never read it whole.
4. `npx vitest run data/` (schema + `data/generated.test.ts`), then `npm run check`.
5. Say in the commit body: "generated json edited by the data-build rule; rerun data:build locally to confirm".

## Always
- No map codes (`source`, `review`) in `data/generated/`.
- New player-facing text in EN and CS, written fresh (never from the map).
- A balance change moves the determinism digest (skill `finish-task`, step 2).
