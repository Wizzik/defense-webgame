/** Fixed-capacity ring of timed effects; the oldest entry is overwritten. Times are simulation seconds. */
export class FxPool {
  readonly capacity: number;
  readonly life: number;
  private readonly start: Float64Array;
  private next = 0;

  constructor(capacity: number, life: number) {
    this.capacity = capacity;
    this.life = life;
    this.start = new Float64Array(capacity).fill(Number.NEGATIVE_INFINITY);
  }

  /** Takes the oldest entry (entries are added in time order); returns its index. */
  add(now: number): number {
    const i = this.next;
    this.next = (i + 1) % this.capacity;
    this.start[i] = now;
    return i;
  }

  /** Age in [0, life], or -1 when the entry is empty or has expired. */
  age(i: number, now: number): number {
    const age = now - this.start[i]!;
    return age >= 0 && age <= this.life ? age : -1;
  }

  /** Entries whose age is in [0, life]. */
  liveCount(now: number): number {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) {
      const age = now - this.start[i]!;
      if (age >= 0 && age <= this.life) n++;
    }
    return n;
  }

  reset(): void {
    this.start.fill(Number.NEGATIVE_INFINITY);
    this.next = 0;
  }
}
