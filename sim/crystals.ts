import { TICK_SECONDS } from "./constants";
import { EventKind } from "./events";
import { gainXp } from "./level-up";
import type { Run } from "./run";

export const CRYSTAL_CAPACITY = 512;

/** XP crystals in typed arrays of fixed capacity; a slot is stable while the crystal lives. */
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

/** Attracts crystals near the hero, flies them in without overshooting and collects them. */
export function updateCrystals(run: Run): void {
  const { crystals: c, hero } = run;
  if (c.count === 0) return;
  const { magnetRadius, crystalSpeed, pickupRadius } = run.data.rules.progression;
  const reach = magnetRadius + hero.gear.magnet;
  const magnetSq = reach * reach;
  const pickupSq = pickupRadius * pickupRadius;
  const stepLen = crystalSpeed * TICK_SECONDS;
  for (let i = 0; i < c.capacity; i++) {
    if (c.alive[i] === 0) continue;
    let dx = hero.x - c.x[i];
    let dy = hero.y - c.y[i];
    let sq = dx * dx + dy * dy;
    if (sq < magnetSq) c.attracted[i] = 1;
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
      run.events.push(EventKind.Pickup, i, value, c.x[i], c.y[i], 0, 0);
      c.collect(i);
      gainXp(run, value);
    }
  }
}
