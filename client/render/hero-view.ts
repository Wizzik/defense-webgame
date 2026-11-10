import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { EventKind, type Run } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";
import { Figure } from "./figure";
import { heroBodyColor } from "./hero-tints";

/** The hero's footprint is 1.4 times its collision circle. */
const BODY_FACTOR = 1.4;

/** The hero: a figure that idles, runs, punches on attacks and casts, and dies. */
export class HeroView implements RunView {
  private readonly figure: Figure;
  readonly object: Figure["object"];
  private fitted = false;
  private lastRun: Run | null = null;

  constructor(gltf: GLTF) {
    this.figure = new Figure(gltf);
    this.object = this.figure.object;
  }

  onEvents(run: Run): void {
    if (run.result === "hero") return;
    const { events } = run;
    for (let i = 0; i < events.count; i++) {
      const kind = events.kind[i];
      if (kind === EventKind.Cast || (kind === EventKind.Hit && events.u[i] === 0)) this.figure.punch();
    }
  }

  update(run: Run, alpha: number, dt: number): void {
    const { hero } = run;
    if (!this.fitted) {
      this.figure.fit(2 * hero.stats.collision * BODY_FACTOR * SCENE_SCALE);
      this.fitted = true;
    }
    if (run !== this.lastRun) {
      this.lastRun = run;
      this.figure.setTint(heroBodyColor(hero.def.id));
      this.figure.reset();
    }

    if (run.result === "hero") this.figure.die();
    else this.figure.setMoving(hero.moving);

    const x = hero.prevX + (hero.x - hero.prevX) * alpha;
    const y = hero.prevY + (hero.y - hero.prevY) * alpha;
    this.figure.setPose(x * SCENE_SCALE, -y * SCENE_SCALE, hero.facingX, hero.facingY);
    this.figure.update(dt);
  }

  dispose(): void {
    this.figure.dispose();
  }
}
