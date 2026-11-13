import { type PerspectiveCamera, Vector3 } from "three/webgpu";
import { chestPrice, type Run } from "../../sim";
import { SCENE_SCALE } from "../render/coords";
import { el } from "./dom";

/** Distance of the arrow from the screen edge, in pixels (inside the castle pointer's ring). */
const EDGE_MARGIN = 76;

/** An arrow at the screen edge that points to the nearest chest while it is off screen; it lights up when the hero has the gold. */
export class ChestPointer {
  private readonly arrow: HTMLElement;
  private readonly point = new Vector3();

  constructor(parent: HTMLElement) {
    this.arrow = el("div", "chest-pointer", parent);
    this.arrow.id = "chest-pointer";
    this.arrow.hidden = true;
  }

  hide(): void {
    this.arrow.hidden = true;
  }

  update(run: Run, camera: PerspectiveCamera, width: number, height: number): void {
    const { chests, hero } = run;
    let nearest = -1;
    let nearestSq = Infinity;
    for (let i = 0; i < chests.x.length; i++) {
      const cx = chests.x[i]! - hero.x;
      const cy = chests.y[i]! - hero.y;
      const sq = cx * cx + cy * cy;
      if (sq < nearestSq) {
        nearestSq = sq;
        nearest = i;
      }
    }
    if (nearest < 0) {
      this.arrow.hidden = true;
      return;
    }
    camera.updateMatrixWorld();
    this.point.set(chests.x[nearest]! * SCENE_SCALE, 0, -chests.y[nearest]! * SCENE_SCALE).project(camera);
    const behind = this.point.z > 1;
    // behind the camera the projection is mirrored
    const nx = behind ? -this.point.x : this.point.x;
    const ny = behind ? -this.point.y : this.point.y;
    const visible = !behind && Math.abs(nx) <= 1 && Math.abs(ny) <= 1;
    this.arrow.hidden = visible;
    if (visible) return;

    this.arrow.classList.toggle("afford", run.gold >= chestPrice(run));
    const dx = nx * (width / 2);
    const dy = -ny * (height / 2);
    const limitX = width / 2 - EDGE_MARGIN;
    const limitY = height / 2 - EDGE_MARGIN;
    const scale = Math.min(limitX / Math.max(Math.abs(dx), 1e-6), limitY / Math.max(Math.abs(dy), 1e-6));
    const x = width / 2 + dx * scale;
    const y = height / 2 + dy * scale;
    const angle = Math.atan2(dy, dx);
    this.arrow.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${angle}rad)`;
  }
}
