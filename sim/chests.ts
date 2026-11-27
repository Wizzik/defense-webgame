import { runMagicFind } from "./difficulty";
import { RARITIES, type Rarity } from "../data/schema";
import { EventKind } from "./events";
import {
  EMPTY_ITEM, type GearState, recomputeGear, ROLLED_ITEM, rolledAt, type RolledItem, SLOT_COUNT, slotTypeOf, wearNamed,
  wearRolled, wornRarity,
} from "./gear";
import { chestPower, rollItem } from "./item-roll";
import { drawRarity, magicFindWeights } from "./magic-find";
import { isFree, nearestFree, pushX, pushY } from "./world-map/geometry";
import type { Run } from "./run";

/** Places tried for a chest before the last one that kept the distance from the castle is taken. */
const PLACE_TRIES = 40;

/** The chests on the map: `rules.chests.count` of them, always all present. */
export class ChestStore {
  readonly x: Float64Array;
  readonly y: Float64Array;

  constructor(count: number) {
    this.x = new Float64Array(count);
    this.y = new Float64Array(count);
  }
}

/**
 * What a chest card does: put a new item into an empty slot; offer a choice between the worn item and one of a higher
 * rarity (keep: a level for the worn item, take: the offered item replaces it); or add a level to the worn item.
 */
export const ChestAction = { New: 0, Choice: 1, Level: 2 } as const;
export type ChestAction = (typeof ChestAction)[keyof typeof ChestAction];

/** One card of an open chest: a gear slot and a named item (index into `data.items`) or a rolled one. */
export interface ChestCard {
  slot: number;
  /** The offered named item for New and Choice, the worn item for Level; ROLLED_ITEM for a rolled item. */
  item: number;
  action: ChestAction;
  /** A random item the card offers (New or Choice) or a copy of the worn one (Level); missing or null for a named item. */
  rolled?: RolledItem | null;
}

/** The cards a chest that was just opened offers; the player picks one by its index. */
export interface ChestOffer {
  cards: ChestCard[];
}

/** Gold the next chest costs. */
export function chestPrice(run: Run): number {
  return Math.round(run.chestPriceRaw);
}

/**
 * Moves chest `index` to a new random place: between the two castle distances, inside the arena and
 * `minSpacing` from every chest (its own old place too, so an opened chest comes back elsewhere).
 * `fresh` chests of the first placement only keep away from the chests before them.
 */
export function placeChest(run: Run, index: number, fresh: boolean): void {
  const { chests, castle, chestRng: rng } = run;
  const rules = run.data.rules.chests;
  const { arena } = run.data.rules;
  const limitX = arena.width / 2 - rules.pickupRadius;
  const limitY = arena.height / 2 - rules.pickupRadius;
  const minSq = rules.minCastleDistance * rules.minCastleDistance;
  const maxSq = rules.maxCastleDistance * rules.maxCastleDistance;
  const spacingSq = rules.minSpacing * rules.minSpacing;
  const others = fresh ? index : chests.x.length;
  // The fallback keeps the castle distance: a point straight north of the castle (south when the arena ends there).
  const middle = (rules.minCastleDistance + rules.maxCastleDistance) / 2;
  let fallbackX = castle.x;
  let fallbackY = castle.y + middle <= limitY ? castle.y + middle : castle.y - middle;
  for (let attempt = 0; attempt < PLACE_TRIES; attempt++) {
    const x = castle.x + (rng.next() * 2 - 1) * rules.maxCastleDistance;
    const y = castle.y + (rng.next() * 2 - 1) * rules.maxCastleDistance;
    const dx = x - castle.x;
    const dy = y - castle.y;
    const sq = dx * dx + dy * dy;
    if (sq < minSq || sq > maxSq || x < -limitX || x > limitX || y < -limitY || y > limitY) continue;
    if (!isFree(run.map, x, y, rules.pickupRadius)) continue;
    fallbackX = x;
    fallbackY = y;
    let apart = true;
    for (let other = 0; other < others; other++) {
      const ox = x - chests.x[other]!;
      const oy = y - chests.y[other]!;
      if (ox * ox + oy * oy < spacingSq) {
        apart = false;
        break;
      }
    }
    if (apart) break;
  }
  // every place, the fallback too, ends outside the obstacles
  nearestFree(run.map, fallbackX, fallbackY, rules.pickupRadius);
  chests.x[index] = pushX;
  chests.y[index] = pushY;
}

