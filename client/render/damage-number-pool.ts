/** Seconds a damage number rises before it disappears. */
export const NUMBER_LIFE = 0.6;

/**
 * Slot bookkeeping for a fixed pool of floating damage numbers (no DOM). `add` takes the
 * first free slot, or overwrites the oldest one when all are busy. Times are simulation seconds.
 */
export class DamageNumberPool {
  private readonly start: Float64Array;

  constructor(readonly size: number) {
    this.start = new Float64Array(size).fill(-1e9);
  }

  add(now: number): number {
    let pick = 0;
    let oldest = Infinity;
    for (let i = 0; i < this.size; i++) {
      if (!this.active(i, now)) {
        pick = i;
        oldest = -Infinity;
        break;
      }
      if (this.start[i] < oldest) {
        oldest = this.start[i];
        pick = i;
      }
    }
    this.start[pick] = now;
    return pick;
  }

  age(slot: number, now: number): number {
    return now - this.start[slot];
  }

  active(slot: number, now: number): boolean {
    const a = now - this.start[slot];
    return a >= 0 && a < NUMBER_LIFE;
  }

  clear(): void {
    this.start.fill(-1e9);
  }
}
