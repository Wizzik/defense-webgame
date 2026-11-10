import {
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  RingGeometry,
  SphereGeometry,
} from "three/webgpu";
import type { Run } from "../../../sim";
import { SCENE_SCALE } from "../coords";
import { heroAccent } from "../hero-tints";

const SHIELD_COLOR = 0x7fc8ff;
const SHIELD_OPACITY = 0.25;
/** The hero's bubble is this much wider than the hero's footprint (1.4 times its collision circle). */
const HERO_BUBBLE = 1.6;
const BODY_FACTOR = 1.4;
const CASTLE_BUBBLE = 1.3;
const PULSE_SPEED = 6;
const PULSE_SIZE = 0.03;
const PULSE_OPACITY = 0.06;
const ON_HIT_COLOR = 0xff7a3d;
const AURA_OPACITY = 0.35;
/** Radius of the ring under the hero, relative to the hero's collision radius. */
const AURA_RING = 2;
const ON_HIT_RING = 2.5;
const RING_WIDTH = 0.12;

function glass(color: number, opacity: number): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ color });
  material.transparent = true;
  material.opacity = opacity;
  material.depthWrite = false;
  return material;
}

/** Spirit shield bubbles (hero and castle) and the rings under the hero for a learned aura and a charged on_hit. */
export class Bubbles {
  readonly object = new Group();
  private readonly heroBubble: Mesh;
  private readonly dome: Mesh;
  private readonly auraRing: Mesh;
  private readonly onHitRing: Mesh;
  private lastRun: Run | null = null;

  constructor() {
    this.heroBubble = new Mesh(new SphereGeometry(0.5, 24, 16), glass(SHIELD_COLOR, SHIELD_OPACITY));
    this.dome = new Mesh(
      new SphereGeometry(0.5, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      glass(SHIELD_COLOR, SHIELD_OPACITY),
    );
    const ring = (): RingGeometry => new RingGeometry(1 - RING_WIDTH, 1, 40).rotateX(-Math.PI / 2);
    this.auraRing = new Mesh(ring(), glass(0xffffff, AURA_OPACITY));
    this.onHitRing = new Mesh(ring(), glass(ON_HIT_COLOR, AURA_OPACITY));
    for (const mesh of [this.heroBubble, this.dome, this.auraRing, this.onHitRing]) {
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.object.add(mesh);
    }
    this.auraRing.position.y = this.onHitRing.position.y = 0.05;
  }

  /** `seconds` is the interpolated simulation time. */
  update(run: Run, alpha: number, seconds: number): void {
    const { hero, castle } = run;
    if (run !== this.lastRun) {
      this.lastRun = run;
      (this.auraRing.material as MeshBasicNodeMaterial).color.setHex(heroAccent(hero.def.id));
    }
    const x = (hero.prevX + (hero.x - hero.prevX) * alpha) * SCENE_SCALE;
    const z = -(hero.prevY + (hero.y - hero.prevY) * alpha) * SCENE_SCALE;
    const pulse = Math.sin(seconds * PULSE_SPEED);

    const shielded = run.shieldTicks > 0;
    this.heroBubble.visible = this.dome.visible = shielded;
    if (shielded) {
      const footprint = 2 * hero.stats.collision * BODY_FACTOR * SCENE_SCALE;
      const d = footprint * HERO_BUBBLE * (1 + PULSE_SIZE * pulse);
      this.heroBubble.scale.setScalar(d);
      this.heroBubble.position.set(x, footprint * 0.5, z);
      const dd = 2 * castle.radius * CASTLE_BUBBLE * SCENE_SCALE * (1 + PULSE_SIZE * pulse);
      this.dome.scale.setScalar(dd);
      this.dome.position.set(castle.x * SCENE_SCALE, 0, -castle.y * SCENE_SCALE);
      const opacity = SHIELD_OPACITY + PULSE_OPACITY * pulse;
      (this.heroBubble.material as MeshBasicNodeMaterial).opacity = opacity;
      (this.dome.material as MeshBasicNodeMaterial).opacity = opacity;
    }

    let aura = false;
    let charged = false;
    for (const slot of run.abilities) {
      if (slot.level < 1) continue;
      if (slot.def.kind === "aura") aura = true;
      else if (slot.def.kind === "on_hit" && slot.active) charged = true;
    }
    const radius = hero.stats.collision * SCENE_SCALE;
    this.auraRing.visible = aura;
    if (aura) {
      this.auraRing.scale.setScalar(radius * AURA_RING);
      this.auraRing.position.x = x;
      this.auraRing.position.z = z;
    }
    this.onHitRing.visible = charged;
    if (charged) {
      this.onHitRing.scale.setScalar(radius * ON_HIT_RING * (1 + PULSE_SIZE * pulse));
      this.onHitRing.position.x = x;
      this.onHitRing.position.z = z;
    }
  }

  dispose(): void {
    this.object.removeFromParent();
    for (const mesh of [this.heroBubble, this.dome, this.auraRing, this.onHitRing]) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicNodeMaterial).dispose();
    }
  }
}
