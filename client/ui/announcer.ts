/**
 * One line of news under the clock: a newer line replaces the older one, and a line leaves after its ticks.
 * A queued line waits until the line on screen ends (the faction news after a boss's).
 */
export class Announcer {
  private line = "";
  private left = 0;
  private lineTone = "";
  private next = "";
  private nextTicks = 0;

  /** The line to show now; empty when there is none. */
  get text(): string {
    return this.left > 0 ? this.line : "";
  }

  /** CSS class of the line to show now (a rarity colour for loot); empty for plain news. */
  get tone(): string {
    return this.left > 0 ? this.lineTone : "";
  }

  push(text: string, ticks: number, tone = ""): void {
    this.line = text;
    this.lineTone = tone;
    this.left = ticks;
  }

  /** Shows `text` when the line on screen ends, or at once when none shows. */
  queue(text: string, ticks: number): void {
    if (this.left <= 0) {
      this.push(text, ticks);
      return;
    }
    this.next = text;
    this.nextTicks = ticks;
  }

  /** One simulation step passed. */
  step(): void {
    if (this.left > 0) this.left--;
    if (this.left <= 0 && this.nextTicks > 0) {
      this.push(this.next, this.nextTicks);
      this.nextTicks = 0;
    }
  }

  clear(): void {
    this.left = 0;
    this.nextTicks = 0;
  }
}
