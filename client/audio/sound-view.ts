import { type Camera, Vector3 } from "three/webgpu";
import type { AudioData } from "../../data/schema/audio";
import { EventKind, type Run } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "../render/coords";
import type { AudioEngine } from "./engine";
import { type CueRequest, type CueState, newCueRequests, resolveEventCues } from "./event-cues";
import { LowHpPulse } from "./low-hp-pulse";
import type { MusicDirector } from "./music-director";
import { panFromNdc } from "./pan";

const MAX_REQUESTS = 256;
/** Quick XP pickups rise a step each (12 steps = an octave) and fall back after this pause. */
const PICKUP_CHAIN_SECONDS = 1;
const PICKUP_STEPS = 12;

/** Turns simulation events into cues through the audio data. Draws nothing. */
export class SoundView implements RunView {
  private readonly engine: AudioEngine;
  private readonly data: AudioData;
  private readonly director: MusicDirector;
  private readonly camera: Camera;
  private readonly enemyIds: readonly string[];
  private readonly active: () => boolean;
  private readonly requests: CueRequest[] = newCueRequests(MAX_REQUESTS);
  private readonly state: CueState = { lastHeroHealTick: -1e9 };
  private readonly pulse = new LowHpPulse();
  private readonly point = new Vector3();
  private clock = 0;
  private pickupChain = 0;
  private lastPickup = -Infinity;

  constructor(engine: AudioEngine, data: AudioData, director: MusicDirector, camera: Camera, enemyIds: readonly string[], active: () => boolean = () => true) {
    this.engine = engine;
    this.data = data;
    this.director = director;
    this.camera = camera;
    this.enemyIds = enemyIds;
    this.active = active;
  }

  update(run: Run, _alpha: number, dt: number): void {
    this.clock += dt;
    const playing = run.state === "playing" && this.active();
    if (this.pulse.update(run.hero.hp, run.hero.stats.maxHp, playing, this.clock)) this.engine.play(this.data.sounds.lowHp);
  }

  onEvents(run: Run): void {
    const { events } = run;
    for (let i = 0; i < events.count; i++) {
      const kind = events.kind[i];
      if (kind === EventKind.BossSpawn || kind === EventKind.RushWarning) this.director.onAlert(performance.now() / 1000);
    }
    const n = resolveEventCues(run, this.data, this.enemyIds, this.requests, this.state);
    for (let i = 0; i < n; i++) {
      const r = this.requests[i]!;
      let pan = 0;
      let gain = 1;
      if (r.world) {
        this.point.set(r.x * SCENE_SCALE, 0, -r.y * SCENE_SCALE).project(this.camera);
        const p = panFromNdc(this.point.x, this.point.y);
        pan = p.pan;
        gain = p.gain;
      }
      this.engine.play(r.cue, { pan, gain, rate: r.cue === this.data.sounds["pickup.xp"] ? this.pickupRate() : 1 });
    }
  }

  dispose(): void {}

  private pickupRate(): number {
    this.pickupChain = this.clock - this.lastPickup < PICKUP_CHAIN_SECONDS ? Math.min(this.pickupChain + 1, PICKUP_STEPS) : 0;
    this.lastPickup = this.clock;
    return 2 ** (this.pickupChain / 12);
  }
}
