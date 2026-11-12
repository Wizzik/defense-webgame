import { attribute, float, max, mix, step, texture, uniform, uv, vec3, vertexColor } from "three/tsl";
import {
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshStandardNodeMaterial,
  type UniformNode,
  Vector3,
} from "three/webgpu";
import { Action, type Run, TICKS_PER_SECOND } from "../../sim";
import type { RunView } from "../game/session";
import { MODEL_HEIGHT_FACTOR, SCENE_SCALE } from "./coords";
import { CrowdBuckets } from "./crowd-buckets";
import { type BakedVat, type VatClip, vatPositionNode } from "./vat";

export const WALK_CLIP = "Walking";
export const PUNCH_CLIP = "Punch";
export const IDLE_CLIP = "Idle";

/** Rate the VAT is baked at; the game bakes and plays at this rate. */
export const VAT_FPS = 30;
/** Seconds after a hit during which an enemy flashes white. */
const FLASH_SECONDS = 0.12;
/** How far the model's own colours are pulled toward the type colour. */
const BODY_TINT = 0.45;
/** Share of the type colour that the model also emits, so the type reads in the dark arena. */
const GLOW = 0.12;
/** Marks "never hit" in `anim.w`, far enough in the past for the flash window. */
const NEVER = -1000;

function requireClip(vat: BakedVat, name: string): VatClip {
  const clip = vat.clips[name];
  if (!clip) throw new Error(`EnemyCrowd: clip "${name}" was not baked`);
  return clip;
}

/** One enemy type: its instanced mesh and the arrays the mesh reads. */
interface TypeMesh {
  mesh: InstancedMesh;
  matrices: Float32Array;
  anim: Float32Array;
  animAttribute: InstancedBufferAttribute;
  walk: VatClip;
  punch: VatClip;
  idle: VatClip;
  /** Model height and the height of its lowest point at scale 1. */
  height: number;
  feet: number;
}

/**
 * All living enemies, one instanced mesh with baked animation per enemy type. Living slots are
 * packed into instances `0..n-1` of their type's mesh every frame. Takes ownership of the
 * geometry of every `vat`. `update` does not allocate.
 */
export class EnemyCrowd implements RunView {
  readonly object = new Group();
  /** Instanced meshes in `object`: one per enemy type. */
  readonly meshCount: number;
  private readonly time: UniformNode<"float"> = uniform(0);
  private readonly types: TypeMesh[];
  private readonly buckets: CrowdBuckets;

  /** `vats` and `tints` are indexed by enemy type; `tints`: linear rgb per type (`tintTable`). */
  constructor(vats: BakedVat[], capacity: number, tints: Float32Array) {
    this.types = vats.map((vat, type) => this.createType(vat, capacity, tints, type));
    this.meshCount = this.types.length;
    this.buckets = new CrowdBuckets(vats.length, capacity);
    for (const { mesh } of this.types) this.object.add(mesh);
  }

  private createType(vat: BakedVat, capacity: number, tints: Float32Array, type: number): TypeMesh {
    const { geometry } = vat;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;

    const anim = new Float32Array(capacity * 4);
    const animAttribute = new InstancedBufferAttribute(anim, 4);
    animAttribute.setUsage(DynamicDrawUsage);
    geometry.setAttribute("anim", animAttribute);

    const animNode = attribute("anim", "vec4");
    const tint = uniform(new Vector3(tints[type * 3], tints[type * 3 + 1], tints[type * 3 + 2]));
    const material = new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.1 });
    // the model's own colours are multiplied toward the type colour at full brightness, then a glow is added
    const peak = max(max(tint.x, tint.y), max(tint.z, 0.001));
    const base = vat.map ? texture(vat.map, uv()).rgb : vertexColor();
    material.colorNode = base.mul(mix(vec3(1, 1, 1), tint.div(peak), BODY_TINT));
    material.positionNode = vatPositionNode(vat, animNode, this.time, VAT_FPS);
    // glow in the type colour, white for a moment after a hit
    const sinceHit = this.time.sub(animNode.w);
    material.emissiveNode = mix(tint.mul(GLOW), vec3(1, 1, 1), float(1).sub(step(FLASH_SECONDS, sinceHit)));

    const mesh = new InstancedMesh(geometry, material, capacity);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    // instances move every frame, so a bounding sphere computed once would cull them wrongly
    mesh.frustumCulled = false;
    mesh.count = 0;
    return {
      mesh,
      matrices: mesh.instanceMatrix.array as Float32Array,
      anim,
      animAttribute,
      walk: requireClip(vat, WALK_CLIP),
      punch: requireClip(vat, PUNCH_CLIP),
      idle: requireClip(vat, IDLE_CLIP),
      height: box.max.y - box.min.y,
      feet: box.min.y,
    };
  }

  update(run: Run, alpha: number, _dt: number): void {
    const { enemies } = run;
    const seconds = 1 / TICKS_PER_SECOND;
    this.time.value = (run.tick + alpha) * seconds;
    const { buckets, types } = this;
    buckets.reset();
    for (let slot = 0; slot < enemies.capacity; slot++) {
      if (enemies.alive[slot] === 0) continue;
      const x = enemies.prevX[slot] + (enemies.x[slot] - enemies.prevX[slot]) * alpha;
      const y = enemies.prevY[slot] + (enemies.y[slot] - enemies.prevY[slot]) * alpha;
      const type = enemies.type[slot];
      const { matrices, anim, walk, punch, idle, height, feet } = types[type];
      const n = buckets.push(type);
      const diameter = 2 * run.data.enemies[type].collision * SCENE_SCALE;
      const scale = (MODEL_HEIGHT_FACTOR * diameter) / height;
      // rotation about Y turning the model's +Z axis to the heading (north is -z in the scene)
      const cos = -enemies.facingY[slot] * scale;
      const sin = enemies.facingX[slot] * scale;
      const o = n * 16;
      matrices[o] = cos;
      matrices[o + 1] = 0;
      matrices[o + 2] = -sin;
      matrices[o + 3] = 0;
      matrices[o + 4] = 0;
      matrices[o + 5] = scale;
      matrices[o + 6] = 0;
      matrices[o + 7] = 0;
      matrices[o + 8] = sin;
      matrices[o + 9] = 0;
      matrices[o + 10] = cos;
      matrices[o + 11] = 0;
      matrices[o + 12] = x * SCENE_SCALE;
      matrices[o + 13] = -feet * scale;
      matrices[o + 14] = -y * SCENE_SCALE;
      matrices[o + 15] = 1;

      const action = enemies.action[slot];
      let clip = walk;
      let start = enemies.spawnTick[slot] * seconds - ((slot * 0.37) % 1) * (walk.frames / VAT_FPS);
      if (action === Action.Attack) {
        clip = punch;
        start = enemies.lastAttackTick[slot] * seconds;
      } else if (action === Action.Stunned) {
        clip = idle;
        start = 0;
      }
      const a = n * 4;
      anim[a] = clip.startFrame;
      anim[a + 1] = clip.frames;
      anim[a + 2] = start;
      anim[a + 3] = enemies.lastHitTick[slot] < 0 ? NEVER : enemies.lastHitTick[slot] * seconds;
    }
    for (let type = 0; type < types.length; type++) {
      const { mesh, animAttribute } = types[type];
      mesh.count = buckets.count(type);
      mesh.instanceMatrix.needsUpdate = true;
      animAttribute.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const { mesh } of this.types) {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardNodeMaterial).dispose();
      mesh.dispose();
    }
  }
}
