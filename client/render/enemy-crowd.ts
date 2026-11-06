import { attribute, color, float, mix, step, uniform, vec3, vertexColor } from "three/tsl";
import {
  Color,
  type ColorRepresentation,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshStandardNodeMaterial,
  type UniformNode,
} from "three/webgpu";
import { Action, type Run, TICKS_PER_SECOND } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";
import { type BakedVat, type VatClip, vatPositionNode } from "./vat";

export const WALK_CLIP = "Walking";
export const PUNCH_CLIP = "Punch";
export const IDLE_CLIP = "Idle";

/** Rate the VAT is baked at; the game bakes and plays at this rate. */
export const VAT_FPS = 30;
/** Seconds after a hit during which an enemy flashes white. */
const FLASH_SECONDS = 0.12;
/** Marks "never hit" in `anim.w`, far enough in the past for the flash window. */
const NEVER = -1000;

function requireClip(vat: BakedVat, name: string): VatClip {
  const clip = vat.clips[name];
  if (!clip) throw new Error(`EnemyCrowd: clip "${name}" was not baked`);
  return clip;
}

/**
 * All living enemies as one instanced mesh with baked animation. Living slots are packed into
 * instances `0..n-1` every frame. Takes ownership of `vat.geometry`. `update` does not allocate.
 */
export class EnemyCrowd implements RunView {
  readonly mesh: InstancedMesh;
  private readonly time: UniformNode<"float"> = uniform(0);
  private readonly anim: Float32Array;
  private readonly animAttribute: InstancedBufferAttribute;
  private readonly walk: VatClip;
  private readonly punch: VatClip;
  private readonly idle: VatClip;
  /** Model width (footprint) and the height of its lowest point at scale 1. */
  private readonly modelWidth: number;
  private readonly modelFeet: number;

  constructor(vat: BakedVat, capacity: number, tint: ColorRepresentation) {
    this.walk = requireClip(vat, WALK_CLIP);
    this.punch = requireClip(vat, PUNCH_CLIP);
    this.idle = requireClip(vat, IDLE_CLIP);
    const { geometry } = vat;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    this.modelWidth = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    this.modelFeet = box.min.y;

    this.anim = new Float32Array(capacity * 4);
    this.animAttribute = new InstancedBufferAttribute(this.anim, 4);
    this.animAttribute.setUsage(DynamicDrawUsage);
    geometry.setAttribute("anim", this.animAttribute);

    const anim = attribute("anim", "vec4");
    const material = new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.1 });
    // the model's own colours are multiplied toward red, then the emissive tint is added
    material.colorNode = vertexColor().mul(vec3(1, 0.4, 0.4));
    material.positionNode = vatPositionNode(vat, anim, this.time, VAT_FPS);
    // red tint, white for a moment after a hit
    const sinceHit = this.time.sub(anim.w);
    material.emissiveNode = mix(color(new Color(tint)), vec3(1, 1, 1), float(1).sub(step(FLASH_SECONDS, sinceHit)));

    this.mesh = new InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    // instances move every frame, so a bounding sphere computed once would cull them wrongly
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  update(run: Run, alpha: number, _dt: number): void {
    const { enemies } = run;
    const seconds = 1 / TICKS_PER_SECOND;
    this.time.value = (run.tick + alpha) * seconds;
    const matrices = this.mesh.instanceMatrix.array as Float32Array;
    const { anim } = this;
    let n = 0;
    for (let slot = 0; slot < enemies.capacity; slot++) {
      if (enemies.alive[slot] === 0) continue;
      const x = enemies.prevX[slot] + (enemies.x[slot] - enemies.prevX[slot]) * alpha;
      const y = enemies.prevY[slot] + (enemies.y[slot] - enemies.prevY[slot]) * alpha;
      const diameter = 2 * run.data.enemies[enemies.type[slot]].collision * SCENE_SCALE;
      const scale = diameter / this.modelWidth;
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
      matrices[o + 13] = -this.modelFeet * scale;
      matrices[o + 14] = -y * SCENE_SCALE;
      matrices[o + 15] = 1;

      const action = enemies.action[slot];
      let clip = this.walk;
      let start = enemies.spawnTick[slot] * seconds - ((slot * 0.37) % 1) * (this.walk.frames / VAT_FPS);
      if (action === Action.Attack) {
        clip = this.punch;
        start = enemies.lastAttackTick[slot] * seconds;
      } else if (action === Action.Stunned) {
        clip = this.idle;
        start = 0;
      }
      const a = n * 4;
      anim[a] = clip.startFrame;
      anim[a + 1] = clip.frames;
      anim[a + 2] = start;
      anim[a + 3] = enemies.lastHitTick[slot] < 0 ? NEVER : enemies.lastHitTick[slot] * seconds;
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.animAttribute.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshStandardNodeMaterial).dispose();
    this.mesh.dispose();
  }
}
