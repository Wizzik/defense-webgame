import type { Rarity } from "../data/schema";
import { RARITIES } from "../data/schema";
import { EventKind } from "./events";
import { recomputeGear, SLOT_COUNT, slotTypeOf } from "./gear";
import { drawRarity, magicFindWeights } from "./magic-find";
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

/** What a chest card does: put a new item into an empty slot, replace the worn item, or add a level to it. */
export const ChestAction = { New: 0, Replace: 1, Level: 2 } as const;
export type ChestAction = (typeof ChestAction)[keyof typeof ChestAction];

/** One card of an open chest: a gear slot and an item (index into `data.items`). */
export interface ChestCard {
  slot: number;
  /** The rolled item for New and Replace, the worn item for Level. */
  item: number;
  action: ChestAction;
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
  chests.x[index] = fallbackX;
  chests.y[index] = fallbackY;
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
 * a rarity by `rules.chests.rarityWeights` raised by the hero's magic find; a slot not yet in the offer whose
 * type has an item of that rarity (one rarity lower when there is none); an item of that rarity and type,
 * preferring one the twin slot (ring, trinket) does not wear. The action follows the worn item: New for an
 * empty slot, Replace for a higher rarity, else Level with the worn item on the card.
 */
export function rollChestOffer(run: Run): ChestOffer {
  const { data, gear, chestRng: rng } = run;
  const weights = magicFindWeights(data.rules.chests.rarityWeights, run.hero.gear.magicFind, data.rules.magicFind);
  const count = Math.min(data.rules.chests.slotsPerOffer, SLOT_COUNT);
  const taken = new Uint8Array(SLOT_COUNT);
  const cards: ChestCard[] = [];
  for (let c = 0; c < count; c++) {
    let rank = RARITIES.indexOf(drawRarity(weights, rng));
    let slots: number[] = [];
    for (; rank >= 0; rank--) {
      const rarity = RARITIES[rank]!;
      slots = [];
      for (let slot = 0; slot < SLOT_COUNT; slot++) {
        if (taken[slot] === 0 && hasItem(run, rarity, slot)) slots.push(slot);
      }
      if (slots.length > 0) break;
    }
    if (rank < 0) throw new Error("chests: no free slot for a card");
    const rarity = RARITIES[rank]!;
    const slot = slots[rng.int(slots.length)]!;
    taken[slot] = 1;
    const type = slotTypeOf(slot);
    const twin = twinSlot(slot);
    const twinItem = twin >= 0 ? gear.item[twin]! : -1;
    const all: number[] = [];
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i]!;
      if (item.rarity === rarity && item.slotType === type) all.push(i);
    }
    const others = all.filter((i) => i !== twinItem);
    const pool = others.length > 0 ? others : all;
    const rolled = pool[rng.int(pool.length)]!;
    const worn = gear.item[slot]!;
    if (worn < 0) cards.push({ slot, item: rolled, action: ChestAction.New });
    else if (rank > RARITIES.indexOf(data.items[worn]!.rarity)) cards.push({ slot, item: rolled, action: ChestAction.Replace });
    else cards.push({ slot, item: worn, action: ChestAction.Level });
  }
  return { cards };
}

/** Whether some item of `rarity` fits `slot`. */
function hasItem(run: Run, rarity: Rarity, slot: number): boolean {
  const type = slotTypeOf(slot);
  return run.data.items.some((item) => item.rarity === rarity && item.slotType === type);
}

/**
 * Applies a chest card: New puts the item in at chest level 1; Replace puts it in with the slot's whole level
 * plus one as chest levels (the loadout given to the run is not touched, so a permanent item comes back after
 * the run); Level adds a chest level. Then the gear and its effects are summed again and ChestPick is recorded.
 */
export function applyChestCard(run: Run, card: ChestCard): void {
  const { gear, hero } = run;
  const slot = card.slot;
  if (card.action === ChestAction.New) {
    gear.item[slot] = card.item;
    gear.base[slot] = 0;
    gear.temp[slot] = 1;
  } else if (card.action === ChestAction.Replace) {
    gear.temp[slot] = gear.base[slot]! + gear.temp[slot]! + 1;
    gear.base[slot] = 0;
    gear.item[slot] = card.item;
  } else {
    gear.temp[slot] = gear.temp[slot]! + 1;
  }
  recomputeGear(run);
  run.events.push(EventKind.ChestPick, slot, gear.base[slot]! + gear.temp[slot]!, hero.x, hero.y, gear.item[slot]!, card.action);
}

/** Applies the chosen card of the open chest and resumes; the chest then appears elsewhere. A bad index changes nothing. */
export function chooseChestCard(run: Run, index: number): void {
  const offer = run.chestOffer;
  if (!offer || !Number.isInteger(index) || index < 0 || index >= offer.cards.length) return;
  applyChestCard(run, offer.cards[index]!);
  const { chests } = run;
  const chest = run.openChest;
  placeChest(run, chest, false);
  run.events.push(EventKind.ChestSpawn, chest, 0, chests.x[chest]!, chests.y[chest]!, 0, 0);
  run.openChest = -1;
  run.chestOffer = null;
  run.state = "playing";
}
