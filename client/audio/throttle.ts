/** Lets one sound through at most `max` times per `windowSeconds`. Each key counts on its own. */
export class Throttle {
  private readonly max: number;
  private readonly windowSeconds: number;
  private readonly recent = new Map<string, number[]>();

  constructor(max: number, windowSeconds: number) {
    this.max = max;
    this.windowSeconds = windowSeconds;
  }

  allow(key: string, now: number): boolean {
    let times = this.recent.get(key);
    if (!times) {
      times = [];
      this.recent.set(key, times);
    }
    while (times.length > 0 && now - times[0]! >= this.windowSeconds) times.shift();
    if (times.length >= this.max) return false;
    times.push(now);
    return true;
  }
}
