import {
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  MeshStandardNodeMaterial,
} from "three/webgpu";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { AllyKind, TICKS_PER_SECOND, type Run } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";
import { Figure } from "./figure";
import { heroBodyColor } from "./hero-tints";

/** Most shadow copies shown at once (three per cast; a recast replaces the old ones). */
export const IMAGE_POOL = 6;

const BODY_FACTOR = 1.4;
const COPY_OPACITY = 0.55;
const FADE_IN = 0.2;
const FADE_OUT = 1;

const TOTEM_COLOR = 0x1fa38a;
const SHAFT_RADIUS = 0.12;
const SHAFT_HEIGHT = 0.6;
const HEAD_RADIUS = 0.18;
const HEAD_HEIGHT = 0.25;
const STRETCH = 1.15;
const STRETCH_SECONDS = 0.1;

/** Serpent wards (instanced totems) and shadow copies (a pool of translucent hero figures). `update` does not allocate. */
export class AllyView implements RunView {
  private readonly shafts: InstancedMesh;
  private readonly heads: InstancedMesh;
  private readonly figures: Figure[] = [];
  /** Ally slot shown by each figure, or -1; and the last attack tick the figure has punched for. */
  private readonly owner = new Int32Array(IMAGE_POOL).fill(-1);
  private readonly punched = new Int32Array(IMAGE_POOL).fill(-1);
  private readonly shown = new Uint8Array(IMAGE_POOL);
  private readonly opacity = new Float32Array(IMAGE_POOL).fill(-1);
  private readonly spawn = new Int32Array(IMAGE_POOL).fill(-1);
  private lastRun: Run | null = null;
  private fitted = false;

  constructor(gltf: GLTF, capacity: number) {
    const material = (): MeshStandardNodeMaterial =>
      new MeshStandardNodeMaterial({ color: 0x2a5a52, emissive: TOTEM_COLOR, emissiveIntensity: 0.9, roughness: 0.6 });
    const shaft = new CylinderGeometry(SHAFT_RADIUS, SHAFT_RADIUS, SHAFT_HEIGHT, 12);
    shaft.translate(0, SHAFT_HEIGHT / 2, 0);
    const head = new ConeGeometry(HEAD_RADIUS, HEAD_HEIGHT, 12);
    head.translate(0, SHAFT_HEIGHT + HEAD_HEIGHT / 2, 0);
    this.shafts = new InstancedMesh(shaft, material(), capacity);
    this.heads = new InstancedMesh(head, material(), capacity);
    for (const mesh of [this.shafts, this.heads]) {
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
    }
    for (let i = 0; i < IMAGE_POOL; i++) {
      const figure = new Figure(gltf);
      figure.object.visible = false;
      figure.setOpacity(COPY_OPACITY);
      this.figures.push(figure);
    }
  }

  /** The things to add to the scene. */
  get objects(): readonly [InstancedMesh, InstancedMesh, ...Figure["object"][]] {
    return [this.shafts, this.heads, ...this.figures.map((f) => f.object)];
  }

  update(run: Run, alpha: number, dt: number): void {
    const { allies, hero } = run;
    if (run !== this.lastRun) this.start(run);
    if (!this.fitted) {
      for (const figure of this.figures) figure.fit(2 * hero.stats.collision * BODY_FACTOR * SCENE_SCALE);
      this.fitted = true;
    }
    const nowTick = run.tick + alpha;
    this.shown.fill(0);

    const m = this.shafts.instanceMatrix.array as Float32Array;
    const h = this.heads.instanceMatrix.array as Float32Array;
    let wards = 0;
    for (let slot = 0; slot < allies.capacity; slot++) {
      if (allies.alive[slot] === 0) continue;
      const x = (allies.prevX[slot]! + (allies.x[slot]! - allies.prevX[slot]!) * alpha) * SCENE_SCALE;
      const z = -(allies.prevY[slot]! + (allies.y[slot]! - allies.prevY[slot]!) * alpha) * SCENE_SCALE;
      if (allies.kind[slot] === AllyKind.Ward) {
        const since = (nowTick - allies.lastAttackTick[slot]!) / TICKS_PER_SECOND;
        const stretch = allies.lastAttackTick[slot]! >= 0 && since >= 0 && since < STRETCH_SECONDS ? STRETCH : 1;
        writeTotem(m, wards, x, z, stretch);
        writeTotem(h, wards, x, z, stretch);
        wards++;
      } else {
        this.drawImage(run, slot, x, z, nowTick);
      }
    }
    this.shafts.count = this.heads.count = wards;
    this.shafts.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < IMAGE_POOL; i++) {
      const figure = this.figures[i]!;
      if (this.shown[i] === 0) {
        figure.object.visible = false;
        this.owner[i] = -1;
        continue;
      }
      figure.update(dt);
    }
  }

  dispose(): void {
    for (const mesh of [this.shafts, this.heads]) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      (mesh.material as MeshStandardNodeMaterial).dispose();
      mesh.dispose();
    }
    for (const figure of this.figures) figure.dispose();
  }

  /** A new run: every copy hides and takes the new hero's colour. */
  private start(run: Run): void {
    this.lastRun = run;
    const color = heroBodyColor(run.hero.def.id);
    this.owner.fill(-1);
    this.punched.fill(-1);
    this.opacity.fill(-1);
    for (const figure of this.figures) {
      figure.setTint(color);
      figure.reset();
      figure.object.visible = false;
    }
  }

  private drawImage(run: Run, slot: number, x: number, z: number, nowTick: number): void {
    const { allies } = run;
    let i = -1;
    let free = -1;
    for (let f = 0; f < IMAGE_POOL; f++) {
      if (this.owner[f] === slot && this.spawn[f] === allies.spawnTick[slot]) {
        i = f;
        break;
      }
      if (free < 0 && this.owner[f] === -1) free = f;
    }
    if (i < 0) {
      if (free < 0) return;
      i = free;
      this.owner[i] = slot;
      this.spawn[i] = allies.spawnTick[slot]!;
      this.punched[i] = allies.lastAttackTick[slot]!;
      this.figures[i]!.reset();
    }
    this.shown[i] = 1;
    const figure = this.figures[i]!;
    figure.object.visible = true;
    figure.setMoving(allies.moving[slot] !== 0);
    figure.setPose(x, z, allies.facingX[slot]!, allies.facingY[slot]!);
    if (allies.lastAttackTick[slot] !== this.punched[i]) {
      this.punched[i] = allies.lastAttackTick[slot]!;
      figure.punch();
    }
    const appear = (nowTick - allies.spawnTick[slot]!) / TICKS_PER_SECOND / FADE_IN;
    const vanish = (allies.expiresTick[slot]! - nowTick) / TICKS_PER_SECOND / FADE_OUT;
    const k = Math.max(0, Math.min(1, appear, vanish));
    const opacity = COPY_OPACITY * k;
    if (opacity !== this.opacity[i]) {
      this.opacity[i] = opacity;
      figure.setOpacity(opacity);
    }
  }
}

/** Upright, scaled in height by `stretch`, standing at (x, z). */
function writeTotem(m: Float32Array, i: number, x: number, z: number, stretch: number): void {
  const o = i * 16;
  m.fill(0, o, o + 16);
  m[o] = 1;
  m[o + 5] = stretch;
  m[o + 10] = 1;
  m[o + 12] = x;
  m[o + 14] = z;
  m[o + 15] = 1;
}
