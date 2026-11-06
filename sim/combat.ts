import { Role } from "./enemies";
import { EventKind } from "./events";
import type { Rng } from "./rng";
import type { Run } from "./run";

/** Damage reduction from armor: 0 for armor <= 0, else armor * k / (1 + armor * k). */
export function armorReduction(armor: number, k: number): number {
  if (armor <= 0) return 0;
  const a = armor * k;
  return a / (1 + a);
}

/** Whole number in [round(min), round(max)]; always consumes exactly one RNG value. */
export function rollDamage(rng: Rng, min: number, max: number): number {
  const lo = Math.round(min);
  const hi = Math.round(max);
  return lo + Math.floor(rng.next() * (hi - lo + 1));
}

/** Subtracts `amount` from the hero. `attacker` is the enemy slot (-1 for none). */
export function damageHero(run: Run, amount: number, attacker: number): void {
  const hero = run.hero;
  hero.hp -= amount;
  run.events.push(EventKind.HeroHit, attacker, amount, hero.x, hero.y, 0, 0);
}

/** Subtracts `amount` from the castle and records the hit tick. */
export function damageCastle(run: Run, amount: number, attacker: number): void {
  const castle = run.castle;
  castle.hp -= amount;
  castle.lastHitTick = run.tick;
  const e = run.enemies;
  const ax = attacker >= 0 ? e.x[attacker] : castle.x;
  const ay = attacker >= 0 ? e.y[attacker] : castle.y;
  run.events.push(EventKind.CastleHit, attacker, amount, ax, ay, 0, 0);
}

/**
 * Subtracts `amount` from an enemy, wakes a sieger and kills it at 0 hp.
 * `source` is 0 for the base attack and 1 for an ability.
 */
export function damageEnemy(run: Run, slot: number, amount: number, source: 0 | 1): void {
  const e = run.enemies;
  if (e.alive[slot] === 0) return;
  const before = e.hp[slot];
  e.hp[slot] = before - amount;
  e.lastHitTick[slot] = run.tick;
  if (e.role[slot] === Role.Sieger) e.aggro[slot] = 1;
  run.stats.damageDealt += Math.min(amount, before);
  run.events.push(EventKind.Hit, slot, amount, e.x[slot], e.y[slot], source, 0);
  if (e.hp[slot] <= 0) killEnemy(run, slot);
}

/** Emits Death, counts the kill and frees the slot. Task 7 adds the crystal drop here. */
export function killEnemy(run: Run, slot: number): void {
  const e = run.enemies;
  if (e.alive[slot] === 0) return;
  run.events.push(EventKind.Death, slot, 0, e.x[slot], e.y[slot], 0, 0);
  run.stats.kills++;
  e.kill(slot);
}
