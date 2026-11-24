import { AdditiveBlending, InstancedMesh, Matrix4, MeshBasicMaterial, NormalBlending, OctahedronGeometry } from "three/webgpu";
import type { GameData } from "../../data/schema";
import type { Run } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";
import { lookOf } from "./world-look";

/** Points in the box around the hero (scene units: 60 wide and deep, 20 high). */
const CAPACITY = 600;
const FIREFLIES = 200;
const HALF_X = 30;
const HALF_Z = 30;
const HEIGHT = 20;
/** Dust: the wind blows east this fast (scene units a second), with a little sway. */
const WIND = 14;
const FIREFLY_COLOR = 0xbfe8a8;
/** Snow: light always, thick during the blizzard, falling this fast; the blizzard's wind blows east. */
const SNOW_LIGHT = 150;
const SNOW_COLOR = 0xe8f0ff;
const SNOW_FALL = 2.5;
const BLIZZARD_WIND = 10;
/** Green embers of world 5 rise this fast and fade above EMBER_TOP. */
const EMBERS = 200;
const EMBER_COLOR = 0x9cff6a;
const EMBER_RISE = 1;
const EMBER_TOP = 6;

/**
 * Weather particles (client only; `Math.random` is fine here): blown dust while a sandstorm runs, slow wandering
 * fireflies always in a world whose look has them, snow (light always, thick and blown in a blizzard), rising green
 * embers. One `InstancedMesh` of tiny octahedrons (WebGPU draws points
 * only 1 pixel wide) of fixed size around the hero; positions wrap.
 */
export class Particles implements RunView {
  readonly object: InstancedMesh;
  private readonly positions = new Float32Array(CAPACITY * 3);
  private readonly drift = new Float32Array(CAPACITY * 3);
  private readonly geometry = new OctahedronGeometry(1, 0);
  private readonly material = new MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false, fog: false });
  private readonly matrix = new Matrix4();
  private size = 0.1;
  /** Points drawn now, for `__game.render.particles`. */
  visible = 0;
  private mode: "none" | "dust" | "fireflies" | "snow" | "embers" = "none";

  constructor(private readonly data: GameData) {
    for (let i = 0; i < CAPACITY; i++) {
      this.positions[i * 3] = (Math.random() * 2 - 1) * HALF_X;
      this.positions[i * 3 + 1] = Math.random() * HEIGHT;
      this.positions[i * 3 + 2] = (Math.random() * 2 - 1) * HALF_Z;
      this.drift[i * 3] = Math.random() * 2 - 1;
      this.drift[i * 3 + 1] = Math.random() * 2 - 1;
      this.drift[i * 3 + 2] = Math.random() * 2 - 1;
    }
    this.object = new InstancedMesh(this.geometry, this.material, CAPACITY);
    this.object.count = 0;
    this.object.frustumCulled = false;
    this.object.visible = false;
  }

  update(run: Run, _alpha: number, dt: number): void {
    const look = lookOf(this.data.worlds[run.world - 1]!.id);
    const weather = run.hazard.weatherTicks > 0;
    const mode = look.particles === "dust" ? (weather ? "dust" : "none") : look.particles;
    if (mode !== this.mode) {
      this.mode = mode;
      if (mode === "dust") {
        this.material.color.setHex(look.weather?.color ?? 0x888888);
        this.size = 0.07;
        this.material.blending = NormalBlending;
        this.material.opacity = 0.7;
      } else if (mode === "fireflies") {
        this.material.color.setHex(FIREFLY_COLOR);
        this.size = 0.09;
        this.material.blending = AdditiveBlending;
        this.material.opacity = 0.9;
      } else if (mode === "snow") {
        this.material.color.setHex(SNOW_COLOR);
        this.size = 0.06;
        this.material.blending = NormalBlending;
        this.material.opacity = 0.85;
      } else if (mode === "embers") {
        this.material.color.setHex(EMBER_COLOR);
        this.size = 0.06;
        this.material.blending = AdditiveBlending;
        this.material.opacity = 0.9;
      }
      this.material.needsUpdate = true;
    }
    this.visible = mode === "dust" ? CAPACITY : mode === "fireflies" ? FIREFLIES : mode === "embers" ? EMBERS
      : mode === "snow" ? (weather ? CAPACITY : SNOW_LIGHT) : 0;
    this.object.visible = this.visible > 0;
    this.object.count = this.visible;
    if (this.visible === 0) return;
    const step = Math.min(dt, 0.1);
    const p = this.positions;
    const d = this.drift;
    for (let i = 0; i < this.visible; i++) {
      const k = i * 3;
      if (mode === "dust") {
        p[k] += (WIND + d[k]! * 4) * step;
        p[k + 1] += d[k + 1]! * 0.8 * step;
        p[k + 2] += d[k + 2]! * 2 * step;
      } else if (mode === "snow") {
        p[k] += ((weather ? BLIZZARD_WIND : 0) + d[k]! * 0.6) * step;
        p[k + 1] -= (SNOW_FALL + d[k + 1]! * 0.8) * step;
        p[k + 2] += d[k + 2]! * 0.6 * step;
        if (p[k + 1]! < 0) p[k + 1] += HEIGHT;
      } else if (mode === "embers") {
        p[k] += d[k]! * 0.4 * step;
        p[k + 1] += (EMBER_RISE + d[k + 1]! * 0.4) * step;
        p[k + 2] += d[k + 2]! * 0.4 * step;
        if (p[k + 1]! > EMBER_TOP) p[k + 1] = 0;
      } else {
        d[k] += (Math.random() * 2 - 1) * step;
        d[k + 2] += (Math.random() * 2 - 1) * step;
        d[k] = Math.max(-1, Math.min(1, d[k]!));
        d[k + 2] = Math.max(-1, Math.min(1, d[k + 2]!));
        p[k] += d[k]! * 0.8 * step;
        p[k + 1] = 0.4 + (((p[k + 1]! - 0.4 + d[k + 1]! * 0.3 * step) % 3) + 3) % 3;
        p[k + 2] += d[k + 2]! * 0.8 * step;
      }
      if (p[k]! > HALF_X) p[k] -= 2 * HALF_X;
      if (p[k]! < -HALF_X) p[k] += 2 * HALF_X;
      if (p[k + 2]! > HALF_Z) p[k + 2] -= 2 * HALF_Z;
      if (p[k + 2]! < -HALF_Z) p[k + 2] += 2 * HALF_Z;
      if (mode === "dust" && (p[k + 1]! < 0 || p[k + 1]! > HEIGHT)) p[k + 1] = Math.random() * HEIGHT;
      this.matrix.makeScale(this.size, this.size, this.size).setPosition(p[k]!, p[k + 1]!, p[k + 2]!);
      this.object.setMatrixAt(i, this.matrix);
    }
    this.object.instanceMatrix.needsUpdate = true;
    this.object.position.set(run.hero.x * SCENE_SCALE, 0, -run.hero.y * SCENE_SCALE);
  }

  dispose(): void {
    this.object.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
