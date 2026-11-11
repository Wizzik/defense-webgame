import type { Run } from "./run";

/** How an enemy type walks; the index of `behavior` in the enemy schema. */
export const Behavior = { Siege: 0, Flank: 1, Skirmish: 2, Support: 3, Charge: 4 } as const;
export const BEHAVIOR_IDS = ["siege", "flank", "skirmish", "support", "charge"] as const;

/** A flanker nearer than this walks straight at the hero. */
export const FLANK_STRAIGHT_RANGE = 300;
/** A reloading skirmisher keeps this share of its reach between itself and the hero. */
export const SKIRMISH_KEEP = 0.6;
/** A support looks for an ally within SEEK, walks up to HOLD from it, and flees a hero nearer than FLEE. */
export const SUPPORT_SEEK = 600;
export const SUPPORT_HOLD = 250;
export const SUPPORT_FLEE = 350;

/** cos 45° = sin 45°. */
const DIAGONAL = 0.7071067811865476;
/** The grid holds the positions from the start of the step; this margin covers one step of movement. */
const GRID_MARGIN = 64;

/** Out values of `steer` (no allocation). */
export let steerX = 0;
export let steerY = 0;
export let steerHold = false;

/** Candidate buffer; it grows only when a run has a bigger enemy store. */
let candidates = new Int32Array(0);

/**
 * Walking direction of enemy i towards its target at unit vector (ux, uy), distance `dist`, attack reach `reach`.
 * Writes steerX/steerY (unit vector or zero) and steerHold (true: the enemy may not attack this step).
 */
export function steer(run: Run, i: number, targetsHero: boolean, ux: number, uy: number, dist: number, reach: number): void {
  steerX = ux;
  steerY = uy;
  steerHold = false;
  const e = run.enemies;
  const behavior = run.enemyBehavior[e.type[i]];
  if (behavior === Behavior.Flank) {
    if (!targetsHero || dist <= FLANK_STRAIGHT_RANGE) return;
    // 45° off the line to the hero: even slots to the left, odd slots to the right
    const side = (i & 1) === 0 ? DIAGONAL : -DIAGONAL;
    steerX = ux * DIAGONAL - uy * side;
    steerY = ux * side + uy * DIAGONAL;
  } else if (behavior === Behavior.Skirmish) {
    if (targetsHero && e.attackCooldown[i] > 0 && dist < SKIRMISH_KEEP * reach) {
      steerX = -ux;
      steerY = -uy;
      steerHold = true;
    }
  } else if (behavior === Behavior.Support) {
    steerSupport(run, i);
  }
}

/** With no ally in range the direction stays as set by the caller (straight to the target). */
function steerSupport(run: Run, i: number): void {
  const e = run.enemies;
  const x = e.x[i];
  const y = e.y[i];
  if (candidates.length < e.capacity) candidates = new Int32Array(e.capacity);
  const found = run.grid.query(x, y, SUPPORT_SEEK + GRID_MARGIN, candidates);
  let ally = -1;
  let bestSq = SUPPORT_SEEK * SUPPORT_SEEK;
  for (let k = 0; k < found; k++) {
    const j = candidates[k];
    if (j === i || e.alive[j] === 0 || run.enemyBehavior[e.type[j]] === Behavior.Support) continue;
    const dx = e.x[j] - x;
    const dy = e.y[j] - y;
    const sq = dx * dx + dy * dy;
    if (sq > bestSq || (sq === bestSq && ally >= 0 && j > ally)) continue;
    ally = j;
    bestSq = sq;
  }
  if (ally < 0) return;
  const hx = x - run.hero.x;
  const hy = y - run.hero.y;
  const heroDist = Math.sqrt(hx * hx + hy * hy);
  if (heroDist < SUPPORT_FLEE) {
    steerX = heroDist > 1e-6 ? hx / heroDist : 1;
    steerY = heroDist > 1e-6 ? hy / heroDist : 0;
    steerHold = true;
    return;
  }
  const d = Math.sqrt(bestSq);
  if (d > SUPPORT_HOLD) {
    steerX = (e.x[ally] - x) / d;
    steerY = (e.y[ally] - y) / d;
  } else {
    steerX = 0;
    steerY = 0;
  }
}
