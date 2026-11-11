import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MeshBasicNodeMaterial,
  SphereGeometry,
} from "three/webgpu";
import type { GameData } from "../../data/schema";
import { EventKind, type Run, TICKS_PER_SECOND } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";

const SPIKE_POOL = 160;
const POP_POOL = 64;
/** Distance between two spikes along a cast line, in world units. */
const SPIKE_SPACING = 75;
const SPIKE_LIFE = 0.6;
const SPIKE_GROW = 0.1;
const SPIKE_FADE = 0.2;
const SPIKE_RADIUS = 0.22;
const SPIKE_HEIGHT = 0.9;
const POP_LIFE = 0.25;
/** Final diameter of the pop sphere, relative to the enemy's diameter. */
const POP_SIZE = 1.4;

/** Matrix with uniform xz scale, y scale and a translation; scale 0 hides the instance. */
function writeMatrix(m: Float32Array, i: number, x: number, y: number, z: number, scaleXz: number, scaleY: number): void {
  const o = i * 16;
  m.fill(0, o, o + 16);
  m[o] = scaleXz;
  m[o + 5] = scaleY;
  m[o + 10] = scaleXz;
  m[o + 12] = x;
  m[o + 13] = y;
  m[o + 14] = z;
  m[o + 15] = 1;
}

/**
 * Spell spikes along each cast line and a pop sphere where an enemy dies. Both live in fixed pools
 * of instances; the oldest entry is overwritten. Times are simulation seconds.
 */
export class Effects implements RunView {
  readonly object = new Group();
  private readonly data: GameData;
  private readonly spikes: InstancedMesh;
  private readonly pops: InstancedMesh;
  // spike: scene position and the time it appears; pop: scene position, birth time and final diameter
  private readonly spikeX = new Float32Array(SPIKE_POOL);
  private readonly spikeZ = new Float32Array(SPIKE_POOL);
  private readonly spikeStart = new Float32Array(SPIKE_POOL).fill(-1000);
  private readonly popX = new Float32Array(POP_POOL);
  private readonly popZ = new Float32Array(POP_POOL);
  private readonly popSize = new Float32Array(POP_POOL);
  private readonly popStart = new Float32Array(POP_POOL).fill(-1000);
  private nextSpike = 0;
  private nextPop = 0;
  private lastTick = 0;
  /** Simulation time until which some spike or pop is (or will be) visible. */
  private busyUntil = Number.NEGATIVE_INFINITY;
  /** True when the last write showed (or awaited) something, so one more write must hide it. */
  private shown = true;

  constructor(data: GameData) {
    this.data = data;
    const cone = new ConeGeometry(SPIKE_RADIUS, 1, 8);
    cone.translate(0, 0.5, 0);
    this.spikes = new InstancedMesh(cone, new MeshBasicNodeMaterial({ color: 0xffa233 }), SPIKE_POOL);
    // additive blending: fading the instance colour to black fades the sphere out
    const popMaterial = new MeshBasicNodeMaterial({ color: 0xffffff });
    popMaterial.transparent = true;
    popMaterial.depthWrite = false;
    popMaterial.blending = AdditiveBlending;
    this.pops = new InstancedMesh(new SphereGeometry(0.5, 12, 8), popMaterial, POP_POOL);
    this.pops.setColorAt(0, new Color(0));
    for (const mesh of [this.spikes, this.pops]) {
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.object.add(mesh);
    }
    this.hideAll();
  }

