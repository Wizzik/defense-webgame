/** Default number of deaths a run remembers for gravebinders (sim/enemy-raise.ts). */
export const CORPSE_CAPACITY = 64;

/**
 * The places of the last deaths of common enemies, in a ring of fixed capacity: a new death overwrites the oldest.
 * A taken place is gone. Does not allocate after construction.
 */
export class CorpseRing {
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly tick: Int32Array;
  readonly alive: Uint8Array;
  /** The slot the next death is written to. */
  head = 0;

  constructor(readonly capacity: number) {
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.tick = new Int32Array(capacity);
    this.alive = new Uint8Array(capacity);
  }

  record(x: number, y: number, tick: number): void {
    const i = this.head;
    this.x[i] = x;
    this.y[i] = y;
    this.tick[i] = tick;
    this.alive[i] = 1;
    this.head = (i + 1) % this.capacity;
  }

  /**
   * Takes the place nearest to (cx, cy) within `range` whose death came at `minTick` or later (the lower slot on a tie)
   * and returns its slot (its x and y stay readable), or -1 when there is none.
   */
  take(cx: number, cy: number, range: number, minTick: number): number {
    let best = -1;
    let bestD2 = range * range;
    for (let i = 0; i < this.capacity; i++) {
      if (this.alive[i] === 0 || this.tick[i] < minTick) continue;
      const dx = this.x[i] - cx;
      const dy = this.y[i] - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2 || (d2 === bestD2 && best < 0)) {
        best = i;
        bestD2 = d2;
      }
    }
    if (best >= 0) this.alive[best] = 0;
    return best;
  }
}
