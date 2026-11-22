import { Color, Fog, type Scene } from "three/webgpu";
import type { GameData } from "../../data/schema";
import type { Run } from "../../sim";
import { TICKS_PER_SECOND } from "../../sim";
import type { RunView } from "../game/session";
import { lookOf, type WorldLook } from "./world-look";

/** The fog thickens into the weather's over this many steps after its start and clears over as many before its end. */
export const FADE_TICKS = 45;

export interface FogLook {
  color: number;
  near: number;
  far: number;
}

/**
 * The fog of a world at `weatherTicks` steps left of its weather (pure): the world's fog outside the weather; during
 * it a blend towards `look.weather`, full after `fadeTicks` from the start (weatherTicks = durationTicks) and back
 * over the last `fadeTicks`.
 */
export function weatherFog(look: WorldLook, weatherTicks: number, fadeTicks: number, durationTicks: number): FogLook {
  const w = look.weather;
  if (w === null || weatherTicks <= 0) return { color: look.sky, near: look.fog.near, far: look.fog.far };
  const sinceStart = durationTicks - weatherTicks;
  const k = Math.max(0, Math.min(1, sinceStart / fadeTicks, weatherTicks / fadeTicks));
  if (k === 1) return { color: w.color, near: w.fogNear, far: w.fogFar };
  const color = new Color(look.sky).lerp(new Color(w.color), k).getHex();
  return { color, near: look.fog.near + (w.fogNear - look.fog.near) * k, far: look.fog.far + (w.fogFar - look.fog.far) * k };
}

/**
 * The weather's fog on screen (spec 2026-11-21 difficulties 4.7 point 2): every frame the scene's fog and background
 * follow `weatherFog` of the run on screen, so a new run (no weather yet) shows the world's own fog at once.
 */
export class WeatherFx implements RunView {
  private readonly fog = new Fog(0x000000, 1, 2);
  private readonly background = new Color();

  constructor(private readonly data: GameData, private readonly scene: Scene) {}

  update(run: Run): void {
    const def = this.data.worlds[run.world - 1]!;
    const look = lookOf(def.id);
    const duration = def.hazard.kind === "weather" ? Math.round(def.hazard.durationSeconds * TICKS_PER_SECOND) : 1;
    const f = weatherFog(look, run.hazard.weatherTicks, FADE_TICKS, duration);
    this.fog.color.setHex(f.color);
    this.fog.near = f.near;
    this.fog.far = f.far;
    this.scene.fog = this.fog;
    this.scene.background = this.background.setHex(f.color);
  }

  dispose(): void {}
}
