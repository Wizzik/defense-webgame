/**
 * Uniform grid over an unbounded plane, stored as a hash table of cells.
 * Entries of one bucket are chained through `next`. All arrays are allocated in the
 * constructor; `clear`, `insert` and `query` never allocate.
 */
export class SpatialHash {
  private readonly cellSize: number;
  private readonly capacity: number;
  private readonly mask: number;
  /** First entry of each bucket, -1 when empty. */
  private readonly heads: Int32Array;
  /** Next entry in the same bucket, -1 at the end of the chain. */
  private readonly next: Int32Array;
  private readonly ids: Int32Array;
  private readonly xs: Float64Array;
  private readonly ys: Float64Array;
  /** Cell of each entry; several cells can share a bucket, so queries compare it. */
  private readonly cellXs: Int32Array;
  private readonly cellYs: Int32Array;
  private count = 0;

  constructor(cellSize: number, capacity: number) {
    this.cellSize = cellSize;
    this.capacity = capacity;
    let buckets = 16;
    while (buckets < capacity * 2) buckets *= 2;
    this.mask = buckets - 1;
    this.heads = new Int32Array(buckets).fill(-1);
    this.next = new Int32Array(capacity);
    this.ids = new Int32Array(capacity);
    this.xs = new Float64Array(capacity);
    this.ys = new Float64Array(capacity);
    this.cellXs = new Int32Array(capacity);
    this.cellYs = new Int32Array(capacity);
  }

  clear(): void {
    this.heads.fill(-1);
    this.count = 0;
  }

  insert(id: number, x: number, y: number): void {
    if (this.count >= this.capacity) {
      throw new Error(`SpatialHash: capacity ${this.capacity} exceeded`);
    }
    const entry = this.count++;
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    const bucket = this.bucket(cellX, cellY);
    this.ids[entry] = id;
    this.xs[entry] = x;
    this.ys[entry] = y;
    this.cellXs[entry] = cellX;
    this.cellYs[entry] = cellY;
    this.next[entry] = this.heads[bucket];
    this.heads[bucket] = entry;
  }

  /**
   * Writes the ids within `radius` of (x, y) into `out` and returns how many were written.
   * Stops when `out` is full.
   */
  query(x: number, y: number, radius: number, out: Int32Array): number {
    const radiusSq = radius * radius;
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);
    let found = 0;
    for (let cellY = minY; cellY <= maxY; cellY++) {
      for (let cellX = minX; cellX <= maxX; cellX++) {
        for (let e = this.heads[this.bucket(cellX, cellY)]; e !== -1; e = this.next[e]) {
          if (this.cellXs[e] !== cellX || this.cellYs[e] !== cellY) continue;
          const dx = this.xs[e] - x;
          const dy = this.ys[e] - y;
          if (dx * dx + dy * dy > radiusSq) continue;
          if (found === out.length) return found;
          out[found++] = this.ids[e];
        }
      }
    }
    return found;
  }

  private bucket(cellX: number, cellY: number): number {
    return (Math.imul(cellX, 73856093) ^ Math.imul(cellY, 19349663)) & this.mask;
  }
}
