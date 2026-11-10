import {
  type AnimationAction,
  AnimationMixer,
  Box3,
  Color,
  Group,
  LoopOnce,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type SkinnedMesh,
} from "three/webgpu";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";

const FADE_SECONDS = 0.15;
/** How far the model's own colour moves toward the tint, and how much of the tint glows. */
const TINT_MIX = 0.75;
const TINT_GLOW = 0.25;

export const IDLE_CLIP = "Idle";
export const RUN_CLIP = "Running";
export const PUNCH_CLIP = "Punch";
export const DEATH_CLIP = "Death";

interface Tinted {
  material: MeshStandardMaterial;
  base: Color;
}

/** A skinned copy of the robot with its own materials and animation mixer: idles, runs, punches, dies. */
export class Figure {
  readonly object = new Group();
  private readonly model: Object3D;
  private readonly mixer: AnimationMixer;
  private readonly idle: AnimationAction;
  private readonly running: AnimationAction;
  private readonly punching: AnimationAction;
  private readonly death: AnimationAction;
  private readonly materials: Tinted[] = [];
  private readonly tint = new Color();
  /** Footprint of the idle pose and the height of its lowest point, at scale 1. */
  private readonly modelWidth: number;
  private readonly modelFeet: number;
  private current: AnimationAction;
  private wantedBase: AnimationAction;
  private isPunching = false;
  private dead = false;

  constructor(gltf: GLTF) {
    // a copy, so the VAT bake can use the same glTF
    this.model = clone(gltf.scene);
    this.model.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      const own = (material: Material): Material => {
        const copy = material.clone() as MeshStandardMaterial;
        if (copy.color) this.materials.push({ material: copy, base: copy.color.clone() });
        return copy;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material);
    });
    this.object.add(this.model);

    this.mixer = new AnimationMixer(this.model);
    const action = (name: string): AnimationAction => {
      const found = gltf.animations.find((c) => c.name === name);
      if (!found) throw new Error(`Figure: the model has no "${name}" clip`);
      return this.mixer.clipAction(found);
    };
    this.idle = action(IDLE_CLIP);
    this.running = action(RUN_CLIP);
    this.punching = action(PUNCH_CLIP);
    this.punching.setLoop(LoopOnce, 1);
    this.death = action(DEATH_CLIP);
    this.death.setLoop(LoopOnce, 1);
    this.death.clampWhenFinished = true;
    this.current = this.idle;
    this.wantedBase = this.idle;
    this.idle.play();
    this.mixer.update(0);
    const box = this.measure();
    this.modelWidth = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    this.modelFeet = box.min.y;
    this.mixer.addEventListener("finished", (event) => {
      if (event.action === this.punching) {
        this.isPunching = false;
        this.fadeTo(this.wantedBase);
      }
    });
  }

  /** Moves the model's colour toward `hex` (keeping some of its shading) and adds a mild glow of it. */
  setTint(hex: number): void {
    this.tint.setHex(hex);
    for (const { material, base } of this.materials) {
      material.color.copy(base).lerp(this.tint, TINT_MIX);
      material.emissive?.copy(this.tint).multiplyScalar(TINT_GLOW);
    }
  }

  /** Below 1 the materials turn transparent. */
  setOpacity(opacity: number): void {
    const transparent = opacity < 1;
    for (const { material } of this.materials) {
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = opacity;
    }
  }

  /** Scales the model to a footprint of `diameterScene` and puts its feet on the floor. */
  fit(diameterScene: number): void {
    const scale = diameterScene / this.modelWidth;
    this.model.scale.setScalar(scale);
    this.model.position.y = -this.modelFeet * scale;
  }

  /** The model faces +Z; north is -z in the scene. */
  setPose(sceneX: number, sceneZ: number, facingX: number, facingY: number): void {
    this.object.position.set(sceneX, 0, sceneZ);
    this.object.rotation.y = Math.atan2(facingX, -facingY);
  }

  setMoving(moving: boolean): void {
    this.wantedBase = moving ? this.running : this.idle;
    if (!this.isPunching && !this.dead) this.fadeTo(this.wantedBase);
  }

  /** Plays the punch; a repeated punch starts over. */
  punch(): void {
    if (this.dead) return;
    this.isPunching = true;
    this.fadeTo(this.punching);
  }

  die(): void {
    this.dead = true;
    this.isPunching = false;
    this.fadeTo(this.death);
  }

  /** Back to standing, alive (a new run). */
  reset(): void {
    this.dead = false;
    this.isPunching = false;
    this.wantedBase = this.idle;
    this.fadeTo(this.idle);
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.object.removeFromParent();
    for (const { material } of this.materials) material.dispose();
  }

  /** Bounding box of the posed skinned meshes (the plain box would use the unposed geometry). */
  private measure(): Box3 {
    this.model.updateMatrixWorld(true);
    this.model.traverse((node) => (node as SkinnedMesh).skeleton?.update());
    return new Box3().setFromObject(this.model, true);
  }

  private fadeTo(next: AnimationAction): void {
    if (next === this.current) {
      if (next === this.punching) next.reset().play();
      return;
    }
    next.reset().fadeIn(FADE_SECONDS).play();
    this.current.fadeOut(FADE_SECONDS);
    this.current = next;
  }
}
