import { stormOf, type Storm } from "../data/schema";
import { berserkScale } from "./buffs";
import { damageEnemy, damageHero, heroDamageScale, HeroHitSource } from "./combat";
import { TICKS_PER_SECOND } from "./constants";
import { EventKind } from "./events";
import type { Run } from "./run";
import { debugWeather, updateWeather } from "./weather";

/** Bolts that can wait at once per player (a wave has at most `bolts.max` around each hero, and waves are 35 s and more apart). */
export const HAZARD_CAPACITY = 8;
/** Tries for a bolt's point inside the spread circle before it falls on the hero. */
const SPREAD_TRIES = 8;

/** The world's natural event (spec 2026-11-21 difficulties 4.7). Fixed arrays of HAZARD_CAPACITY bolts per player. */
export class HazardState {
  readonly x: Float64Array;
  readonly y: Float64Array;
  /** Steps until the bolt strikes; 0 = a free place. */
  readonly ticks: Int32Array;
  /** Tick of the next wave; -1 until the first update plans it (from the start of fromPhase or the run's start). */
  nextWaveTick = -1;
  /** Storm waves, or weathers started. */
  waves = 0;
  /** Steps left of the running weather (sim/weather.ts); 0 = none runs. */
  weatherTicks = 0;
  /** Steps until an announced weather starts; 0 = none announced. */
  warnTicks = 0;
  bolts = 0;

  constructor(players = 1) {
    this.x = new Float64Array(HAZARD_CAPACITY * players);
    this.y = new Float64Array(HAZARD_CAPACITY * players);
    this.ticks = new Int32Array(HAZARD_CAPACITY * players);
  }
}

/**
 * Once per step, right after updateBuffs: strikes the bolts whose warning ran out, then starts a wave when it is due.
 * Draws only from run.hazardRng.
 */
export function updateHazard(run: Run): void {
  const storm = stormOf(run.data.worlds[run.world - 1]!);
  if (storm !== null) updateStorm(run, storm);
  else updateWeather(run);
}

function updateStorm(run: Run, storm: Storm): void {
  const h = run.hazard;
  for (let i = 0; i < h.ticks.length; i++) {
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

/** Debug (`__game.debug.hazard()`): a storm wave or the weather at once; nothing in a thicket world. */
export function debugHazard(run: Run): void {
  const storm = stormOf(run.data.worlds[run.world - 1]!);
  if (storm !== null) startWave(run, storm);
  else debugWeather(run);
}

/** Steps until the nearest waiting bolt strikes; 0 when none waits. */
export function hazardPending(run: Run): number {
  let best = 0;
  for (let i = 0; i < run.hazard.ticks.length; i++) {
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
  const first = run.players[0]!.hero;
  if (h.waves === 0) run.events.push(EventKind.HazardWave, 0, 0, first.x, first.y, 0, 0);
  // every living hero gets his own bolts, drawn player after player (multiplayer migration step 3)
  for (let p = 0; p < run.players.length; p++) {
    const hero = run.players[p]!.hero;
    if (hero.hp <= 0 && run.players.length > 1) continue;
    boltsAround(run, storm, hero.x, hero.y);
  }
  h.waves++;
  h.nextWaveTick = run.tick + gapTicks(run, storm);
}

/** One wave's bolts.min to bolts.max bolts within storm.spread of (hx, hy). */
function boltsAround(run: Run, storm: Storm, hx: number, hy: number): void {
  const h = run.hazard;
  const rng = run.hazardRng;
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
    h.x[slot] = hx + px;
    h.y[slot] = hy + py;
    h.ticks[slot] = warn;
    h.bolts++;
    run.events.push(EventKind.Hazard, slot, 0, h.x[slot]!, h.y[slot]!, storm.radius, warn);
  }
}

/**
 * A bolt strikes: heroShare of the max hp of every hero inside (no armor; the hero's damage-taken scale is undone, so the share is
 * exact; the spirit shield stops it), enemyShare (bossShare for a boss) of each enemy's max hp in the circle (not
 * scaled by the berserk orb: the storm is not the hero's blow). The castle is spared.
 */
function strike(run: Run, storm: Storm, i: number): void {
  const h = run.hazard;
  const cx = h.x[i]!;
  const cy = h.y[i]!;
  const r2 = storm.radius * storm.radius;
  run.events.push(EventKind.Hazard, i, 1, cx, cy, storm.radius, 0);
  for (let p = 0; p < run.players.length; p++) {
    run.current = p;
    const hero = run.hero;
    const hx = hero.x - cx;
    const hy = hero.y - cy;
    if (hero.hp > 0 && hx * hx + hy * hy <= r2) {
      damageHero(run, (storm.heroShare * hero.stats.maxHp) / heroDamageScale(run), -1, HeroHitSource.Storm);
    }
  }
  run.current = 0;
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
