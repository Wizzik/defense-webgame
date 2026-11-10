import type { GameData } from "../../data/schema";
import { createRun, EventKind, NO_INPUT, type Run, TICK_SECONDS, type TickInput } from "../../sim";
import { SCENE_SCALE } from "../render/coords";
import type { FollowCamera } from "../render/camera";
import type { Scene } from "three/webgpu";
import { FixedStepLoop } from "./loop";
import type { Keyboard } from "./keyboard";
import type { GameParams } from "./params";
import { viewTiming } from "./view-timing";

/** Most simulation steps one frame may run at speed 1; a longer backlog is dropped. */
const MAX_STEPS_PER_FRAME = 4;

/** Camera shake in scene units for a cast and for a hit on the hero. */
const SHAKE_CAST = 0.25;
const SHAKE_HERO_HIT = 0.1;

/** One visual layer of a run (hero, enemies, crystals, effects). */
export interface RunView {
  /** Every frame; `alpha` interpolates between the last two simulation steps. */
  update(run: Run, alpha: number, dt: number): void;
  /** After every simulation step; reads `run.events`. */
  onEvents?(run: Run): void;
  dispose(): void;
}

/** Owns the run: turns frames into input and simulation steps and feeds the views and the camera. */
export class Session {
  readonly views: RunView[] = [];
  readonly scene: Scene;
  run: Run | null = null;
  /** Seed of the current run. */
  seed = 0;
  /** A paused session shows its run but does not step it (the menu backdrop). */
  paused = false;
  private readonly data: GameData;
  private readonly params: GameParams;
  private readonly camera: FollowCamera;
  private readonly keyboard: Keyboard;
  private readonly loop = new FixedStepLoop(TICK_SECONDS, MAX_STEPS_PER_FRAME);
  private readonly input: TickInput = { ...NO_INPUT };
  private pendingCard = -1;

  constructor(deps: { data: GameData; params: GameParams; scene: Scene; camera: FollowCamera; keyboard: Keyboard }) {
    this.data = deps.data;
    this.params = deps.params;
    this.scene = deps.scene;
    this.camera = deps.camera;
    this.keyboard = deps.keyboard;
  }

  start(seed: number, paused = false, hero?: string): void {
    this.run = createRun(this.data, { seed, hero, durationSeconds: this.params.durationSeconds });
    this.seed = seed;
    this.paused = paused;
    this.pendingCard = -1;
  }

  /** The next step gets `input.card = index`, once. */
  setCard(index: number): void {
    this.pendingCard = index;
  }

  /** Input, then simulation steps (`onEvents` after each), then `update(alpha)` and the camera. */
  frame(dtSeconds: number): void {
    const { run, input } = this;
    if (!run) return;
    // keys pressed behind the menu must not fire when the run starts
    if (this.paused) this.keyboard.read(input);
    const steps = this.paused ? 0 : this.loop.advance(dtSeconds, this.params.speed);
    for (let i = 0; i < steps; i++) {
      this.keyboard.read(input);
      input.card = this.pendingCard;
      this.pendingCard = -1;
      run.step(input);
      for (const view of this.views) view.onEvents?.(run);
      this.shakeForEvents(run);
    }
    // Frozen while a card is chosen or the run is over: no interpolation, no animation time.
    const { alpha, dt } = viewTiming(run.state, this.loop.alpha, dtSeconds);
    // The camera moves first so views that project to the screen use this frame's camera.
    const { hero } = run;
    this.camera.follow(
      (hero.prevX + (hero.x - hero.prevX) * alpha) * SCENE_SCALE,
      -(hero.prevY + (hero.y - hero.prevY) * alpha) * SCENE_SCALE,
      dtSeconds,
      dt,
    );
    for (const view of this.views) view.update(run, alpha, dt);
  }

  private shakeForEvents(run: Run): void {
    const { events } = run;
    for (let i = 0; i < events.count; i++) {
      if (events.kind[i] === EventKind.Cast) this.camera.shake(SHAKE_CAST);
      else if (events.kind[i] === EventKind.HeroHit) this.camera.shake(SHAKE_HERO_HIT);
    }
  }
}
