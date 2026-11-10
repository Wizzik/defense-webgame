import {
  AnimationAction,
  AnimationMixer,
  Box3,
  Color,
  Group,
  LoopOnce,
  type Material,
  type Mesh,
  type Object3D,
  type SkinnedMesh,
} from "three/webgpu";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { EventKind, type Run } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";
import { heroTint } from "./hero-tints";

/** The hero's footprint is 1.4 times its collision circle. */
const BODY_FACTOR = 1.4;
const FADE_SECONDS = 0.15;

export const IDLE_CLIP = "Idle";
export const RUN_CLIP = "Running";
export const PUNCH_CLIP = "Punch";
export const DEATH_CLIP = "Death";

/** The hero: a copy of the robot that idles, runs, punches on attacks and casts, and dies. */
export class HeroView implements RunView {
  readonly object = new Group();
  private readonly model: Object3D;
  private readonly mixer: AnimationMixer;
  private readonly idle: AnimationAction;
  private readonly running: AnimationAction;
  private readonly punch: AnimationAction;
  private readonly death: AnimationAction;
  /** Footprint of the idle pose and the height of its lowest point, at scale 1. */
  private readonly modelWidth: number;
  private readonly modelFeet: number;
  private current: AnimationAction;
  private wantedBase: AnimationAction;
  private punching = false;
  private fitted = false;
  private lastRun: Run | null = null;

  constructor(gltf: GLTF) {
    // a copy, so the VAT bake (Task 10) can use the same glTF
    this.model = clone(gltf.scene);
    this.model.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      const own = (material: Material): Material => material.clone();
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material);
    });
    this.object.add(this.model);

    this.mixer = new AnimationMixer(this.model);
    const action = (name: string): AnimationAction => {
      const found = gltf.animations.find((c) => c.name === name);
      if (!found) throw new Error(`HeroView: the model has no "${name}" clip`);
      return this.mixer.clipAction(found);
    };
    this.idle = action(IDLE_CLIP);
    this.running = action(RUN_CLIP);
    this.punch = action(PUNCH_CLIP);
    this.punch.setLoop(LoopOnce, 1);
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
      if (event.action === this.punch) {
        this.punching = false;
        this.fadeTo(this.wantedBase);
      }
    });
  }

  onEvents(run: Run): void {
    if (run.result === "hero") return;
    const { events } = run;
    for (let i = 0; i < events.count; i++) {
      const kind = events.kind[i];
      if (kind === EventKind.Cast || (kind === EventKind.Hit && events.u[i] === 0)) {
        this.punching = true;
        this.fadeTo(this.punch);
      }
    }
  }

  update(run: Run, alpha: number, dt: number): void {
    const { hero } = run;
    if (!this.fitted) this.fit(hero.stats.collision);
    if (run !== this.lastRun) {
      this.lastRun = run;
      this.tint(heroTint(hero.def.id));
      this.punching = false;
      this.fadeTo(this.idle);
    }

    this.wantedBase = hero.moving ? this.running : this.idle;
    if (run.result === "hero") {
      this.punching = false;
      this.fadeTo(this.death);
    } else if (!this.punching) {
      this.fadeTo(this.wantedBase);
    }

    const x = hero.prevX + (hero.x - hero.prevX) * alpha;
    const y = hero.prevY + (hero.y - hero.prevY) * alpha;
    this.object.position.set(x * SCENE_SCALE, 0, -y * SCENE_SCALE);
    // the model faces +Z; north is -z in the scene
    this.object.rotation.y = Math.atan2(hero.facingX, -hero.facingY);
    this.mixer.update(dt);
  }

  /** Sets the emissive colour on every material of the model (the materials are this view's own copies). */
  private tint(color: number): void {
    this.model.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        (material as Material & { emissive?: Color }).emissive?.setHex(color);
      }
    });
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.object.removeFromParent();
    this.model.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
    });
  }

  /** Bounding box of the posed skinned meshes (the plain box would use the unposed geometry). */
  private measure(): Box3 {
    this.model.updateMatrixWorld(true);
    this.model.traverse((node) => (node as SkinnedMesh).skeleton?.update());
    return new Box3().setFromObject(this.model, true);
  }

  /** Scales the model to the footprint and puts its feet on the floor; needs the hero's collision radius. */
  private fit(collision: number): void {
    const diameter = 2 * collision * BODY_FACTOR * SCENE_SCALE;
    const scale = diameter / this.modelWidth;
    this.model.scale.setScalar(scale);
    this.model.position.y = -this.modelFeet * scale;
    this.fitted = true;
  }

  private fadeTo(next: AnimationAction): void {
    if (next === this.current) {
      // a repeated punch starts over
      if (next === this.punch) next.reset().play();
      return;
    }
    next.reset().fadeIn(FADE_SECONDS).play();
    this.current.fadeOut(FADE_SECONDS);
    this.current = next;
  }
}
