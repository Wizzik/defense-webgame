import { TICKS_PER_SECOND } from "../constants";
import { AllyKind } from "../allies";
import type { Run } from "../run";
import { CastMode, castMode, startCast } from "./slots";
import type { AbilitySlot } from "./slots";
import { densestCluster, nearestEnemy } from "./targeting";

/** Radius of the circle of wards around the cluster point. */
export const WARD_RING = 80;
export const WARD_CLUSTER_RADIUS = 300;
export const IMAGE_SEEK_RANGE = 1500;
/** Copies run at this multiple of the hero's move speed. */
export const IMAGE_SPEED_FACTOR = 1.3;
/** A copy within this distance of its formation point stands still. */
export const IMAGE_STAND_DISTANCE = 8;
/** Formation of the copies relative to the hero, in world axes (it does not rotate). */
export const IMAGE_OFFSETS: readonly (readonly [number, number])[] = [
  [-120, -60], [120, -60], [0, -140], [-200, -120], [200, -120], [0, -220],
];

const D = 0.7071067811865476;
/** Eight fixed unit directions for the ward ring (no trigonometry in sim). */
const RING_DIRS: readonly (readonly [number, number])[] = [
  [1, 0], [D, D], [0, 1], [-D, D], [-1, 0], [-D, -D], [0, -1], [D, -D],
];

/** Wards (params with `damage`) or shadow copies (params with `damageDealt`); the schema guarantees exactly one. */
export function updateSummon(run: Run, slot: AbilitySlot, index: number): void {
  const def = slot.def;
  if (def.kind !== "summon") return;
  const mode = castMode(run, index);
  if (mode === CastMode.None) return;
  if (def.params.damage) castWards(run, slot, index);
  else castImages(run, slot, index, mode);
}

function castWards(run: Run, slot: AbilitySlot, index: number): void {
  const def = slot.def;
  if (def.kind !== "summon") return;
  const p = def.params;
  const L = slot.level - 1;
  const { hero, allies, enemies: e } = run;
  const target = densestCluster(run, hero.x, hero.y, p.range?.[L] ?? 500, WARD_CLUSTER_RADIUS);
  if (target < 0) return;
  const cx = e.x[target];
  const cy = e.y[target];
  const count = p.count[L];
  startCast(run, index, count, cx, cy, 0, 0);
  const expires = run.tick + Math.round(p.duration[L] * TICKS_PER_SECOND);
  const { arena } = run.data.rules;
  const maxAlive = p.maxAlive?.[L] ?? Infinity;
  for (let k = 0; k < count; k++) {
    if (countOf(run, index) >= maxAlive) removeOldest(run, index);
    let x = cx;
    let y = cy;
    if (count > 1) {
      const dir = RING_DIRS[k % 8];
      x += dir[0] * WARD_RING;
      y += dir[1] * WARD_RING;
    }
    x = Math.max(-arena.width / 2, Math.min(arena.width / 2, x));
    y = Math.max(-arena.height / 2, Math.min(arena.height / 2, y));
    if (allies.spawn(AllyKind.Ward, index, 0, x, y, run.tick, expires) < 0) break;
  }
}

function castImages(run: Run, slot: AbilitySlot, index: number, mode: number): void {
  const def = slot.def;
  if (def.kind !== "summon") return;
  const { hero, allies } = run;
  if (mode === CastMode.Auto && nearestEnemy(run, hero.x, hero.y, IMAGE_SEEK_RANGE) < 0) return;
  const L = slot.level - 1;
  for (let i = 0; i < allies.capacity; i++) {
    if (allies.alive[i] !== 0 && allies.ability[i] === index) allies.remove(i);
  }
  const count = Math.min(def.params.count[L], IMAGE_OFFSETS.length);
  const expires = run.tick + Math.round(def.params.duration[L] * TICKS_PER_SECOND);
  for (let k = 0; k < count; k++) {
    const [ox, oy] = IMAGE_OFFSETS[k];
    if (allies.spawn(AllyKind.Image, index, k, hero.x + ox, hero.y + oy, run.tick, expires) < 0) break;
  }
  startCast(run, index, count, hero.x, hero.y, 0, 0);
}

function countOf(run: Run, ability: number): number {
  const a = run.allies;
  let n = 0;
  for (let i = 0; i < a.capacity; i++) if (a.alive[i] !== 0 && a.ability[i] === ability) n++;
  return n;
}

/** Removes the ally of `ability` with the lowest spawnTick (then the lower slot). */
function removeOldest(run: Run, ability: number): void {
  const a = run.allies;
  let best = -1;
  for (let i = 0; i < a.capacity; i++) {
    if (a.alive[i] === 0 || a.ability[i] !== ability) continue;
    if (best < 0 || a.spawnTick[i] < a.spawnTick[best]) best = i;
  }
  if (best >= 0) a.remove(best);
}