  onEvents(run: Run): void {
    const { events } = run;
    const now = run.tick / TICKS_PER_SECOND;
    if (run.tick < this.lastTick) this.reset();
    this.lastTick = run.tick;
    for (let i = 0; i < events.count; i++) {
      if (events.kind[i] === EventKind.Cast) this.addSpikes(run, i, now);
      else if (events.kind[i] === EventKind.Death) {
        const p = this.nextPop;
        this.nextPop = (p + 1) % POP_POOL;
        const def = this.data.enemies[run.enemies.type[events.a[i]]];
        this.popX[p] = events.x[i] * SCENE_SCALE;
        this.popZ[p] = -events.y[i] * SCENE_SCALE;
        this.popSize[p] = 2 * def.collision * SCENE_SCALE * POP_SIZE;
        this.popStart[p] = now;
        this.busyUntil = Math.max(this.busyUntil, now + POP_LIFE);
      }
    }
  }

  update(run: Run, alpha: number, _dt: number): void {
    this.write((run.tick + alpha) / TICKS_PER_SECOND);
  }

  /** Skips the write and the GPU upload while nothing is visible or waiting. */
  private write(now: number): void {
    const live = now <= this.busyUntil;
    if (!live && !this.shown) return;
    this.shown = live;
    const sm = this.spikes.instanceMatrix.array as Float32Array;
    for (let p = 0; p < SPIKE_POOL; p++) {
      const age = now - this.spikeStart[p];
      if (age < 0 || age > SPIKE_LIFE) {
        writeMatrix(sm, p, 0, 0, 0, 0, 0);
        continue;
      }
      const grow = Math.min(1, age / SPIKE_GROW);
      const fade = Math.min(1, (SPIKE_LIFE - age) / SPIKE_FADE);
      writeMatrix(sm, p, this.spikeX[p], 0, this.spikeZ[p], 1, SPIKE_HEIGHT * grow * fade);
    }
    const pm = this.pops.instanceMatrix.array as Float32Array;
    const pc = this.pops.instanceColor!.array as Float32Array;
    for (let p = 0; p < POP_POOL; p++) {
      const age = now - this.popStart[p];
      if (age < 0 || age > POP_LIFE) {
        writeMatrix(pm, p, 0, 0, 0, 0, 0);
        pc[p * 3] = pc[p * 3 + 1] = pc[p * 3 + 2] = 0;
        continue;
      }
      const t = age / POP_LIFE;
      const size = this.popSize[p] * t;
      writeMatrix(pm, p, this.popX[p], size * 0.5, this.popZ[p], size, size);
      const brightness = (1 - t) * 0.6;
      pc[p * 3] = pc[p * 3 + 1] = pc[p * 3 + 2] = brightness;
    }
    this.spikes.instanceMatrix.needsUpdate = true;
    this.pops.instanceMatrix.needsUpdate = true;
    this.pops.instanceColor!.needsUpdate = true;
  }

  dispose(): void {
    for (const mesh of [this.spikes, this.pops]) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicNodeMaterial).dispose();
      mesh.dispose();
    }
  }

  private addSpikes(run: Run, event: number, now: number): void {
    const { events } = run;
    const slot = run.abilities[events.a[event]];
    if (slot.def.kind !== "line") return;
    const { params } = slot.def;
    const speed = "waveSpeed" in params ? params.waveSpeed?.[slot.level - 1] : undefined;
    const length = events.value[event];
    for (let d = SPIKE_SPACING; d <= length; d += SPIKE_SPACING) {
      const p = this.nextSpike;
      this.nextSpike = (p + 1) % SPIKE_POOL;
      this.spikeX[p] = (events.x[event] + events.u[event] * d) * SCENE_SCALE;
      this.spikeZ[p] = -(events.y[event] + events.v[event] * d) * SCENE_SCALE;
      this.spikeStart[p] = now + (speed ? d / speed : 0);
      this.busyUntil = Math.max(this.busyUntil, this.spikeStart[p] + SPIKE_LIFE);
    }
  }

  private reset(): void {
    this.spikeStart.fill(-1000);
    this.popStart.fill(-1000);
    this.nextSpike = 0;
    this.nextPop = 0;
    this.busyUntil = Number.NEGATIVE_INFINITY;
  }

  private hideAll(): void {
    this.write(0);
  }
}
