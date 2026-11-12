/** One line of news under the clock: a newer line replaces the older one, and a line leaves after its ticks. */
export class Announcer {
  private line = "";
  private left = 0;

  /** The line to show now; empty when there is none. */
  get text(): string {
    return this.left > 0 ? this.line : "";
  }

  push(text: string, ticks: number): void {
    this.line = text;
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
