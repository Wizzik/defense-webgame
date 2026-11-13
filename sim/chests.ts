import { EventKind } from "./events";
import { recomputeGear, SLOT_COUNT } from "./gear";
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

/** The slots a chest that was just opened offers; the player picks one by its index. */
export interface ChestOffer {
  slots: number[];
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
 * and the run waits in the "chest" state for a slot. Runs at the end of a step, after the end check and
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
    openChestOffer(run);
    run.state = "chest";
    run.events.push(EventKind.ChestOpen, i, price, chests.x[i]!, chests.y[i]!, 0, 0);
    return;
  }
}

/** Draws `slotsPerOffer` different slots (partial Fisher-Yates over the 16 slots). Rare, may allocate. */
function openChestOffer(run: Run): void {
  const order = run.chestOrder;
  for (let i = 0; i < SLOT_COUNT; i++) order[i] = i;
  const k = Math.min(run.data.rules.chests.slotsPerOffer, SLOT_COUNT);
  const slots: number[] = [];
  for (let i = 0; i < k; i++) {
    const j = i + run.chestRng.int(SLOT_COUNT - i);
    const t = order[i]!;
    order[i] = order[j]!;
    order[j] = t;
    slots.push(order[i]!);
  }
  run.chestOffer = { slots };
}

/**
 * Applies the chosen slot of the open chest and resumes: an empty slot gets the common item of its type as
 * a temporary level 1, a worn slot one more temporary level. The chest then appears elsewhere.
 */
export function chooseChestSlot(run: Run, index: number): void {
  const offer = run.chestOffer;
  if (!offer || !Number.isInteger(index) || index < 0 || index >= offer.slots.length) return;
  const slot = offer.slots[index]!;
  const { gear, chests, hero } = run;
  if (gear.item[slot]! < 0) gear.item[slot] = run.basicItems[slot]!;
  gear.temp[slot] = gear.temp[slot]! + 1;
  recomputeGear(run);
  run.events.push(EventKind.ChestPick, slot, gear.base[slot]! + gear.temp[slot]!, hero.x, hero.y, gear.item[slot]!, 0);
  const chest = run.openChest;
  placeChest(run, chest, false);
  run.events.push(EventKind.ChestSpawn, chest, 0, chests.x[chest]!, chests.y[chest]!, 0, 0);
  run.openChest = -1;
  run.chestOffer = null;
  run.state = "playing";
}
