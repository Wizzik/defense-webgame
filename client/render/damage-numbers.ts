import { type PerspectiveCamera, Vector3 } from "three/webgpu";
import { EventKind, type Run, TICKS_PER_SECOND } from "../../sim";
import type { RunView } from "../game/session";
import { el } from "../ui/dom";
import { SCENE_SCALE } from "./coords";
import { DamageNumberPool, NUMBER_LIFE } from "./damage-number-pool";

const POOL = 64;
/** How far a number rises over its life, in pixels. */
const RISE_PX = 40;
/** Height above the floor where a number starts, in scene units. */
const START_HEIGHT = 1.4;

/**
 * Floating damage numbers: a pool of DOM elements over the canvas. Each Hit takes the oldest
 * free element. Per frame only `transform` and `opacity` change (text and colour are set once, on Hit).
 */
export class DamageNumbers implements RunView {
  private readonly pool = new DamageNumberPool(POOL);
  private readonly nodes: HTMLElement[] = [];
  private readonly camera: PerspectiveCamera;
  private readonly worldX = new Float32Array(POOL);
  private readonly worldZ = new Float32Array(POOL);
  private readonly shown = new Uint8Array(POOL);
  private readonly point = new Vector3();
  private lastTick = 0;

  constructor(parent: HTMLElement, camera: PerspectiveCamera) {
    this.camera = camera;
    for (let i = 0; i < POOL; i++) this.nodes.push(el("div", "damage-number", parent));
  }

  onEvents(run: Run): void {
    const { events } = run;
    const now = run.tick / TICKS_PER_SECOND;
    if (run.tick < this.lastTick) this.reset();
    this.lastTick = run.tick;
    for (let i = 0; i < events.count; i++) {
      if (events.kind[i] !== EventKind.Hit) continue;
      const slot = this.pool.add(now);
      const node = this.nodes[slot];
      node.textContent = String(Math.max(1, Math.round(events.value[i])));
      node.className = events.u[i] === 1 ? "damage-number spell" : "damage-number";
      this.worldX[slot] = events.x[i] * SCENE_SCALE;
      this.worldZ[slot] = -events.y[i] * SCENE_SCALE;
      this.shown[slot] = 1;
    }
  }

  update(run: Run, alpha: number, _dt: number): void {
    const now = (run.tick + alpha) / TICKS_PER_SECOND;
    const width = innerWidth;
    const height = innerHeight;
    this.camera.updateMatrixWorld();
    for (let slot = 0; slot < POOL; slot++) {
      const node = this.nodes[slot];
      if (!this.pool.active(slot, now)) {
        if (this.shown[slot] === 1) {
          this.shown[slot] = 0;
          node.style.opacity = "0";
        }
        continue;
      }
      const t = this.pool.age(slot, now) / NUMBER_LIFE;
      this.point.set(this.worldX[slot], START_HEIGHT, this.worldZ[slot]).project(this.camera);
      if (this.point.z > 1) {
        node.style.opacity = "0";
        continue;
      }
      const px = (this.point.x * 0.5 + 0.5) * width;
      const py = (-this.point.y * 0.5 + 0.5) * height - RISE_PX * t;
      node.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -50%)`;
      node.style.opacity = Math.min(1, (1 - t) * 2.5).toFixed(2);
    }
  }

  dispose(): void {
    for (const node of this.nodes) node.remove();
  }

  private reset(): void {
    this.pool.clear();
    this.shown.fill(0);
    for (const node of this.nodes) node.style.opacity = "0";
  }
}
