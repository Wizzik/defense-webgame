import { armorReduction, damageEnemy, rollDamage } from "./combat";
import { TICKS_PER_SECOND, TICK_SECONDS } from "./constants";
import { nearestEnemy } from "./abilities/targeting";
import { IMAGE_OFFSETS, IMAGE_SPEED_FACTOR, IMAGE_STAND_DISTANCE } from "./abilities/summon";
import type { Run } from "./run";

export const AllyKind = { Ward: 0, Image: 1 } as const;
export const ALLY_CAPACITY = 32;

/**
 * Summoned allies (serpent wards and shadow copies) in typed arrays of fixed capacity.
 * Enemies neither see nor block them, so the `damageTaken` param of a summon is not used.
 */
export class AllyStore {
  readonly capacity: number;
  count = 0;
  readonly alive: Uint8Array;
  readonly kind: Uint8Array;
  /** Ability slot that summoned the ally. */
  readonly ability: Uint8Array;
  /** Index into IMAGE_OFFSETS (images only). */
  readonly formation: Uint8Array;
  readonly moving: Uint8Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly prevX: Float64Array;
  readonly prevY: Float64Array;
  readonly facingX: Float64Array;
  readonly facingY: Float64Array;
  readonly spawnTick: Int32Array;
  readonly expiresTick: Int32Array;
  readonly attackCooldown: Int32Array;
  readonly lastAttackTick: Int32Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.alive = new Uint8Array(capacity);
    this.kind = new Uint8Array(capacity);
    this.ability = new Uint8Array(capacity);
    this.formation = new Uint8Array(capacity);
    this.moving = new Uint8Array(capacity);
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.prevX = new Float64Array(capacity);
    this.prevY = new Float64Array(capacity);
    this.facingX = new Float64Array(capacity);
    this.facingY = new Float64Array(capacity);
    this.spawnTick = new Int32Array(capacity);
    this.expiresTick = new Int32Array(capacity);
    this.attackCooldown = new Int32Array(capacity);
    this.lastAttackTick = new Int32Array(capacity);
  }

  /** Takes the lowest free slot; returns -1 when the store is full. */
  spawn(
    kind: number, ability: number, formation: number, x: number, y: number, tick: number, expiresTick: number,
  ): number {
    for (let i = 0; i < this.capacity; i++) {
      if (this.alive[i] !== 0) continue;
      this.alive[i] = 1;
      this.kind[i] = kind;
      this.ability[i] = ability;
      this.formation[i] = formation;
      this.moving[i] = 0;
      this.x[i] = x;
      this.y[i] = y;
      this.prevX[i] = x;
      this.prevY[i] = y;
      this.facingX[i] = 0;
      this.facingY[i] = 1;
      this.spawnTick[i] = tick;
      this.expiresTick[i] = expiresTick;
      this.attackCooldown[i] = 0;
      this.lastAttackTick[i] = -1;
      this.count++;
      return i;
    }
    return -1;
  }

  remove(i: number): void {
    if (this.alive[i] === 0) return;
    this.alive[i] = 0;
    this.count--;
  }
}

/** Expires, moves and attacks every ally, in ascending slot order. */
export function updateAllies(run: Run): void {
  const a = run.allies;
  if (a.count === 0) return;
  for (let i = 0; i < a.capacity; i++) {
    if (a.alive[i] === 0) continue;
    if (run.tick >= a.expiresTick[i]) {
      a.remove(i);
      continue;
    }
    if (a.kind[i] === AllyKind.Ward) updateWard(run, i);
    else updateImage(run, i);
  }
}

function updateWard(run: Run, i: number): void {
  const a = run.allies;
  const slot = run.abilities[a.ability[i]];
  const def = slot.def;
  if (def.kind !== "summon") return;
  const p = def.params;
  if (!p.damage || !p.attackRange || !p.attackInterval) return;
  if (a.attackCooldown[i] > 0) a.attackCooldown[i]--;
  if (a.attackCooldown[i] > 0) return;
  const L = Math.max(0, slot.level - 1);
  const e = run.enemies;
  const target = nearestEnemy(run, a.x[i], a.y[i], p.attackRange[L]);
  if (target < 0) return;
  const reduction = armorReduction(run.data.enemies[e.type[target]].armor, run.data.constants.defenseArmor);
  face(run, i, e.x[target], e.y[target]);
  a.attackCooldown[i] = Math.round(p.attackInterval[L] * TICKS_PER_SECOND);
  a.lastAttackTick[i] = run.tick;
  damageEnemy(run, target, p.damage[L] * run.hero.stats.spellPower * (1 - reduction), 2, i);
}

function updateImage(run: Run, i: number): void {
  const a = run.allies;
  const { hero, enemies: e, data } = run;
  const slot = run.abilities[a.ability[i]];
  const def = slot.def;
  if (def.kind !== "summon" || !def.params.damageDealt) return;
  const stats = hero.stats;

  // Walk to the formation point; stand still within IMAGE_STAND_DISTANCE.
  const offset = IMAGE_OFFSETS[a.formation[i]];
  const dx = hero.x + offset[0] - a.x[i];
  const dy = hero.y + offset[1] - a.y[i];
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= IMAGE_STAND_DISTANCE) {
    a.moving[i] = 0;
  } else {
    const step = Math.min(d, stats.moveSpeed * IMAGE_SPEED_FACTOR * TICK_SECONDS);
    a.x[i] += (dx / d) * step;
    a.y[i] += (dy / d) * step;
    a.facingX[i] = dx / d;
    a.facingY[i] = dy / d;
    a.moving[i] = 1;
  }

  // Attack like the hero: the nearest enemy in reach.
  if (a.attackCooldown[i] > 0) a.attackCooldown[i]--;
  if (a.attackCooldown[i] > 0) return;
  const range = hero.def.baseAttack.range;
  let best = -1;
  let bestSq = 0;
  for (let t = 0; t < e.capacity; t++) {
    if (e.alive[t] === 0) continue;
    const reach = stats.collision + data.enemies[e.type[t]].collision + range;
    const ex = e.x[t] - a.x[i];
    const ey = e.y[t] - a.y[i];
    const sq = ex * ex + ey * ey;
    if (sq > reach * reach) continue;
    if (best < 0 || sq < bestSq) {
      best = t;
      bestSq = sq;
    }
  }
  if (best < 0) return;
  const L = Math.max(0, slot.level - 1);
  const reduction = armorReduction(data.enemies[e.type[best]].armor, data.constants.defenseArmor);
  const amount = rollDamage(run.rng, stats.damageMin, stats.damageMax) * def.params.damageDealt[L] * (1 - reduction);
  if (a.moving[i] === 0) face(run, i, e.x[best], e.y[best]);
  a.attackCooldown[i] = Math.round(stats.attackIntervalSeconds * TICKS_PER_SECOND);
  a.lastAttackTick[i] = run.tick;
  damageEnemy(run, best, amount, 2, i);
}

function face(run: Run, i: number, x: number, y: number): void {
  const a = run.allies;
  const dx = x - a.x[i];
  const dy = y - a.y[i];
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= 1e-6) return;
  a.facingX[i] = dx / d;
  a.facingY[i] = dy / d;
}
