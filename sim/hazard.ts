import { stormOf, type Storm } from "../data/schema";
import { berserkScale } from "./buffs";
import { damageEnemy, damageHero, heroDamageScale, HeroHitSource } from "./combat";
import { TICKS_PER_SECOND } from "./constants";
import { EventKind } from "./events";
import type { Run } from "./run";

/** Bolts that can wait at once (a wave has at most `bolts.max`, and waves are 35 s and more apart). */
export const HAZARD_CAPACITY = 8;
/** Tries for a bolt's point inside the spread circle before it falls on the hero. */
const SPREAD_TRIES = 8;

/** The world's natural event (spec 2026-11-21 difficulties 4.7); plan 2 has only the summer storm. Fixed arrays. */
export class HazardState {
  readonly x = new Float64Array(HAZARD_CAPACITY);
  readonly y = new Float64Array(HAZARD_CAPACITY);
  /** Steps until the bolt strikes; 0 = a free place. */
  readonly ticks = new Int32Array(HAZARD_CAPACITY);
  /** Tick of the next wave; -1 until the first update plans it (from the start of fromPhase or the run's start). */
  nextWaveTick = -1;
  waves = 0;
  bolts = 0;
}

/**
 * Once per step, right after updateBuffs: strikes the bolts whose warning ran out, then starts a wave when it is due.
 * Draws only from run.hazardRng.
 */
export function updateHazard(run: Run): void {
  const storm = stormOf(run.data.worlds[run.world - 1]!);
  if (storm !== null) updateStorm(run, storm);
}

function updateStorm(run: Run, storm: Storm): void {
  const h = run.hazard;
  for (let i = 0; i < HAZARD_CAPACITY; i++) {
    if (h.ticks[i] === 0) continue;
    h.ticks[i]--;
    if (h.ticks[i] === 0) strike(run, storm, i);
  }
  if (h.nextWaveTick < 0) {
    const from = Math.round((storm.fromPhase - 1) * run.data.rules.run.phaseSeconds * TICKS_PER_SECOND);
    h.nextWaveTick = Math.max(from, run.tick) + gapTicks(run, storm);
  }
  if (run.tick >= h.nextWaveTick) startWave(run, storm);
}

/** Debug (`__game.debug.hazard()`): a wave at once; the next one follows its usual gap later. */
export function debugHazard(run: Run): void {
  const storm = stormOf(run.data.worlds[run.world - 1]!);
  if (storm !== null) startWave(run, storm);
}

/** Steps until the nearest waiting bolt strikes; 0 when none waits. */
export function hazardPending(run: Run): number {
  let best = 0;
  for (let i = 0; i < HAZARD_CAPACITY; i++) {
    const t = run.hazard.ticks[i]!;
    if (t > 0 && (best === 0 || t < best)) best = t;
  }
  return best;
}

function gapTicks(run: Run, storm: Storm): number {
  const { everySeconds } = storm;
  const seconds = everySeconds.min + run.hazardRng.next() * (everySeconds.max - everySeconds.min);
  return Math.round(seconds * TICKS_PER_SECOND);
}

function startWave(run: Run, storm: Storm): void {
  const h = run.hazard;
  const rng = run.hazardRng;
  const { hero } = run;
  if (h.waves === 0) run.events.push(EventKind.HazardWave, 0, 0, hero.x, hero.y, 0, 0);
  const n = storm.bolts.min + Math.floor(rng.next() * (storm.bolts.max - storm.bolts.min + 1));
  const warn = Math.max(1, Math.round(storm.warnSeconds * TICKS_PER_SECOND));
  for (let b = 0; b < n; b++) {
    let px = 0;
    let py = 0;
    for (let t = 0; t < SPREAD_TRIES; t++) {
      const ux = rng.next() * 2 - 1;
      const uy = rng.next() * 2 - 1;
      if (ux * ux + uy * uy > 1) continue;
      px = ux * storm.spread;
      py = uy * storm.spread;
      break;
    }
    const slot = h.ticks.indexOf(0);
    if (slot < 0) break;
    h.x[slot] = hero.x + px;
    h.y[slot] = hero.y + py;
    h.ticks[slot] = warn;
    h.bolts++;
    run.events.push(EventKind.Hazard, slot, 0, h.x[slot]!, h.y[slot]!, storm.radius, warn);
  }
  h.waves++;
  h.nextWaveTick = run.tick + gapTicks(run, storm);
}

/**
 * A bolt strikes: heroShare of the hero's max hp (no armor; the hero's damage-taken scale is undone, so the share is
 * exact; the spirit shield stops it), enemyShare (bossShare for a boss) of each enemy's max hp in the circle (not
 * scaled by the berserk orb: the storm is not the hero's blow). The castle is spared.
 */
function strike(run: Run, storm: Storm, i: number): void {
  const h = run.hazard;
  const cx = h.x[i]!;
  const cy = h.y[i]!;
  const r2 = storm.radius * storm.radius;
  run.events.push(EventKind.Hazard, i, 1, cx, cy, storm.radius, 0);
  const { hero } = run;
  const hx = hero.x - cx;
  const hy = hero.y - cy;
  if (hero.hp > 0 && hx * hx + hy * hy <= r2) {
    damageHero(run, (storm.heroShare * hero.stats.maxHp) / heroDamageScale(run), -1, HeroHitSource.Storm);
  }
  const e = run.enemies;
  const scale = 1 / berserkScale(run);
  for (let s = 0; s < e.capacity; s++) {
    if (e.alive[s] === 0) continue;
    const ex = e.x[s] - cx;
    const ey = e.y[s] - cy;
    if (ex * ex + ey * ey > r2) continue;
    const share = run.isBoss[e.type[s]] === 1 ? storm.bossShare : storm.enemyShare;
    damageEnemy(run, s, e.maxHp[s] * share * scale, 2);
  }
}
