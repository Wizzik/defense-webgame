import { type PerspectiveCamera, Vector3 } from "three/webgpu";
import { EventKind, Role, type Run, TICKS_PER_SECOND } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "../render/coords";
import { enemyTint } from "../render/enemy-tints";
import { el } from "./dom";

export const ARROW_SECONDS = 4;
const ARROWS = 6;
/** The arrows sit on an ellipse of this share of the screen size around its centre. */
const ELLIPSE = 0.42;

const placement = { x: 0, y: 0, angle: 0 };

export type ArrowLook = "sieger" | "hunter" | "rush" | "boss";
const spec: { seconds: number; look: ArrowLook } = { seconds: 0, look: "sieger" };

/**
 * The arrow an event asks for, or null: a pack (by its role) and a boss for ARROW_SECONDS, the warning of an
 * elite rush for its warning time. `a` and `value` are the event's fields. Returns a shared object (no allocation).
 */
export function arrowFor(kind: number, a: number, value: number): { seconds: number; look: ArrowLook } | null {
  if (kind === EventKind.PackSpawn) {
    spec.seconds = ARROW_SECONDS;
    spec.look = a === Role.Hunter ? "hunter" : "sieger";
  } else if (kind === EventKind.RushWarning) {
    spec.seconds = value;
    spec.look = "rush";
  } else if (kind === EventKind.BossSpawn) {
    spec.seconds = ARROW_SECONDS;
    spec.look = "boss";
  } else {
    return null;
  }
  return spec;
}

/**
 * Screen position of an arrow for a pack at world offset (dx, dy) from the hero: on an ellipse
 * 0.42 × width by 0.42 × height around the screen centre; `angle` in radians for CSS rotate.
 * Returns a shared object (no allocation).
 */
export function arrowPlacement(dx: number, dy: number, width: number, height: number): { x: number; y: number; angle: number } {
  const d = Math.sqrt(dx * dx + dy * dy);
  placement.x = width / 2;
  placement.y = height / 2;
  placement.angle = 0;
  if (d < 1e-6) return placement;
  // world north (y up) is up on the screen (y down)
  placement.x += (dx / d) * ELLIPSE * width;
  placement.y -= (dy / d) * ELLIPSE * height;
  placement.angle = Math.atan2(-dy, dx);
  return placement;
}

/**
 * Arrows at the screen edge that point to the packs that just arrived: red for siegers, purple for
 * hunters; to the side an elite rush will come from (larger, purple, for the warning time); and to a boss that
 * just arrived (larger, in the boss's colour). An arrow hides while its point is on screen.
 * The elements are created once; a frame allocates nothing.
 */
export class PackArrows implements RunView {
  /** Arrows shown in the last frame. */
  visible = 0;
  private readonly camera: PerspectiveCamera;
  private readonly arrows: HTMLElement[] = [];
  private readonly x = new Float64Array(ARROWS);
  private readonly y = new Float64Array(ARROWS);
  private readonly until = new Int32Array(ARROWS).fill(-1);
  private readonly look: (ArrowLook | "")[] = new Array<ArrowLook | "">(ARROWS).fill("");
  private readonly point = new Vector3();
  private next = 0;
  private lastRun: Run | null = null;

  constructor(parent: HTMLElement, camera: PerspectiveCamera) {
    this.camera = camera;
    for (let i = 0; i < ARROWS; i++) {
      const arrow = el("div", "pack-arrow", parent);
      arrow.setAttribute("aria-hidden", "true");
      arrow.hidden = true;
      this.arrows.push(arrow);
    }
  }

  onEvents(run: Run): void {
    this.sync(run);
    const { events } = run;
    for (let i = 0; i < events.count; i++) {
      const wanted = arrowFor(events.kind[i]!, events.a[i]!, events.value[i]!);
      if (!wanted) continue;
      const k = this.next;
      this.next = (k + 1) % ARROWS;
      this.x[k] = events.x[i]!;
      this.y[k] = events.y[i]!;
      this.until[k] = run.tick + Math.round(wanted.seconds * TICKS_PER_SECOND);
      const arrow = this.arrows[k]!;
      if (this.look[k] !== wanted.look) {
        this.look[k] = wanted.look;
        arrow.className = `pack-arrow ${wanted.look}`;
      }
      // a boss arrow takes the colour of its type; the others take theirs from the stylesheet
      arrow.style.borderLeftColor = wanted.look === "boss" ? cssColor(enemyTint(run.data.enemies[events.value[i]!]!.id)) : "";
    }
  }

  update(run: Run, alpha: number, _dt: number): void {
    this.sync(run);
    const { hero } = run;
    const playing = run.state === "playing" || run.state === "levelUp";
    const heroX = hero.prevX + (hero.x - hero.prevX) * alpha;
    const heroY = hero.prevY + (hero.y - hero.prevY) * alpha;
    let visible = 0;
    for (let k = 0; k < ARROWS; k++) {
      const arrow = this.arrows[k]!;
      if (!playing || run.tick >= this.until[k]! || this.onScreen(this.x[k]!, this.y[k]!)) {
        if (!arrow.hidden) arrow.hidden = true;
        continue;
      }
      const p = arrowPlacement(this.x[k]! - heroX, this.y[k]! - heroY, innerWidth, innerHeight);
      arrow.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) rotate(${p.angle}rad)`;
      if (arrow.hidden) arrow.hidden = false;
      visible++;
    }
    this.visible = visible;
  }

  dispose(): void {
    for (const arrow of this.arrows) arrow.remove();
  }

  private onScreen(x: number, y: number): boolean {
    this.point.set(x * SCENE_SCALE, 0, -y * SCENE_SCALE).project(this.camera);
    return this.point.z <= 1 && Math.abs(this.point.x) <= 1 && Math.abs(this.point.y) <= 1;
  }

  /** A new run starts with no arrows. */
  private sync(run: Run): void {
    if (run === this.lastRun) return;
    this.lastRun = run;
    this.until.fill(-1);
    this.next = 0;
  }
}

function cssColor(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}
