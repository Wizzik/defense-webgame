/** mulberry32: small seeded RNG; the same sequence in every JS engine. */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), this.s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer 0..n-1. */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** uint32 for the state hash. */
  get state(): number {
    return this.s;
  }
}
