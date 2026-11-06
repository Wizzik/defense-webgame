import {
  ConeGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MeshBasicNodeMaterial,
  RingGeometry,
} from "three/webgpu";
import type { GameData } from "../../data/schema";
import { EventKind, type Run, TICKS_PER_SECOND } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";

const SPIKE_POOL = 160;
const RING_POOL = 64;
/** Distance between two spikes along a cast line, in world units. */
const SPIKE_SPACING = 75;
const SPIKE_LIFE = 0.6;
const SPIKE_GROW = 0.1;
const SPIKE_FADE = 0.2;
const SPIKE_RADIUS = 0.22;
const SPIKE_HEIGHT = 0.9;
const RING_LIFE = 0.3;
const RING_RADIUS = 0.9;

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
 * Spell spikes along each cast line and a ring where an enemy dies. Both live in fixed pools
 * of instances; the oldest entry is overwritten. Times are simulation seconds.
 */
export class Effects implements RunView {
  readonly object = new Group();
  private readonly data: GameData;
  private readonly spikes: InstancedMesh;
  private readonly rings: InstancedMesh;
  // spike: scene position and the time it appears; ring: scene position and its birth time
  private readonly spikeX = new Float32Array(SPIKE_POOL);
  private readonly spikeZ = new Float32Array(SPIKE_POOL);
  private readonly spikeStart = new Float32Array(SPIKE_POOL).fill(-1000);
  private readonly ringX = new Float32Array(RING_POOL);
  private readonly ringZ = new Float32Array(RING_POOL);
  private readonly ringStart = new Float32Array(RING_POOL).fill(-1000);
  private nextSpike = 0;
  private nextRing = 0;
  private lastTick = 0;

  constructor(data: GameData) {
    this.data = data;
    const cone = new ConeGeometry(SPIKE_RADIUS, 1, 8);
    cone.translate(0, 0.5, 0);
    this.spikes = new InstancedMesh(cone, new MeshBasicNodeMaterial({ color: 0xffa233 }), SPIKE_POOL);
    const ring = new RingGeometry(0.8, 1, 24);
    ring.rotateX(-Math.PI / 2);
    this.rings = new InstancedMesh(ring, new MeshBasicNodeMaterial({ color: 0xffffff }), RING_POOL);
    for (const mesh of [this.spikes, this.rings]) {
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
        const p = this.nextRing;
        this.nextRing = (p + 1) % RING_POOL;
        this.ringX[p] = events.x[i] * SCENE_SCALE;
        this.ringZ[p] = -events.y[i] * SCENE_SCALE;
        this.ringStart[p] = now;
      }
    }
  }

  update(run: Run, alpha: number, _dt: number): void {
    this.write((run.tick + alpha) / TICKS_PER_SECOND);
  }

  private write(now: number): void {
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
    const rm = this.rings.instanceMatrix.array as Float32Array;
    for (let p = 0; p < RING_POOL; p++) {
      const age = now - this.ringStart[p];
      if (age < 0 || age > RING_LIFE) {
        writeMatrix(rm, p, 0, 0, 0, 0, 0);
        continue;
      }
      writeMatrix(rm, p, this.ringX[p], 0.05, this.ringZ[p], RING_RADIUS * (age / RING_LIFE), 1);
    }
    this.spikes.instanceMatrix.needsUpdate = true;
    this.rings.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const mesh of [this.spikes, this.rings]) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicNodeMaterial).dispose();
      mesh.dispose();
    }
  }

  private addSpikes(run: Run, event: number, now: number): void {
    const { events } = run;
    const slot = run.abilities[events.a[event]];
    const { params } = slot.def;
    const speed = "waveSpeed" in params ? params.waveSpeed?.[slot.level - 1] : undefined;
    const length = events.value[event];
    for (let d = SPIKE_SPACING; d <= length; d += SPIKE_SPACING) {
      const p = this.nextSpike;
      this.nextSpike = (p + 1) % SPIKE_POOL;
      this.spikeX[p] = (events.x[event] + events.u[event] * d) * SCENE_SCALE;
      this.spikeZ[p] = -(events.y[event] + events.v[event] * d) * SCENE_SCALE;
      this.spikeStart[p] = now + (speed ? d / speed : 0);
    }
  }

  private reset(): void {
    this.spikeStart.fill(-1000);
    this.ringStart.fill(-1000);
    this.nextSpike = 0;
    this.nextRing = 0;
  }

  private hideAll(): void {
    this.write(0);
  }
}
