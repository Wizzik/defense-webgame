import type { Weather } from "../data/schema";
import { TICKS_PER_SECOND } from "./constants";
import { EventKind } from "./events";
import { isChoosing } from "./player";
import type { Run } from "./run";
import { WeatherPhase } from "./weather";

/** The chill of the world's weather (spec 2026-11-21 difficulties 4.7 point 4), or null. */
export function chillOf(run: Run): NonNullable<Weather["chill"]> | null {
  const h = run.data.worlds[run.world - 1]!.hazard;
  return h.kind === "weather" && h.chill !== undefined ? h.chill : null;
}

/**
 * Once per step for `run.current`, after his move: walking (or a dash) thaws him and restarts the count; standing
 * counts on, and a hero freezes after chill.stillSeconds while the weather runs. A fallen, choosing or rooted hero
 * cannot walk, so his count starts over (he is not chilled the moment he can walk again). He stays chilled, even
 * after the weather, until he walks.
 */
export function updateChill(run: Run, moved: boolean): void {
  const p = run.players[run.current]!;
  if (moved) {
    p.stillTicks = 0;
    p.chilled = false;
    return;
  }
  if (run.hero.hp <= 0 || isChoosing(run) || run.hero.rootTicks > 0) {
    p.stillTicks = 0;
    return;
  }
  p.stillTicks++;
  if (p.chilled || run.hazard.weatherTicks === 0) return;
  const chill = chillOf(run);
  if (chill === null || p.stillTicks < Math.round(chill.stillSeconds * TICKS_PER_SECOND)) return;
  p.chilled = true;
  run.events.push(EventKind.HazardWave, 0, 0, run.hero.x, run.hero.y, WeatherPhase.Chill, 0);
}

/** Multiplier on the current hero's base attack interval: 1 / (1 - attackSlow) while he is chilled, else 1. */
export function chillAttackScale(run: Run): number {
  if (!run.players[run.current]!.chilled) return 1;
  const chill = chillOf(run);
  return chill === null ? 1 : 1 / (1 - chill.attackSlow);
}
