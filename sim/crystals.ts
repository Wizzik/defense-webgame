import { healHero } from "./buffs";
import { TICK_SECONDS } from "./constants";
import { EventKind } from "./events";
import { onGearGold } from "./gear-effects";
import { gainXp } from "./level-up";
import type { Run } from "./run";
import { nearestPlayer } from "./targets";

export const CRYSTAL_CAPACITY = 512;
export const COIN_CAPACITY = 512;
/** Hearts on the ground (spec 2026-11-19 sustain); a heart that does not fit is lost. */
export const HEART_CAPACITY = 64;

/** XP crystals (and gold coins and hearts, two more stores) in typed arrays of fixed capacity; a slot is stable while the crystal lives. */
export class CrystalStore {
  readonly capacity: number;
  count = 0;
  readonly alive: Uint8Array;
  readonly attracted: Uint8Array;
  readonly value: Int32Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly prevX: Float64Array;
  readonly prevY: Float64Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.alive = new Uint8Array(capacity);
    this.attracted = new Uint8Array(capacity);
    this.value = new Int32Array(capacity);
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.prevX = new Float64Array(capacity);
    this.prevY = new Float64Array(capacity);
  }

  /** Takes the lowest free slot; returns -1 when the store is full. */
  drop(x: number, y: number, value: number): number {
    for (let i = 0; i < this.capacity; i++) {
      if (this.alive[i] !== 0) continue;
      this.alive[i] = 1;
      this.attracted[i] = 0;
      this.value[i] = value;
      this.x[i] = x;
      this.y[i] = y;
      this.prevX[i] = x;
      this.prevY[i] = y;
      this.count++;
      return i;
    }
    return -1;
  }

  collect(slot: number): void {
    if (this.alive[slot] === 0) return;
    this.alive[slot] = 0;
    this.count--;
  }
}

/** Adds gold to the current player's purse (gold is per player): the coin's value times (1 + goldFind + the gold passive), rounded. Returns the gold gained. */
export function gainGold(run: Run, value: number): number {
  const amount = Math.round(value * run.mods.gold * (1 + run.hero.gear.goldFind + run.hero.passive.gold));
  run.gold += amount;
  run.stats.goldGained += amount;
  return amount;
}

/** Adds gold as it is; for end-to-end tests and debugging only. */
export function debugGrantGold(run: Run, amount: number): void {
  run.gold += amount;
  run.stats.goldGained += amount;
}

/**
 * Attracts the pickups of a store to the nearest hero (multiplayer migration step 4; sim/targets.ts: the living
 * heroes, all of them when every hero has fallen), flies them in without overshooting, and the hero they reach collects
 * them. `kind`: 0 XP crystals (shared by every hero), 1 gold coins (the collector's purse), 2 hearts (heal the collector;
 * nothing for a fallen hero). The magnet is the reach of that hero. The Pickup event carries the XP, the gold or the hp
 * gained, the kind in `u` and the collector in `v`. `run.current` is the collector while a pickup takes effect, 0 after.
 */
export function updatePickups(run: Run, c: CrystalStore, kind: 0 | 1 | 2): void {
  if (c.count === 0) return;
  const { magnetRadius, crystalSpeed, pickupRadius } = run.data.rules.progression;
  const pickupSq = pickupRadius * pickupRadius;
  const stepLen = crystalSpeed * TICK_SECONDS;
  for (let i = 0; i < c.capacity; i++) {
    if (c.alive[i] === 0) continue;
    const p = nearestPlayer(run, c.x[i], c.y[i]);
    const hero = run.players[p]!.hero;
    const reach = magnetRadius + hero.gear.magnet + hero.passive.magnet;
    let dx = hero.x - c.x[i];
    let dy = hero.y - c.y[i];
    let sq = dx * dx + dy * dy;
    if (sq < reach * reach) c.attracted[i] = 1;
    if (c.attracted[i] !== 0 && sq > 0) {
      const d = Math.sqrt(sq);
      if (d <= stepLen) {
        c.x[i] = hero.x;
        c.y[i] = hero.y;
        dx = 0;
        dy = 0;
      } else {
        c.x[i] += (dx / d) * stepLen;
        c.y[i] += (dy / d) * stepLen;
        dx = hero.x - c.x[i];
        dy = hero.y - c.y[i];
      }
      sq = dx * dx + dy * dy;
    }
    if (sq <= pickupSq) {
      const value = c.value[i];
      const x = c.x[i];
      const y = c.y[i];
      c.collect(i);
      run.current = p;
      if (kind === 0) {
        run.events.push(EventKind.Pickup, i, value, x, y, 0, p);
        gainXp(run, value);
      } else if (kind === 1) {
        run.events.push(EventKind.Pickup, i, gainGold(run, value), x, y, 1, p);
        onGearGold(run, value);
      } else {
        const healed = healHero(run, run.data.rules.sustain.hearts.healShare * hero.stats.maxHp);
        run.stats.hearts++;
        run.stats.healedHearts += healed;
        run.events.push(EventKind.Pickup, i, healed, x, y, 2, p);
      }
      run.current = 0;
    }
  }
}

/** Drops a heart 100 ahead of the hero; for end-to-end tests and debugging only. */
export function debugDropHeart(run: Run): void {
  const hero = run.hero;
  run.hearts.drop(hero.x + hero.facingX * 100, hero.y + hero.facingY * 100, 1);
}
