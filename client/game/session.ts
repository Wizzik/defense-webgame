import type { DifficultyId, GameData } from "../../data/schema";
import { botInput, createRun, EventKind, HeroHitSource, InputAction, type LoadoutEntry, NO_INPUT, type PlayerOptions, type Run, SlamEvent, TICK_SECONDS, type TickInput, ULTIMATE_SLOT } from "../../sim";
import { CoopNet, type CoopNetDeps } from "../net/coop-net";
import { SCENE_SCALE } from "../render/coords";
import type { FollowCamera } from "../render/camera";
import type { Scene } from "three/webgpu";
import { FixedStepLoop } from "./loop";
import type { Keyboard } from "./keyboard";
import type { GameParams } from "./params";
import { viewTiming } from "./view-timing";

/** Most simulation steps one frame may run at speed 1; a longer backlog is dropped. */
const MAX_STEPS_PER_FRAME = 4;

/** Camera shake in scene units for the ultimate (and a boss slam that lands), for another shaking cast, and for a hit on the hero. */
const SHAKE_ULTIMATE = 0.25;
const SHAKE_CAST = 0.12;
const SHAKE_HERO_HIT = 0.1;

/** Ability kinds whose cast shakes the camera. */
const SHAKING_KINDS: ReadonlySet<string> = new Set(["line", "nova", "area", "ticking_area", "cone"]);

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
  /** The player this window steers (0 alone; the guest of a co-op run is 1). Views and the HUD show him. */
  local = 0;
  /** The net loop of a co-op run, or null for a run of one player. */
  coop: CoopNet | null = null;
  private pausedFlag = false;
  /** World and difficulty of the next run (the world screen sets them). */
  world = 1;
  difficulty: DifficultyId = "normal";
  private readonly data: GameData;
  private readonly params: GameParams;
  private readonly camera: FollowCamera;
  private readonly keyboard: Keyboard;
  private readonly loop = new FixedStepLoop(TICK_SECONDS, MAX_STEPS_PER_FRAME);
  private readonly input: TickInput = { ...NO_INPUT };
  /** ?mate (debug): the autopilot's input for the second player of a local co-op run. */
  private readonly mateInput: TickInput = { ...NO_INPUT };
  private readonly inputs: TickInput[] = [this.input, this.mateInput];
  private pendingCard = -1;
  private pendingKeep = false;
  /** Co-op: the offer the last card was sent for; a card goes out once per offer (inputs travel a few steps ahead). */
  private sentFor: object | null = null;

  constructor(deps: { data: GameData; params: GameParams; scene: Scene; camera: FollowCamera; keyboard: Keyboard }) {
    this.data = deps.data;
    this.params = deps.params;
    this.scene = deps.scene;
    this.camera = deps.camera;
    this.keyboard = deps.keyboard;
  }

  /** The permanent items a hero wears into a run; main.ts sets it to the player's doll. */
  loadoutFor: (heroId: string) => readonly LoadoutEntry[] = () => [];
  /** Called when a run starts. */
  onStart: () => void = () => {};

  /** A paused session shows its run but does not step it (the menu backdrop). A co-op run never pauses. */
  get paused(): boolean {
    return this.pausedFlag && !this.coop;
  }

  set paused(value: boolean) {
    this.pausedFlag = value;
  }

  /** Runs `fn` with `run.current` on the local player, so `run.hero`, `run.offer`, ... read his; then back to 0. */
  asLocal<T>(fn: (run: Run) => T): T | undefined {
    const { run } = this;
    if (!run) return undefined;
    run.current = this.local;
    try {
      return fn(run);
    } finally {
      run.current = 0;
    }
  }

  /** Ends a co-op run's net loop (and its link); the session is a one-player session again. */
  private leaveCoop(): void {
    this.coop?.stop();
    this.coop = null;
    this.local = 0;
    this.sentFor = null;
  }

  /**
   * Starts a co-op run of `players` in which this window steers `local`; the returned net loop steps it once
   * started (the guest at once, the host when the guest is ready).
   */
  startCoop(seed: number, players: readonly PlayerOptions[], local: 0 | 1, net: Pick<CoopNetDeps, "peer" | "onLeft" | "onDesync">): CoopNet {
    this.leaveCoop();
    this.run = createRun(this.data, { seed, players, world: this.world, difficulty: this.difficulty });
    this.onStart();
    this.seed = seed;
    this.paused = false;
    this.local = local;
    this.pendingCard = -1;
    this.pendingKeep = false;
    this.coop = new CoopNet({
      ...net, local, run: this.run,
      readInput: (out) => this.coopInput(out),
      afterStep: (run) => this.afterStep(run),
    });
    return this.coop;
  }

  start(seed: number, paused = false, hero?: string): void {
    this.leaveCoop();
    const { startPhase, durationSeconds } = this.params;
    // a phase the data does not have is ignored: the run starts normally
    const phase = startPhase !== undefined && startPhase <= this.data.rules.phases.length + 1 ? startPhase : undefined;
    const loadout = this.loadoutFor(hero ?? this.data.rules.start.hero);
    const mate = this.mate();
    this.run = createRun(this.data, {
      seed, durationSeconds, startPhase: phase, world: this.world, difficulty: this.difficulty,
      ...(mate ? { players: [{ hero, loadout }, { hero: mate }] } : { hero, loadout }),
    });
    this.onStart();
    this.seed = seed;
    this.paused = paused;
    this.pendingCard = -1;
    this.pendingKeep = false;
  }

  /** The second hero of a local debug co-op run (?debug=1&mate=<id>), or undefined. */
  private mate(): string | undefined {
    const id = this.params.mate;
    return id && this.data.heroes.some((h) => h.id === id) ? id : undefined;
  }

  /** The next step gets `input.card = index`, once; `keep` adds the KeepWorn bit (keep the worn item of a chest Choice). */
  setCard(index: number, keep = false): void {
    this.pendingCard = index;
    this.pendingKeep = keep;
  }

  /** The local input of a co-op step: the keys, and a picked card once per offer of the local player. */
  private coopInput(out: TickInput): void {
    this.keyboard.read(out);
    out.card = -1;
    const run = this.run;
    if (this.pendingCard >= 0 && run) {
      const own = run.players[this.local]!;
      const offer = own.offer ?? own.chestOffer;
      if (offer && offer !== this.sentFor) {
        out.card = this.pendingCard;
        if (this.pendingKeep) out.actions |= InputAction.KeepWorn;
        this.sentFor = offer;
      }
    }
    this.pendingCard = -1;
    this.pendingKeep = false;
  }

  /** After a step: the views read its events as the local player sees them, and the camera shakes. */
  private afterStep(run: Run): void {
    run.current = this.local;
    try {
      for (const view of this.views) view.onEvents?.(run);
      this.shakeForEvents(run);
    } finally {
      run.current = 0;
    }
  }

  /** Input, then simulation steps (`onEvents` after each), then `update(alpha)` and the camera. */
  frame(dtSeconds: number): void {
    const { run, input } = this;
    if (!run) return;
    // a co-op run steps from its net loop; the frame only draws
    const coop = this.coop;
    // keys pressed behind the menu must not fire when the run starts
    if (this.paused) this.keyboard.read(input);
    const steps = this.paused || coop ? 0 : this.loop.advance(dtSeconds, this.params.speed);
    for (let i = 0; i < steps; i++) {
      this.keyboard.read(input);
      input.card = this.pendingCard;
      if (this.pendingKeep) input.actions |= InputAction.KeepWorn;
      this.pendingCard = -1;
      this.pendingKeep = false;
      if (run.players.length > 1) {
        // ?mate: the autopilot steers the second hero and picks his cards at once
        run.current = 1;
        botInput(run, this.mateInput);
        run.current = 0;
        run.step(this.inputs);
      } else run.step(input);
      this.afterStep(run);
    }
    // Frozen while a card is chosen or the run is over: no interpolation, no animation time.
    const loopAlpha = coop ? coop.alpha(performance.now()) : this.loop.alpha;
    const { alpha, dt } = viewTiming(run.state, loopAlpha, dtSeconds);
    run.current = this.local;
    try {
      this.draw(run, alpha, dt, dtSeconds);
    } finally {
      run.current = 0;
    }
  }

  private draw(run: Run, alpha: number, dt: number, dtSeconds: number): void {
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
      // a teammate's casts and hits do not shake this window's camera
      if (events.kind[i] === EventKind.Cast && events.player[i] !== this.local) continue;
      if (events.kind[i] === EventKind.HeroHit && events.v[i] !== this.local) continue;
      if (events.kind[i] === EventKind.Cast) {
        const slot = events.a[i]!;
        if (SHAKING_KINDS.has(run.abilities[slot]!.def.kind)) {
          this.camera.shake(slot === ULTIMATE_SLOT ? SHAKE_ULTIMATE : SHAKE_CAST);
        }
      } else if (events.kind[i] === EventKind.HeroHit && events.u[i] !== HeroHitSource.Cloud) this.camera.shake(SHAKE_HERO_HIT);
      else if (events.kind[i] === EventKind.Slam && events.value[i] === SlamEvent.Hit) this.camera.shake(SHAKE_ULTIMATE);
    }
  }
}
