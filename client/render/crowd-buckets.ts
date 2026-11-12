/** Fills of the per-type instance lists of the crowd; allocation-free after construction. */
export class CrowdBuckets {
  private readonly counts: Uint32Array;

  constructor(
    types: number,
    private readonly capacity: number,
  ) {
    this.counts = new Uint32Array(types);
  }

  reset(): void {
    this.counts.fill(0);
  }

  /** Adds an instance of `type` and returns its index within that type. */
  push(type: number): number {
    const index = this.counts[type];
    if (index >= this.capacity) throw new Error(`CrowdBuckets: type ${type} is over its capacity of ${this.capacity}`);
    this.counts[type] = index + 1;
    return index;
  }

  count(type: number): number {
    return this.counts[type];
  }
}
