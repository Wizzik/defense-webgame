import { attribute, uniform } from "three/tsl";
import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshStandardNodeMaterial,
  type UniformNode,
} from "three/webgpu";
import { type BakedVat, type VatClip, vatPositionNode } from "../render/vat";
import { Rng } from "../../sim/rng";
import { SpatialHash } from "../../sim/spatial-grid";

export const WALK_CLIP = "Walking";
export const RUN_CLIP = "Running";

/** Footprint diameter of one unit in world units; the model is scaled to it. */
const UNIT_SIZE = 1;
const SEPARATION_RADIUS = 1.2 * UNIT_SIZE;
/** Push speed (world units per second) between two units standing on the same spot. */
const SEPARATION_SPEED = 6;
/** Spawn points and random targets lie inside this circle around the arena centre. */
const ARENA_RADIUS = 22;
const ARRIVE_DISTANCE = 1.5 * UNIT_SIZE;
const WALK_SPEED = 1.6;
const RUN_SPEED = 3.6;
const RUN_SHARE = 0.35;
/** How fast the heading follows the velocity, per second. */
const TURN_RATE = 8;
const MAX_NEIGHBOURS = 32;

export interface CrowdOptions {
  count: number;
  seed: number;
  /** Rate the VAT was sampled at. */
  fps: number;
}

/**
 * Instanced crowd that walks to the arena centre, then to random targets, kept apart by a
 * spatial hash. Takes ownership of `vat.geometry`. `update` does not allocate.
 */
export class Crowd {
  readonly mesh: InstancedMesh;
  private readonly count: number;
  private readonly rng: Rng;
  private readonly time: UniformNode<"float"> = uniform(0);
  private readonly scale: number;
  private readonly lift: number;
  private readonly x: Float32Array;
  private readonly z: Float32Array;
  private readonly targetX: Float32Array;
  private readonly targetZ: Float32Array;
  private readonly velocityX: Float32Array;
  private readonly velocityZ: Float32Array;
  /** Unit vector the model faces (its +Z axis). */
  private readonly headingX: Float32Array;
  private readonly headingZ: Float32Array;
  private readonly speed: Float32Array;
  private readonly hash: SpatialHash;
  private readonly neighbours = new Int32Array(MAX_NEIGHBOURS);

  constructor(vat: BakedVat, options: CrowdOptions) {
    const { count } = options;
    this.count = count;
    this.rng = new Rng(options.seed);
    this.x = new Float32Array(count);
    this.z = new Float32Array(count);
    this.targetX = new Float32Array(count);
    this.targetZ = new Float32Array(count);
    this.velocityX = new Float32Array(count);
    this.velocityZ = new Float32Array(count);
    this.headingX = new Float32Array(count);
    this.headingZ = new Float32Array(count);
    this.speed = new Float32Array(count);
    this.hash = new SpatialHash(SEPARATION_RADIUS, count);

    const geometry = vat.geometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    this.scale = UNIT_SIZE / Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    this.lift = -box.min.y * this.scale;

    const walk = requireClip(vat, WALK_CLIP);
    const run = requireClip(vat, RUN_CLIP);
    const anim = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const radius = ARENA_RADIUS * Math.sqrt(this.rng.next());
      const angle = 2 * Math.PI * this.rng.next();
      this.x[i] = radius * Math.cos(angle);
      this.z[i] = radius * Math.sin(angle);
      // first target is the arena centre, so face it (+Z for a unit spawned on it)
      this.headingX[i] = radius > 1e-6 ? -this.x[i] / radius : 0;
      this.headingZ[i] = radius > 1e-6 ? -this.z[i] / radius : 1;
      const runs = this.rng.next() < RUN_SHARE;
      this.speed[i] = runs ? RUN_SPEED : WALK_SPEED;
      const picked = runs ? run : walk;
      anim[i * 4] = picked.startFrame;
      anim[i * 4 + 1] = picked.frames;
      // a start time before 0 offsets the loop by a random phase
      anim[i * 4 + 2] = (-this.rng.next() * picked.frames) / options.fps;
    }
    geometry.setAttribute("anim", new InstancedBufferAttribute(anim, 4));

