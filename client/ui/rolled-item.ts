import type { GameData, Item } from "../../data/schema";
import { rolledAsItem } from "../../meta";
import { type ChestCard, EMPTY_ITEM, type GearState, ROLLED_ITEM, rolledAt } from "../../sim";

/** Random items in the run's UI: what a slot wears or a chest card offers, as an `Item` (names: meta/item-view.ts). */

/** What slot `slot` wears as an `Item`, or null for an empty slot. */
export function wornItem(data: GameData, gear: GearState, slot: number): Item | null {
  const index = gear.item[slot]!;
  if (index === EMPTY_ITEM) return null;
  if (index === ROLLED_ITEM) return rolledAsItem(data, rolledAt(gear, slot)!);
  return data.items[index] ?? null;
}

/** The item a chest card offers (the worn one for a Level card). */
export function cardItem(data: GameData, card: ChestCard): Item {
  if (card.rolled) return rolledAsItem(data, card.rolled);
  return data.items[card.item]!;
}
