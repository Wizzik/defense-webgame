/**
 * Sums the hero's heals over a short window, so lifesteal and the heal orb show one green number now and then
 * instead of one every step. Times are in seconds of run time.
 */
export class HealWindow {
  private sum = 0;
  private start = -1;
  private readonly seconds: number;

  constructor(seconds: number) {
    this.seconds = seconds;
  }

  add(amount: number, now: number): void {
    if (amount <= 0) return;
    if (this.start < 0) this.start = now;
    this.sum += amount;
  }

  /** The summed hp once the window since the first heal has passed (0 before, and for less than 1 hp). */
  take(now: number): number {
    if (this.start < 0 || now - this.start < this.seconds) return 0;
    const sum = this.sum;
    this.clear();
    return sum >= 1 ? sum : 0;
  }

  clear(): void {
    this.sum = 0;
    this.start = -1;
  }
}
