import { Group, Mesh, MeshBasicNodeMaterial, RingGeometry } from "three/webgpu";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { EventKind, type Run } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";
import { Figure } from "./figure";
import { heroBodyColor } from "./hero-tints";

/** The hero's figure is sized from 1.4 times its collision diameter. */
const BODY_FACTOR = 1.4;
/** The ring under the hero spans 1.6 to 1.9 collision radii (it clears the figure's body), drawn at 70 % opacity just above the floor. */
const RING_INNER = 1.6;
const RING_OUTER = 1.9;
const RING_OPACITY = 0.7;
const RING_LIFT = 0.04;

/** The hero: a figure that idles, runs, punches on attacks and casts, and dies; a ring in the hero's colour lies under it. */
export class HeroView implements RunView {
  /** Stays in the scene for good; the figure inside it is replaced by `setModel`. */
  readonly object = new Group();
  private figure: Figure | null = null;
  private readonly ring = new Mesh(new RingGeometry(1, 1, 48), new MeshBasicNodeMaterial({ transparent: true, depthWrite: false }));
  private fitted = false;
  private lastRun: Run | null = null;

  constructor() {
    const material = this.ring.material as MeshBasicNodeMaterial;
    material.opacity = RING_OPACITY;
    material.polygonOffset = true;
    material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -2;
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = RING_LIFT;
    this.ring.renderOrder = 1;
    this.object.add(this.ring);
  }

  /** How many figures stand in the scene under `object` (always 0 before the first model, then 1). */
  get modelCount(): number {
    let count = 0;
    for (const child of this.object.children) if (child !== this.ring) count++;
    return count;
  }

  /** Replaces the figure. The old one frees its materials and mixer; its geometry belongs to the cache. */
  setModel(gltf: GLTF): void {
    this.figure?.dispose();
    this.figure = new Figure(gltf);
    this.object.add(this.figure.object);
    this.fitted = false;
    this.lastRun = null;
  }

  onEvents(run: Run): void {
    if (run.result === "hero") return;
    const { events } = run;
    for (let i = 0; i < events.count; i++) {
      const kind = events.kind[i];
      if (kind === EventKind.Cast || (kind === EventKind.Hit && events.u[i] === 0)) this.figure?.punch();
    }
  }

  update(run: Run, alpha: number, dt: number): void {
    const { hero } = run;
    const figure = this.figure;
    if (!figure) return;
    if (!this.fitted) {
      figure.fit(2 * hero.stats.collision * BODY_FACTOR * SCENE_SCALE);
      this.fitted = true;
    }
    if (run !== this.lastRun) {
      this.lastRun = run;
      const color = heroBodyColor(hero.def.id);
      figure.setTint(color);
      figure.reset();
      this.setRing(hero.stats.collision * SCENE_SCALE, color);
    }

    if (run.result === "hero") figure.die();
    else figure.setMoving(hero.moving);

    const x = (hero.prevX + (hero.x - hero.prevX) * alpha) * SCENE_SCALE;
    const z = -(hero.prevY + (hero.y - hero.prevY) * alpha) * SCENE_SCALE;
    this.object.position.set(x, 0, z);
    figure.setPose(0, 0, hero.facingX, hero.facingY);
    figure.update(dt);
  }

  dispose(): void {
    this.figure?.dispose();
    this.figure = null;
    this.object.removeFromParent();
    this.ring.geometry.dispose();
    (this.ring.material as MeshBasicNodeMaterial).dispose();
  }

  private setRing(radiusScene: number, color: number): void {
    this.ring.geometry.dispose();
    this.ring.geometry = new RingGeometry(RING_INNER * radiusScene, RING_OUTER * radiusScene, 48);
    (this.ring.material as MeshBasicNodeMaterial).color.setHex(color);
  }
}
