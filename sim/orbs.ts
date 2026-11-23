import { OrbKind, startBuff } from "./buffs";
import { TICKS_PER_SECOND } from "./constants";
import { EventKind } from "./events";
import { isFree, nearestFree, pushX, pushY } from "./world-map/geometry";
import type { Run } from "./run";
import { nearestPlayer, nearestSq } from "./targets";

/** Places tried for an orb before the last one in the band is taken. */
const PLACE_TRIES = 40;

/**
 * The orb places on the map (spec 2026-11-19 sustain): each holds a living orb of a kind, or counts `timer` steps down
 * to its next orb. The magnet does not pull orbs; the hero walks to them.
 */
export class OrbStore {
  readonly alive: Uint8Array;
  readonly kind: Uint8Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  /** Steps until the place spawns its orb; 0 while the orb lives. */
  readonly timer: Int32Array;
  /** 1 once the place had an orb; its last spot then keeps the new orb away. */
  readonly placed: Uint8Array;

  constructor(count: number) {
    this.alive = new Uint8Array(count);
    this.kind = new Uint8Array(count);
    this.x = new Float64Array(count);
    this.y = new Float64Array(count);
    this.timer = new Int32Array(count);
    this.placed = new Uint8Array(count);
  }
}

/** The orb places of a new run, each counting down to its first orb (rules.sustain.orbs.firstSeconds). */
export function createOrbs(run: Run): OrbStore {
  const rules = run.data.rules.sustain.orbs;
  const orbs = new OrbStore(rules.maxOnMap);
  for (let i = 0; i < rules.maxOnMap; i++) orbs.timer[i] = Math.round(rules.firstSeconds[i]! * TICKS_PER_SECOND);
  return orbs;
}

function farFrom(x: number, y: number, ox: number, oy: number, minSq: number): boolean {
  const dx = x - ox;
  const dy = y - oy;
  return dx * dx + dy * dy >= minSq;
}

/**
 * Spawns an orb of a random kind at place `index`: a random point between the two castle distances, inside the
 * arena, minSpacing from the other living orbs and from the place's last spot, chestSpacing from the chests
 * (PLACE_TRIES tries, then the last point in the band; without one a point in the band clamped into the arena).
 */
export function placeOrb(run: Run, index: number): void {
  const { orbs, castle, chests, sustainRng: rng } = run;
  const rules = run.data.rules.sustain.orbs;
  const { arena } = run.data.rules;
  const limitX = arena.width / 2 - rules.pickupRadius;
  const limitY = arena.height / 2 - rules.pickupRadius;
  const minSq = rules.minCastleDistance * rules.minCastleDistance;
  const maxSq = rules.maxCastleDistance * rules.maxCastleDistance;
  const spacingSq = rules.minSpacing * rules.minSpacing;
  const chestSq = rules.chestSpacing * rules.chestSpacing;
  const middle = (rules.minCastleDistance + rules.maxCastleDistance) / 2;
  let px = Math.min(Math.max(castle.x, -limitX), limitX);
  let py = castle.y + middle <= limitY ? castle.y + middle : castle.y - middle;
  py = Math.min(Math.max(py, -limitY), limitY);
  for (let attempt = 0; attempt < PLACE_TRIES; attempt++) {
    const x = castle.x + (rng.next() * 2 - 1) * rules.maxCastleDistance;
    const y = castle.y + (rng.next() * 2 - 1) * rules.maxCastleDistance;
    const dx = x - castle.x;
    const dy = y - castle.y;
    const sq = dx * dx + dy * dy;
    if (sq < minSq || sq > maxSq || x < -limitX || x > limitX || y < -limitY || y > limitY) continue;
    if (!isFree(run.map, x, y, rules.pickupRadius)) continue;
    px = x;
    py = y;
    let apart = orbs.placed[index] === 0 || farFrom(x, y, orbs.x[index]!, orbs.y[index]!, spacingSq);
    for (let other = 0; apart && other < orbs.alive.length; other++) {
      if (other !== index && orbs.alive[other] === 1 && !farFrom(x, y, orbs.x[other]!, orbs.y[other]!, spacingSq)) apart = false;
    }
    for (let c = 0; apart && c < chests.x.length; c++) {
      if (!farFrom(x, y, chests.x[c]!, chests.y[c]!, chestSq)) apart = false;
    }
    if (apart) break;
  }
  const kind = Math.min(Math.floor(rng.next() * 3), 2);
  // every place, the fallback too, ends outside the obstacles
  nearestFree(run.map, px, py, rules.pickupRadius);
  spawnAt(run, index, kind, pushX, pushY);
}

function spawnAt(run: Run, index: number, kind: number, x: number, y: number): void {
  const orbs = run.orbs;
  orbs.alive[index] = 1;
  orbs.placed[index] = 1;
  orbs.kind[index] = kind;
  orbs.x[index] = x;
  orbs.y[index] = y;
  orbs.timer[index] = 0;
  run.events.push(EventKind.OrbSpawn, index, kind, x, y, 0, 0);
}

/**
 * Once per step: counts the empty places down and spawns their orbs; the nearest hero (sim/targets.ts) within
 * pickupRadius of a living orb picks it up for himself (its effect starts, the place waits respawnSeconds for the next orb).
 */
export function updateOrbs(run: Run): void {
  const { orbs } = run;
  const rules = run.data.rules.sustain.orbs;
  const pickupSq = rules.pickupRadius * rules.pickupRadius;
  for (let i = 0; i < orbs.alive.length; i++) {
    if (orbs.alive[i] === 0) {
      if (orbs.timer[i]! > 0) orbs.timer[i]!--;
      if (orbs.timer[i] === 0) placeOrb(run, i);
      continue;
    }
    const p = nearestPlayer(run, orbs.x[i]!, orbs.y[i]!);
    if (nearestSq > pickupSq) continue;
    const kind = orbs.kind[i] as OrbKind;
    orbs.alive[i] = 0;
    run.current = p;
    startBuff(run, kind);
    run.current = 0;
    if (kind === OrbKind.Boots) run.stats.orbsBoots++;
    else if (kind === OrbKind.Berserk) run.stats.orbsBerserk++;
    else run.stats.orbsHeal++;
    run.events.push(EventKind.OrbPickup, i, kind, orbs.x[i]!, orbs.y[i]!, p, 0);
    const { min, max } = rules.respawnSeconds;
    orbs.timer[i] = Math.max(Math.round((min + run.sustainRng.next() * (max - min)) * TICKS_PER_SECOND), 1);
  }
}

/** Spawns an orb of `kind` 150 ahead of the hero at the first empty place (else place 0); for tests and debugging. */
export function debugSpawnOrb(run: Run, kind: OrbKind): void {
  const { orbs, hero } = run;
  const { arena } = run.data.rules;
  let index = orbs.alive.indexOf(0);
  if (index < 0) index = 0;
  const limitX = arena.width / 2;
  const limitY = arena.height / 2;
  const x = Math.min(Math.max(hero.x + hero.facingX * 150, -limitX), limitX);
  const y = Math.min(Math.max(hero.y + hero.facingY * 150, -limitY), limitY);
  spawnAt(run, index, kind, x, y);
}
