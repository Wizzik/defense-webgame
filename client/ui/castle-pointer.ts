import { type PerspectiveCamera, Vector3 } from "three/webgpu";
import type { Run } from "../../sim";
import { SCENE_SCALE } from "../render/coords";
import { el } from "./dom";

/** Distance of the arrow from the screen edge, in pixels. */
const EDGE_MARGIN = 44;

/** An arrow at the screen edge that points to the castle while it is off screen. */
export class CastlePointer {
  private readonly arrow: HTMLElement;
  private readonly point = new Vector3();

  constructor(parent: HTMLElement) {
    this.arrow = el("div", "castle-pointer", parent);
    this.arrow.hidden = true;
  }

  hide(): void {
    this.arrow.hidden = true;
  }

  update(run: Run, camera: PerspectiveCamera, width: number, height: number): void {
    const { castle } = run;
    camera.updateMatrixWorld();
    this.point.set(castle.x * SCENE_SCALE, 0, -castle.y * SCENE_SCALE).project(camera);
    const behind = this.point.z > 1;
    // behind the camera the projection is mirrored
    const nx = behind ? -this.point.x : this.point.x;
    const ny = behind ? -this.point.y : this.point.y;
    const visible = !behind && Math.abs(nx) <= 1 && Math.abs(ny) <= 1;
    this.arrow.hidden = visible;
    if (visible) return;

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
