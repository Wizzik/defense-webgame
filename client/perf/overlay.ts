import { frameStats } from "./frame-stats";

export type Backend = "WebGPU" | "WebGL2";

/** Read by the e2e tests. `frames` grows every frame; the fps values follow the overlay text. */
export interface SpikeState {
  backend: Backend;
  n: number;
  frames: number;
  avgFps: number;
  low1Fps: number;
}

declare global {
  interface Window {
    __spike?: SpikeState;
  }
}

/** Frames the fps statistics cover. */
const WINDOW_FRAMES = 120;
/** Statistics and text are refreshed this often, so normal frames do not allocate. */
const REFRESH_MS = 500;

/** Frames longer than this (a hidden tab, a debugger pause) are not statistics, so they are skipped. */
const MAX_FRAME_MS = 250;

/** Frame-rate overlay: keeps the last frame durations; the spike also publishes `window.__spike`. */
export class Overlay {
  private readonly element: HTMLElement;
  private readonly publishState: boolean;
  private readonly durations = new Float32Array(WINDOW_FRAMES);
  private readonly sorted = new Float32Array(WINDOW_FRAMES);
  private next = 0;
  private filled = 0;
  private lastRefresh = Number.NEGATIVE_INFINITY;
  private state: SpikeState | null = null;

  /** `publishState` makes `start` publish `window.__spike` (the spike's e2e tests read it). */
  constructor(element: HTMLElement, publishState = false) {
    this.element = element;
    this.publishState = publishState;
  }

  /** Called once the renderer runs; with `publishState`, `window.__spike` exists from here on. */
  start(backend: Backend, n: number): void {
    this.state = { backend, n, frames: 0, avgFps: 0, low1Fps: 0 };
    if (this.publishState) window.__spike = this.state;
    this.render(this.state);
  }

  /** `n` replaces the count shown on the `n` line (the game passes the live enemies). */
  frame(durationMs: number, now: number, n?: number): void {
    const state = this.state;
    if (!state) return;
    if (n !== undefined) state.n = n;
    state.frames++;
    if (durationMs <= MAX_FRAME_MS) {
      this.durations[this.next] = durationMs;
      this.next = (this.next + 1) % WINDOW_FRAMES;
      if (this.filled < WINDOW_FRAMES) this.filled++;
    }
    if (this.filled === 0) return;
    if (now - this.lastRefresh < REFRESH_MS) return;
    this.lastRefresh = now;
    const stats = frameStats(this.durations, this.filled, this.sorted);
    state.avgFps = stats.avgFps;
    state.low1Fps = stats.low1Fps;
    this.render(state);
  }

  showError(error: unknown): void {
    this.element.textContent = `Chyba: ${error instanceof Error ? error.message : String(error)}`;
    this.element.classList.add("error");
  }

  private render(state: SpikeState): void {
    const fps = (value: number) => (state.frames > 0 ? value.toFixed(1) : "-");
    this.element.textContent = [
      `backend  ${state.backend}`,
      `n        ${state.n}`,
      `avg fps  ${fps(state.avgFps)}`,
      `1% low   ${fps(state.low1Fps)}`,
    ].join("\n");
  }
}
