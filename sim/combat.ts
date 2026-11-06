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
  const e = run.enemies;
  const ax = attacker >= 0 ? e.x[attacker] : hero.x;
  const ay = attacker >= 0 ? e.y[attacker] : hero.y;
  run.events.push(EventKind.HeroHit, attacker, amount, hero.x, hero.y, ax, ay);
}

/** Subtracts `amount` from the castle and records the hit tick. */
export function damageCastle(run: Run, amount: number, attacker: number): void {
  const castle = run.castle;
  castle.hp -= amount;
  castle.lastHitTick = run.tick;
  const e = run.enemies;
  const ax = attacker >= 0 ? e.x[attacker] : castle.x;
  const ay = attacker >= 0 ? e.y[attacker] : castle.y;
  run.events.push(EventKind.CastleHit, attacker, amount, castle.x, castle.y, ax, ay);
}
