// The step a lockstep game should have reached by now (Petr's net test, 2026-11-21): a window that was throttled or
// hidden catches up to wall-clock time instead of dropping it, as far as the inputs allow. Pure: the page passes
// the time in.

/** Most steps one pump may run, so a long pause does not freeze the page for seconds; the rest follows next pump. */
export const MAX_CATCH_UP = 90;

export class WallClock {
  private start = -1;

  constructor(private readonly stepMs: number) {}

  /** The step count due at `nowMs` (the first call starts the clock at step 0). */
  due(nowMs: number): number {
    if (this.start < 0) this.start = nowMs;
    return Math.floor((nowMs - this.start) / this.stepMs + 1e-9);
  }

  /** How many steps to run now when `done` steps have run: up to the due count, at most MAX_CATCH_UP. */
  pending(nowMs: number, done: number): number {
    return Math.max(0, Math.min(this.due(nowMs) - done, MAX_CATCH_UP));
  }
}
