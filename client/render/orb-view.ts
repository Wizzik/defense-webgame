import {
  AdditiveBlending,
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  RingGeometry,
  SphereGeometry,
} from "three/webgpu";
import { EventKind, type Run, TICKS_PER_SECOND } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";

/**
 * About 2.8 x the crystal (0.18): 1.5 x (spec 4.6) was a dot of a few pixels from the game camera at 1280 x 720
 * (the review of the `orbs` screenshot), and an orb must read as worth the walk.
 */
const RADIUS = 0.5;
const HOVER = 0.8;
const BOB_HEIGHT = 0.1;
const BOB_SPEED = 2.2;
/** The glyph floats this far over the sphere's centre, at GLYPH_SCALE x its built size. */
const GLYPH_HEIGHT = 0.95;
const GLYPH_SCALE = 2.4;
/** The glyph leans back towards the steep game camera, so its shape reads from above. */
const GLYPH_TILT = -1.1;
/** A faint ring on the floor in the orb's colour. */
const RING_INNER = 0.7;
const RING_OUTER = 0.9;
const RING_OPACITY = 0.45;
/** The flash of a pickup: it grows to FLASH_SCALE x the orb and fades in FLASH_SECONDS. */
const FLASH_SECONDS = 0.4;
const FLASH_SCALE = 4;
/** Blue boots, crimson berserk, green renewal: nothing orange. */
const COLORS = [0x4fa8ff, 0xe0444e, 0x4fd18b] as const;

/** A boot: a shaft and a foot. */
function bootGlyph(geometries: BufferGeometry[], material: MeshStandardNodeMaterial): Group {
  const shaft = new BoxGeometry(0.08, 0.2, 0.08);
  const foot = new BoxGeometry(0.16, 0.07, 0.08);
  geometries.push(shaft, foot);
  const group = new Group();
  const a = new Mesh(shaft, material);
  a.position.set(-0.03, 0.05, 0);
  const b = new Mesh(foot, material);
  b.position.set(0.02, -0.07, 0);
  group.add(a, b);
  return group;
}

/** An axe: a handle and a blade. */
function axeGlyph(geometries: BufferGeometry[], material: MeshStandardNodeMaterial): Group {
  const handle = new CylinderGeometry(0.018, 0.018, 0.3, 6);
  const blade = new BoxGeometry(0.12, 0.12, 0.03);
  geometries.push(handle, blade);
  const group = new Group();
  const a = new Mesh(handle, material);
  const b = new Mesh(blade, material);
  b.position.set(0.06, 0.08, 0);
  b.rotation.z = Math.PI / 4;
  group.add(a, b);
  group.rotation.z = -0.35;
  return group;
}

/** A cross. */
function crossGlyph(geometries: BufferGeometry[], material: MeshStandardNodeMaterial): Group {
  const bar = new BoxGeometry(0.22, 0.07, 0.06);
  geometries.push(bar);
  const group = new Group();
  const a = new Mesh(bar, material);
  const b = new Mesh(bar, material);
  b.rotation.z = Math.PI / 2;
  group.add(a, b);
  return group;
}

interface OrbNode {
  group: Group;
  sphere: Mesh;
  ring: Mesh;
  glyphs: Group[];
  flash: Mesh;
  flashMaterial: MeshBasicNodeMaterial;
  /** Run time of the last pickup at this place, -1 for none. */
  flashAt: number;
  flashX: number;
  flashZ: number;
  kind: number;
}

/**
 * The orbs on the map: per place a glowing sphere in the colour of its kind with a glyph over it (a boot, an axe, a
 * cross) and a faint ring on the floor, floating gently; a pickup flashes. `update` does not allocate.
 */
