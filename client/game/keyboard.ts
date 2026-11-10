import { InputAction, type TickInput } from "../../sim";

const LEFT = ["KeyA", "ArrowLeft"];
const RIGHT = ["KeyD", "ArrowRight"];
const UP = ["KeyW", "ArrowUp"];
const DOWN = ["KeyS", "ArrowDown"];
const ACTION_KEYS: Readonly<Record<string, number>> = {
  KeyR: InputAction.Ultimate,
  KeyT: InputAction.ToggleAuto,
  Space: InputAction.Dash,
};
const MOVE_KEYS = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN]);

type KeyTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">;

/** A key aimed at a button or an input belongs to that element (Space clicks the button). */
function targetsControl(event: Event): boolean {
  const tag = (event.target as { tagName?: string } | null)?.tagName;
  return tag === "BUTTON" || tag === "INPUT";
}

/**
 * Held movement keys (WASD and arrows) and the action keys R, T and Space, by `event.code`, so any keyboard
 * layout works. An action key counts once per press; holding it does not repeat.
 */
export class Keyboard {
  private readonly target: KeyTarget;
  private readonly held = new Set<string>();
  /** Action bits pressed since the last `read`. */
  private pending = 0;
  private readonly onKeyDown = (event: Event): void => {
    const { code, repeat } = event as KeyboardEvent;
    const action = ACTION_KEYS[code];
    if (!MOVE_KEYS.has(code) && action === undefined) return;
    if (targetsControl(event)) return;
    event.preventDefault();
    if (action !== undefined) {
      if (!repeat) this.pending |= action;
      return;
    }
    this.held.add(code);
  };
  private readonly onKeyUp = (event: Event): void => {
    this.held.delete((event as KeyboardEvent).code);
  };
  private readonly onBlur = (): void => {
    this.held.clear();
    this.pending = 0;
  };

  constructor(target: KeyTarget) {
    this.target = target;
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("blur", this.onBlur);
  }

  /** Sets `moveX`, `moveY` and `actions` (the presses since the last read); `card` is left alone. */
  read(out: TickInput): void {
    out.moveX = this.axis(RIGHT) - this.axis(LEFT);
    out.moveY = this.axis(UP) - this.axis(DOWN);
    out.actions = this.pending;
    this.pending = 0;
  }

  dispose(): void {
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("blur", this.onBlur);
    this.held.clear();
    this.pending = 0;
  }

  private axis(codes: string[]): number {
    return this.held.has(codes[0]!) || this.held.has(codes[1]!) ? 1 : 0;
  }
}
