import type { Weather } from "../data/schema";
import { TICKS_PER_SECOND } from "./constants";
import { EventKind } from "./events";
import type { Run } from "./run";

/** `u` of a weather's HazardWave event (the summer storm sends u = 0); the value is seconds (0 for Chill: a hero froze). */
export const WeatherPhase = { Warn: 1, Start: 2, End: 3, Chill: 4 } as const;

/** The world's timed weather (spec 2026-11-21 difficulties 4.7 point 2), or null. */
function weatherOf(run: Run): Weather | null {
  const h = run.data.worlds[run.world - 1]!.hazard;
  return h.kind === "weather" ? h : null;
}

/**
 * Once per step (from updateHazard): plans the next weather from the start of fromPhase + a gap from hazardRng,
 * announces it warnSeconds ahead, runs it durationSeconds, then plans the next one a gap after its end.
 * nextWaveTick is the tick the weather starts.
 */
export function updateWeather(run: Run): void {
  const w = weatherOf(run);
  if (w === null) return;
  const h = run.hazard;
  const { hero } = run;
  if (h.weatherTicks > 0) {
    h.weatherTicks--;
    if (h.weatherTicks === 0) {
      run.events.push(EventKind.HazardWave, 0, 0, hero.x, hero.y, WeatherPhase.End, 0);
      h.nextWaveTick = run.tick + gapTicks(run, w);
    }
    return;
  }
  if (h.nextWaveTick < 0) {
    const from = Math.round((w.fromPhase - 1) * run.data.rules.run.phaseSeconds * TICKS_PER_SECOND);
    h.nextWaveTick = Math.max(from, run.tick) + gapTicks(run, w);
  }
  if (h.warnTicks > 0) {
    h.warnTicks--;
    if (h.warnTicks === 0) start(run, w);
    return;
  }
  const warn = Math.round(w.warnSeconds * TICKS_PER_SECOND);
  if (run.tick >= h.nextWaveTick - warn) {
    h.warnTicks = warn;
    run.events.push(EventKind.HazardWave, 0, w.warnSeconds, hero.x, hero.y, WeatherPhase.Warn, 0);
  }
}

/** Debug (`__game.debug.hazard()`): the weather at once, without the warning. */
export function debugWeather(run: Run): void {
  const w = weatherOf(run);
  if (w === null) return;
  run.hazard.warnTicks = 0;
  start(run, w);
}

/** 1 - moveSlow while the weather runs, else 1 (walking only, not the dash). */
export function weatherSpeedScale(run: Run): number {
  if (run.hazard.weatherTicks === 0) return 1;
  const w = weatherOf(run);
  return w === null ? 1 : 1 - w.moveSlow;
}

function start(run: Run, w: Weather): void {
  const h = run.hazard;
  h.weatherTicks = Math.round(w.durationSeconds * TICKS_PER_SECOND);
  h.waves++;
  run.events.push(EventKind.HazardWave, 0, w.durationSeconds, run.hero.x, run.hero.y, WeatherPhase.Start, 0);
}

/** Steps from the end of a weather to the warning of the next is everySeconds - warnSeconds. */
function gapTicks(run: Run, w: Weather): number {
  const { everySeconds } = w;
  const seconds = everySeconds.min + run.hazardRng.next() * (everySeconds.max - everySeconds.min);
  return Math.round(seconds * TICKS_PER_SECOND);
}