export class OrbView implements RunView {
  readonly object = new Group();
  private readonly nodes: OrbNode[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly sphereGeometry = new SphereGeometry(RADIUS, 20, 14);
  private readonly flashGeometry = new SphereGeometry(RADIUS, 16, 10);
  private readonly sphereMaterials = COLORS.map((color) =>
    new MeshStandardNodeMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: 0.25 }));
  private readonly glyphMaterial = new MeshStandardNodeMaterial({ color: 0xe8ecf2, emissive: 0xe8ecf2, emissiveIntensity: 0.5 });
  private readonly ringGeometry = new RingGeometry(RING_INNER, RING_OUTER, 40);
  private readonly ringMaterials = COLORS.map((color) => {
    const material = new MeshBasicNodeMaterial({ color });
    material.transparent = true;
    material.opacity = RING_OPACITY;
    material.depthWrite = false;
    material.blending = AdditiveBlending;
    return material;
  });
  private lastTick = -1;

  private ensure(count: number): void {
    while (this.nodes.length < count) {
      const group = new Group();
      const sphere = new Mesh(this.sphereGeometry, this.sphereMaterials[0]);
      sphere.castShadow = true;
      const glyphs = [
        bootGlyph(this.geometries, this.glyphMaterial),
        axeGlyph(this.geometries, this.glyphMaterial),
        crossGlyph(this.geometries, this.glyphMaterial),
      ];
      for (const glyph of glyphs) {
        glyph.position.y = GLYPH_HEIGHT;
        glyph.scale.setScalar(GLYPH_SCALE);
        glyph.rotation.x = GLYPH_TILT;
      }
      const ring = new Mesh(this.ringGeometry, this.ringMaterials[0]);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      group.add(sphere, ring, ...glyphs);
      const flashMaterial = new MeshBasicNodeMaterial({ color: 0xffffff });
      flashMaterial.transparent = true;
      flashMaterial.depthWrite = false;
      flashMaterial.blending = AdditiveBlending;
      const flash = new Mesh(this.flashGeometry, flashMaterial);
      flash.visible = false;
      this.object.add(group, flash);
      this.nodes.push({ group, sphere, ring, glyphs, flash, flashMaterial, flashAt: -1, flashX: 0, flashZ: 0, kind: -1 });
    }
  }

  onEvents(run: Run): void {
    const { events } = run;
    if (run.tick < this.lastTick) for (const node of this.nodes) node.flashAt = -1;
    this.lastTick = run.tick;
    this.ensure(run.orbs.alive.length);
    for (let i = 0; i < events.count; i++) {
      if (events.kind[i] !== EventKind.OrbPickup) continue;
      const node = this.nodes[events.a[i]!];
      if (!node) continue;
      node.flashAt = run.tick / TICKS_PER_SECOND;
      node.flashX = events.x[i]! * SCENE_SCALE;
      node.flashZ = -events.y[i]! * SCENE_SCALE;
      node.flashMaterial.color.setHex(COLORS[events.value[i]!] ?? 0xffffff);
    }
  }

  update(run: Run, alpha: number, _dt: number): void {
    const { orbs } = run;
    this.ensure(orbs.alive.length);
    const seconds = (run.tick + alpha) / TICKS_PER_SECOND;
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i]!;
      const alive = i < orbs.alive.length && orbs.alive[i] === 1;
      node.group.visible = alive;
      if (alive) {
        const kind = orbs.kind[i]!;
        if (kind !== node.kind) {
          node.kind = kind;
          node.sphere.material = this.sphereMaterials[kind] ?? this.sphereMaterials[0]!;
          node.ring.material = this.ringMaterials[kind] ?? this.ringMaterials[0]!;
          for (let g = 0; g < node.glyphs.length; g++) node.glyphs[g]!.visible = g === kind;
        }
        node.group.position.set(orbs.x[i]! * SCENE_SCALE, 0, -orbs.y[i]! * SCENE_SCALE);
        node.sphere.position.y = HOVER + Math.sin(seconds * BOB_SPEED + i) * BOB_HEIGHT;
        const glyph = node.glyphs[kind];
        if (glyph) glyph.position.y = node.sphere.position.y + GLYPH_HEIGHT;
      }
      const age = node.flashAt < 0 ? -1 : seconds - node.flashAt;
      if (age < 0 || age > FLASH_SECONDS) {
        node.flash.visible = false;
        continue;
      }
      const t = age / FLASH_SECONDS;
      node.flash.visible = true;
      node.flash.position.set(node.flashX, HOVER, node.flashZ);
      node.flash.scale.setScalar(1 + (FLASH_SCALE - 1) * t);
      node.flashMaterial.opacity = 1 - t;
    }
  }

  dispose(): void {
    this.sphereGeometry.dispose();
    this.flashGeometry.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.sphereMaterials) material.dispose();
    this.ringGeometry.dispose();
    for (const material of this.ringMaterials) material.dispose();
    this.glyphMaterial.dispose();
    for (const node of this.nodes) node.flashMaterial.dispose();
  }
}
