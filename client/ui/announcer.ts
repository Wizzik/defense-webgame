/** One line of news under the clock: a newer line replaces the older one, and a line leaves after its ticks. */
export class Announcer {
  private line = "";
  private left = 0;
  private lineTone = "";

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

  /** One simulation step passed. */
  step(): void {
    if (this.left > 0) this.left--;
  }

  clear(): void {
    this.left = 0;
  }
}