/**
 * Opens the chest the hero stands on when the gold is there: the price is paid, the next chest costs more
 * and the run waits in the "chest" state for a card. Runs at the end of a step, after the end check and
 * only when no level-up waits, so a loss or a card offer of the same step comes first.
 */
export function updateChests(run: Run): void {
  const { chests, hero } = run;
  const rules = run.data.rules.chests;
  const price = chestPrice(run);
  if (run.gold < price) return;
  const reachSq = rules.pickupRadius * rules.pickupRadius;
  for (let i = 0; i < chests.x.length; i++) {
    const dx = chests.x[i]! - hero.x;
    const dy = chests.y[i]! - hero.y;
    if (dx * dx + dy * dy > reachSq) continue;
    run.gold -= price;
    run.chestsOpened++;
    run.chestPriceRaw *= rules.priceGrowth;
    run.openChest = i;
    run.chestOffer = rollChestOffer(run);
    run.state = "chest";
    run.events.push(EventKind.ChestOpen, i, price, chests.x[i]!, chests.y[i]!, 0, 0);
    return;
  }
}

/** The slot that takes the same item type as `slot` (ring1 and ring2, trinket1 and trinket2), or -1. */
function twinSlot(slot: number): number {
  const type = slotTypeOf(slot);
  if (type !== "ring" && type !== "trinket") return -1;
  for (let other = 0; other < SLOT_COUNT; other++) if (other !== slot && slotTypeOf(other) === type) return other;
  return -1;
}

/**
 * Rolls the cards of an open chest (randomness only from `run.chestRng`; rare, may allocate). For each card:
 * a rarity by `rules.chests.rarityWeights` raised by the hero's magic find and a slot not yet in the offer. A card
 * never offers an item at or below the rarity a slot wears (Petr's batch 2, task 6): when the drawn slot wears that
 * rarity or a higher one, the card is a Level card of the worn item with `rules.loot.upgradeShare`, else it moves to
 * another slot of the offer's free ones that is empty or wears a lower rarity; with no such slot it is a Level card
 * too (so a mythic slot only ever gets Level cards). Otherwise, with `rules.loot.namedShare` of the rarity (when a
 * named item of that rarity fits the slot) the card offers a named item, preferring one the twin slot (ring,
 * trinket) does not wear; else a random item rolled for the hero's primary attribute with the chest's item power
 * (sim/item-roll.ts). New for an empty slot, else Choice.
 */
export function rollChestOffer(run: Run): ChestOffer {
  const { data, gear, chestRng: rng } = run;
  const weights = magicFindWeights(data.rules.chests.rarityWeights, runMagicFind(run), data.rules.magicFind);
  const count = Math.min(data.rules.chests.slotsPerOffer, SLOT_COUNT);
  const power = chestPower(data, run.phaseIndex + 1, run.world, run.difficulty);
  const taken = new Uint8Array(SLOT_COUNT);
  const cards: ChestCard[] = [];
  for (let c = 0; c < count; c++) {
    const rarity: Rarity = drawRarity(weights, rng);
    const rank = RARITIES.indexOf(rarity);
    const slots: number[] = [];
    for (let slot = 0; slot < SLOT_COUNT; slot++) if (taken[slot] === 0) slots.push(slot);
    if (slots.length === 0) throw new Error("chests: no free slot for a card");
    let slot = slots[rng.int(slots.length)]!;
    if (wornRarity(data, gear, slot) >= rank) {
      const lower = rng.next() < data.rules.loot.upgradeShare
        ? []
        : slots.filter((other) => wornRarity(data, gear, other) < rank);
      if (lower.length === 0) {
        taken[slot] = 1;
        cards.push(levelCard(gear, slot));
        continue;
      }
      slot = lower[rng.int(lower.length)]!;
    }
    taken[slot] = 1;
    const worn = gear.item[slot]!;
    const action = worn === EMPTY_ITEM ? ChestAction.New : ChestAction.Choice;
    const named = namedPool(run, rarity, slot);
    const share = data.rules.loot.namedShare[rarity];
    if (named.length > 0 && share > 0 && rng.next() < share) {
      cards.push({ slot, item: named[rng.int(named.length)]!, action, rolled: null });
      continue;
    }
    const rolled = rollItem(data, rng, slotTypeOf(slot), rarity, power, run.hero.def.primary);
    cards.push({ slot, item: ROLLED_ITEM, action, rolled });
  }
  return { cards };
}

