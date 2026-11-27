import type { GameData, Item, SlotType } from "../../data/schema";
import { RARITIES, STAT_IDS } from "../../data/schema";
import { type ChestCard, EMPTY_ITEM, type GearState, ROLLED_ITEM, type RolledItem, rolledAt, slotTypeOf } from "../../sim";

/**
 * Random items in the UI (spec 2026-11-26 random items, section 5): a rolled item is shown as an `Item` with its own
 * name, so every tooltip, card and compare reads it like a named one.
 */

/** "Mocná" in front of "železná přilba": the Czech base name starts lowercase behind a prefix. */
function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase("cs") + text.slice(1);
}

/**
 * The name of a rolled item: a two-word name ("Grim Crown", "Ponurá koruna") when it has one, else
 * [prefix of the first affix] base [suffix of the second affix] ("Mighty Iron Helm of the Lynx",
 * "Mocná železná přilba rysa").
 */
export function rolledName(data: GameData, rolled: RolledItem, slotType: SlotType): { en: string; cs: string } {
  const { loot } = data;
  if (rolled.nameFirst >= 0 && rolled.nameNoun >= 0) {
    const first = loot.names.first[rolled.nameFirst];
    const noun = loot.names.nouns[slotType][rolled.nameNoun];
    if (first && noun) return { en: `${first.en} ${noun.name.en}`, cs: `${first.cs[noun.gender]} ${noun.name.cs}` };
  }
  const base = loot.bases[rolled.base]!;
  const affixOf = (row: number) => {
    const stat = rolled.stats[row];
    return stat === undefined ? undefined : loot.affixes.find((a) => a.stat === STAT_IDS[stat]);
  };
  const prefix = affixOf(1);
  const suffix = affixOf(2);
  const en = [prefix?.prefix.en, base.name.en, suffix?.suffix.en].filter(Boolean).join(" ");
  const cs = [prefix?.prefix.cs[base.gender], prefix ? lowerFirst(base.name.cs) : base.name.cs, suffix?.suffix.cs]
    .filter(Boolean).join(" ");
  return { en, cs };
}

/** A rolled item as an `Item` (not validated: its row count is 1 + affixes). */
export function rolledAsItem(data: GameData, rolled: RolledItem, slotType: SlotType): Item {
  const base = data.loot.bases[rolled.base]!;
  const effect = rolled.effect >= 0 ? data.rules.loot.mythicEffects[rolled.effect] : undefined;
  return {
    id: `rolled-${base.id}`,
    name: rolledName(data, rolled, slotType),
    slotType,
    rarity: RARITIES[rolled.rarity]!,
    stats: rolled.stats.map((stat, r) => ({ stat: STAT_IDS[stat]!, value: rolled.values[r]! })),
    ...(effect ? { effect } : {}),
  };
}

/** What slot `slot` wears as an `Item`, or null for an empty slot. */
export function wornItem(data: GameData, gear: GearState, slot: number): Item | null {
  const index = gear.item[slot]!;
  if (index === EMPTY_ITEM) return null;
  if (index === ROLLED_ITEM) return rolledAsItem(data, rolledAt(gear, slot)!, slotTypeOf(slot));
  return data.items[index] ?? null;
}

/** The item a chest card offers (the worn one for a Level card). */
export function cardItem(data: GameData, card: ChestCard): Item {
  if (card.rolled) return rolledAsItem(data, card.rolled, slotTypeOf(card.slot));
  return data.items[card.item]!;
}
