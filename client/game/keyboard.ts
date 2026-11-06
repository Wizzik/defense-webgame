import type { TickInput } from "../../sim";

const LEFT = ["KeyA", "ArrowLeft"];
const RIGHT = ["KeyD", "ArrowRight"];
const UP = ["KeyW", "ArrowUp"];
const DOWN = ["KeyS", "ArrowDown"];
const MOVE_KEYS = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN]);

type KeyTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">;

/** Held movement keys (WASD and arrows, by `event.code`, so any keyboard layout works). */
export class Keyboard {
  private readonly target: KeyTarget;
  private readonly held = new Set<string>();
  private readonly onKeyDown = (event: Event): void => {
    const { code } = event as KeyboardEvent;
    if (!MOVE_KEYS.has(code)) return;
    this.held.add(code);
    event.preventDefault();
  };
  private readonly onKeyUp = (event: Event): void => {
    this.held.delete((event as KeyboardEvent).code);
  };
  private readonly onBlur = (): void => {
    this.held.clear();
  };

  constructor(target: KeyTarget) {
    this.target = target;
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("blur", this.onBlur);
  }

  /** Sets `moveX` and `moveY`; `card` is left alone. */
  read(out: TickInput): void {
    out.moveX = this.axis(RIGHT) - this.axis(LEFT);
    out.moveY = this.axis(UP) - this.axis(DOWN);
  }

  dispose(): void {
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("blur", this.onBlur);
    this.held.clear();
  }

  private axis(codes: string[]): number {
    return this.held.has(codes[0]!) || this.held.has(codes[1]!) ? 1 : 0;
  }
}
