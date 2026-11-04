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

/** Benchmark overlay: keeps the last frame durations and publishes `window.__spike`. */
export class Overlay {
  private readonly element: HTMLElement;
  private readonly durations = new Float32Array(WINDOW_FRAMES);
  private next = 0;
  private filled = 0;
  private lastRefresh = Number.NEGATIVE_INFINITY;
  private state: SpikeState | null = null;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  /** Called once the renderer runs; from here on `window.__spike` exists. */
  start(backend: Backend, n: number): void {
    this.state = { backend, n, frames: 0, avgFps: 0, low1Fps: 0 };
    window.__spike = this.state;
    this.render(this.state);
  }

  frame(durationMs: number, now: number): void {
    const state = this.state;
    if (!state) return;
    this.durations[this.next] = durationMs;
    this.next = (this.next + 1) % WINDOW_FRAMES;
    if (this.filled < WINDOW_FRAMES) this.filled++;
    state.frames++;
    if (now - this.lastRefresh < REFRESH_MS) return;
    this.lastRefresh = now;
    const stats = frameStats(this.durations, this.filled);
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