    const material = new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.1 });
    material.positionNode = vatPositionNode(vat, attribute("anim", "vec4"), this.time, options.fps);
    this.mesh = new InstancedMesh(geometry, material, count);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    // instances move every frame, so a bounding sphere computed once would cull them wrongly
    this.mesh.frustumCulled = false;
    this.writeMatrices();
  }

  update(dt: number): void {
    this.time.value += dt;
    this.steer();
    this.move(dt);
    this.writeMatrices();
  }

  private steer(): void {
    const { count, x, z, hash, neighbours } = this;
    hash.clear();
    for (let i = 0; i < count; i++) hash.insert(i, x[i], z[i]);
    for (let i = 0; i < count; i++) {
      let dx = this.targetX[i] - x[i];
      let dz = this.targetZ[i] - z[i];
      if (dx * dx + dz * dz < ARRIVE_DISTANCE * ARRIVE_DISTANCE) {
        this.pickTarget(i);
        dx = this.targetX[i] - x[i];
        dz = this.targetZ[i] - z[i];
      }
      const distance = Math.sqrt(dx * dx + dz * dz);
      let vx = distance > 1e-6 ? (dx / distance) * this.speed[i] : 0;
      let vz = distance > 1e-6 ? (dz / distance) * this.speed[i] : 0;
      const found = hash.query(x[i], z[i], SEPARATION_RADIUS, neighbours);
      for (let k = 0; k < found; k++) {
        const j = neighbours[k];
        if (j === i) continue;
        const ox = x[i] - x[j];
        const oz = z[i] - z[j];
        const d = Math.sqrt(ox * ox + oz * oz);
        if (d < 1e-6) {
          // same spot: split the pair along x, in opposite directions
          vx += i < j ? SEPARATION_SPEED : -SEPARATION_SPEED;
          continue;
        }
        // grows linearly from 0 at the radius to SEPARATION_SPEED at full overlap
        const push = (SEPARATION_SPEED * (SEPARATION_RADIUS - d)) / (SEPARATION_RADIUS * d);
        vx += ox * push;
        vz += oz * push;
      }
      this.velocityX[i] = vx;
      this.velocityZ[i] = vz;
    }
  }

  private move(dt: number): void {
    const turn = Math.min(1, TURN_RATE * dt);
    for (let i = 0; i < this.count; i++) {
      const vx = this.velocityX[i];
      const vz = this.velocityZ[i];
      this.x[i] += vx * dt;
      this.z[i] += vz * dt;
      const speed = Math.sqrt(vx * vx + vz * vz);
      if (speed < 1e-3) continue;
      const hx = this.headingX[i] + (vx / speed - this.headingX[i]) * turn;
      const hz = this.headingZ[i] + (vz / speed - this.headingZ[i]) * turn;
      const length = Math.sqrt(hx * hx + hz * hz);
      if (length < 1e-6) continue;
      this.headingX[i] = hx / length;
      this.headingZ[i] = hz / length;
    }
  }

  private pickTarget(i: number): void {
    const radius = ARENA_RADIUS * Math.sqrt(this.rng.next());
    const angle = 2 * Math.PI * this.rng.next();
    this.targetX[i] = radius * Math.cos(angle);
    this.targetZ[i] = radius * Math.sin(angle);
  }

  /** Scale, rotation about Y (model +Z to the heading) and translation, column-major. */
  private writeMatrices(): void {
    const m = this.mesh.instanceMatrix.array as Float32Array;
    const s = this.scale;
    for (let i = 0, o = 0; i < this.count; i++, o += 16) {
      const cos = this.headingZ[i] * s;
      const sin = this.headingX[i] * s;
      m[o] = cos;
      m[o + 1] = 0;
      m[o + 2] = -sin;
      m[o + 3] = 0;
      m[o + 4] = 0;
      m[o + 5] = s;
      m[o + 6] = 0;
      m[o + 7] = 0;
      m[o + 8] = sin;
      m[o + 9] = 0;
      m[o + 10] = cos;
      m[o + 11] = 0;
      m[o + 12] = this.x[i];
      m[o + 13] = this.lift;
      m[o + 14] = this.z[i];
      m[o + 15] = 1;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function requireClip(vat: BakedVat, name: string): VatClip {
  const clip = vat.clips[name];
  if (!clip) throw new Error(`Crowd: clip "${name}" was not baked`);
  return clip;
}
