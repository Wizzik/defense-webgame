import { TICKS_PER_SECOND } from "./constants";
import { Role } from "./enemies";
import { Slam, SlamEvent, windupRadius } from "./enemy-slam";
import { EventKind } from "./events";
import { gainGold } from "./crystals";
import { gainXp } from "./level-up";
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

/** Subtracts `amount` from the hero (nothing while the shield runs). `attacker` is the enemy slot (-1 for none). */
export function damageHero(run: Run, amount: number, attacker: number): void {
  if (run.shieldTicks > 0) return;
  const hero = run.hero;
  hero.hp -= amount;
  run.events.push(EventKind.HeroHit, attacker, amount, hero.x, hero.y, 0, 0);
}

/** Subtracts `amount` from the castle (nothing while the shield runs) and records the hit tick. */
export function damageCastle(run: Run, amount: number, attacker: number): void {
  if (run.shieldTicks > 0) return;
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
 * `source`: 0 base attack, 1 spell, 2 summoned unit. `ref`: spell slot (1), ally index (2), else -1.
 * Only sources 0 and 1 knock back.
 */
export function damageEnemy(run: Run, slot: number, amount: number, source: 0 | 1 | 2, ref = -1): void {
  const e = run.enemies;
  if (e.alive[slot] === 0) return;
  const before = e.hp[slot];
  e.hp[slot] = before - amount;
  e.lastHitTick[slot] = run.tick;
  if (e.role[slot] === Role.Sieger) e.aggro[slot] = 1;
  run.stats.damageDealt += Math.min(amount, before);
  run.events.push(EventKind.Hit, slot, amount, e.x[slot], e.y[slot], source, ref);
  if (e.hp[slot] <= 0) killEnemy(run, slot);
  else if (source !== 2) knockBack(run, slot, source);
}

/** Pushes a surviving enemy away from the hero; a newer knockback replaces an older one. A boss does not move. */
function knockBack(run: Run, slot: number, source: 0 | 1): void {
  const e = run.enemies;
  if (run.isBoss[e.type[slot]] === 1) return;
  const { knockback } = run.data.rules.enemies;
  const dx = e.x[slot] - run.hero.x;
  const dy = e.y[slot] - run.hero.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const ux = d > 1e-6 ? dx / d : 1;
  const uy = d > 1e-6 ? dy / d : 0;
  const speed = (source === 1 ? knockback.ability : knockback.attack) / knockback.seconds;
  e.knockVX[slot] = ux * speed;
  e.knockVY[slot] = uy * speed;
  e.knockTicks[slot] = Math.round(knockback.seconds * TICKS_PER_SECOND);
}

/**
 * Stuns a living enemy for `ticks` steps; a longer stun that already runs stays. On a boss the stun lasts
 * `rules.enemies.bossStunScale` of the time (rounded up).
 */
export function stunEnemy(run: Run, slot: number, ticks: number): void {
  if (ticks <= 0) return;
  const e = run.enemies;
  const scaled = run.isBoss[e.type[slot]] === 1 ? Math.ceil(ticks * run.data.rules.enemies.bossStunScale) : ticks;
  if (scaled > e.stunTicks[slot]) e.stunTicks[slot] = scaled;
}

/** A coin falls this far east of the crystal, so the two do not hide each other. */
const COIN_OFFSET = 24;

/**
 * Emits Death, counts the kill, frees the slot and drops an XP crystal and, for a type with gold, a coin
 * (XP and gold go straight to the hero when their store is full).
 */
export function killEnemy(run: Run, slot: number): void {
  const e = run.enemies;
  if (e.alive[slot] === 0) return;
  run.events.push(EventKind.Death, slot, 0, e.x[slot], e.y[slot], 0, 0);
  run.stats.kills++;
  const xp = run.data.enemies[e.type[slot]].xp;
  const gold = run.data.enemies[e.type[slot]].gold;
  const x = e.x[slot];
  const y = e.y[slot];
  if (e.slamState[slot] !== Slam.None) {
    run.events.push(EventKind.Slam, slot, SlamEvent.Cancelled, e.slamX[slot], e.slamY[slot], windupRadius(run, slot), 0);
  }
  if (run.isBoss[e.type[slot]] === 1) {
    run.bossCount--;
    for (let b = 0; b < run.bossLogCount; b++) {
      const record = run.bossLog[b];
      if (record.type === e.type[slot] && record.spawnTick === e.spawnTick[slot] && record.deathTick < 0) {
        record.deathTick = run.tick;
        break;
      }
    }
    if (slot === run.finalBossSlot) {
      run.finalBossSlot = -1;
      run.finalBossDead = true;
    }
  }
  e.kill(slot);
  if (run.crystals.drop(x, y, xp) < 0) gainXp(run, xp);
  if (gold > 0 && run.coins.drop(x + COIN_OFFSET, y, gold) < 0) gainGold(run, gold);
}
