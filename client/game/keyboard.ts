import { InputAction, type TickInput } from "../../sim";

const LEFT = ["KeyA", "ArrowLeft"];
const RIGHT = ["KeyD", "ArrowRight"];
const UP = ["KeyW", "ArrowUp"];
const DOWN = ["KeyS", "ArrowDown"];
const ACTION_KEYS: Readonly<Record<string, number>> = {
  KeyR: InputAction.Ultimate,
  KeyT: InputAction.ToggleAuto,
  Space: InputAction.Dash,
  KeyF: InputAction.Blink,
};
const MOVE_KEYS = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN]);

type KeyTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">;

/** Turns the pointer's place (normalized device coordinates) into the blink's aim from the hero, or null. */
export type AimFn = (ndcX: number, ndcY: number) => { x: number; y: number } | null;

/** A key aimed at a button or an input belongs to that element (Space clicks the button). */
function targetsControl(event: Event): boolean {
  const tag = (event.target as { tagName?: string } | null)?.tagName;
  return tag === "BUTTON" || tag === "INPUT";
}

/**
 * Held movement keys (WASD and arrows) and the action keys R, T, Space and F, by `event.code`, so any keyboard
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
  /** The pointer in normalized device coordinates (the window is the canvas); the centre until it moves. */
  private ndcX = 0;
  private ndcY = 0;
  private readonly onPointerMove = (event: Event): void => {
    const { clientX, clientY } = event as PointerEvent;
    const w = globalThis.innerWidth || 1;
    const h = globalThis.innerHeight || 1;
    this.ndcX = (clientX / w) * 2 - 1;
    this.ndcY = 1 - (clientY / h) * 2;
  };
  /** Set by the session: the aim of a blink at the pointer. Without it a blink aims straight ahead. */
  aimAt: AimFn | null = null;
  private readonly onBlur = (): void => {
    this.held.clear();
    this.pending = 0;
  };

  constructor(target: KeyTarget) {
    this.target = target;
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("blur", this.onBlur);
    target.addEventListener("pointermove", this.onPointerMove);
  }

  /** Sets `moveX`, `moveY` and `actions` (the presses since the last read); `card` is left alone. */
  read(out: TickInput): void {
    out.moveX = this.axis(RIGHT) - this.axis(LEFT);
    out.moveY = this.axis(UP) - this.axis(DOWN);
    out.actions = this.pending;
    this.pending = 0;
    const aim = (out.actions & InputAction.Blink) !== 0 && this.aimAt ? this.aimAt(this.ndcX, this.ndcY) : null;
    out.aimX = aim ? Math.round(aim.x) : undefined;
    out.aimY = aim ? Math.round(aim.y) : undefined;
  }

  dispose(): void {
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("blur", this.onBlur);
    this.target.removeEventListener("pointermove", this.onPointerMove);
    this.held.clear();
    this.pending = 0;
  }

  private axis(codes: string[]): number {
    return this.held.has(codes[0]!) || this.held.has(codes[1]!) ? 1 : 0;
  }
}