/** A Level card of what `slot` wears; a rolled worn item rides on the card (a copy) so the UI can show it. */
function levelCard(gear: GearState, slot: number): ChestCard {
  const item = gear.item[slot]!;
  return { slot, item, action: ChestAction.Level, rolled: item === ROLLED_ITEM ? rolledAt(gear, slot) : null };
}

/** The named items of `rarity` that fit `slot`, without the one the twin slot wears when there are others. */
function namedPool(run: Run, rarity: Rarity, slot: number): number[] {
  const { data, gear } = run;
  const type = slotTypeOf(slot);
  const twin = twinSlot(slot);
  const twinItem = twin >= 0 ? gear.item[twin]! : EMPTY_ITEM;
  const all: number[] = [];
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]!;
    if (item.rarity === rarity && item.slotType === type) all.push(i);
  }
  const others = all.filter((i) => i !== twinItem);
  return others.length > 0 ? others : all;
}

/**
 * Applies a chest card: New puts the item in at chest level 1; a taken Choice puts the rolled item in with the
 * slot's whole level plus one as chest levels (the loadout given to the run is not touched, so a permanent item
 * comes back after the run); Level and a kept Choice add a chest level to the worn item. `keep` only matters for
 * a Choice. Then the gear and its effects are summed again and ChestPick is recorded with New, Choice (taken)
 * or Level (a level for the worn item, a kept Choice too).
 */
export function applyChestCard(run: Run, card: ChestCard, keep = false): void {
  const { gear, hero } = run;
  const slot = card.slot;
  let done: ChestAction = card.action;
  if (card.action === ChestAction.New) {
    wearCard(run, card);
    gear.base[slot] = 0;
    gear.temp[slot] = 1;
  } else if (card.action === ChestAction.Choice && !keep) {
    gear.temp[slot] = gear.base[slot]! + gear.temp[slot]! + 1;
    gear.base[slot] = 0;
    wearCard(run, card);
  } else {
    gear.temp[slot] = gear.temp[slot]! + 1;
    done = ChestAction.Level;
  }
  recomputeGear(run);
  run.events.push(EventKind.ChestPick, slot, gear.base[slot]! + gear.temp[slot]!, hero.x, hero.y, gear.item[slot]!, done);
}

/** Puts the card's item (rolled or named) into its slot. */
function wearCard(run: Run, card: ChestCard): void {
  if (card.rolled) wearRolled(run.gear, card.slot, card.rolled);
  else wearNamed(run.gear, card.slot, card.item);
}

/**
 * Applies the chosen card of the open chest (`keep`: keep the worn item of a Choice card) and resumes; the chest
 * then appears elsewhere. A bad index changes nothing.
 */
export function chooseChestCard(run: Run, index: number, keep: boolean): void {
  const offer = run.chestOffer;
  if (!offer || !Number.isInteger(index) || index < 0 || index >= offer.cards.length) return;
  applyChestCard(run, offer.cards[index]!, keep);
  const { chests } = run;
  const chest = run.openChest;
  placeChest(run, chest, false);
  run.events.push(EventKind.ChestSpawn, chest, 0, chests.x[chest]!, chests.y[chest]!, 0, 0);
  run.openChest = -1;
  run.chestOffer = null;
  run.state = "playing";
}
