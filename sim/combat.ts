import { METER_ATTACK, METER_ITEM } from "./damage-meter";
import { berserkScale, lifestealOnHit } from "./buffs";
import { TICKS_PER_SECOND } from "./constants";
import { Role } from "./enemies";
import { Slam, SlamEvent, windupRadius } from "./enemy-slam";
import { EventKind } from "./events";
import { gainGold } from "./crystals";
import { onGearEliteKill } from "./gear-effects";
import { gainXp } from "./level-up";
import type { Rng } from "./rng";
import type { Run } from "./run";
import { isChoosing } from "./player";

/**
 * `u` of a HeroHit event: a hit, a step of a poison cloud (the client neither shakes nor plays the hurt sound) or a
 * bolt of the storm (sim/hazard.ts).
 */
export const HeroHitSource = { Hit: 0, Cloud: 1, Storm: 2, Fire: 3 } as const;

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

/**
 * Multiplier on every enemy hit on the hero: rules.threat.heroDamageTaken x the hero's damageTaken (default 1) x the
 * damage-taken scale of his gear.
 */
export function heroDamageScale(run: Run): number {
  const hero = run.hero;
  return run.data.rules.threat.heroDamageTaken * (hero.def.damageTaken ?? 1) * hero.stats.damageTakenScale;
}

/**
 * Subtracts `amount` x heroDamageScale from the hero of the current player (nothing while his shield runs) and returns
 * what it took. `attacker` is the enemy slot (-1 for none); `source` goes to the event's u (HeroHitSource), the player
 * to its v.
 */
export function damageHero(run: Run, amount: number, attacker: number, source: number = HeroHitSource.Hit): number {
  const hero = run.hero;
  if (run.shieldTicks > 0) return 0;
  // a fallen hero of a co-op run takes nothing more (one player: the run ends in this step anyway)
  if (hero.hp <= 0 && run.players.length > 1) return 0;
  // nor does a co-op hero in his choice time (sim/coop-choice.ts)
  if (isChoosing(run)) return 0;
  const hit = source === HeroHitSource.Hit && attacker >= 0;
  // dodge (gear) draws from the run's generator only for a hero who has it; clouds, storms and fire are not dodged
  if (hit && hero.stats.dodge > 0 && run.rng.next() < hero.stats.dodge) {
    run.events.push(EventKind.HeroDodge, attacker, 0, hero.x, hero.y, 0, run.current);
    return 0;
  }
  const dealt = amount * heroDamageScale(run);
  hero.hp -= dealt;
  if (hit && hero.stats.thorns > 0 && run.data.enemies[run.enemies.type[attacker]!]!.attack.kind === "melee") {
    run.thorns.add(attacker, dealt * hero.stats.thorns);
  }
  run.events.push(EventKind.HeroHit, attacker, dealt, hero.x, hero.y, source, run.current);
  return dealt;
}

/** Subtracts `amount` from the castle (nothing while any player's shield runs) and records the hit tick. */
export function damageCastle(run: Run, amount: number, attacker: number): void {
  for (let p = 0; p < run.players.length; p++) if (run.players[p]!.shieldTicks > 0) return;
  const castle = run.castle;
  castle.hp -= amount;
  castle.lastHitTick = run.tick;
  const e = run.enemies;
  const ax = attacker >= 0 ? e.x[attacker] : castle.x;
  const ay = attacker >= 0 ? e.y[attacker] : castle.y;
  run.events.push(EventKind.CastleHit, attacker, amount, ax, ay, 0, 0);
}

/**
 * Subtracts `amount` (x the berserk orb's scale) from an enemy, wakes a sieger and kills it at 0 hp.
 * `source`: 0 base attack, 1 spell, 2 summoned unit. `ref`: spell slot (1), ally index (2), else -1.
 * Only sources 0 and 1 knock back and heal the hero by lifesteal (sim/buffs.ts). `meter`: the damage meter's
 * source the hit counts for (sim/damage-meter.ts): by default the basic attack (0), the spell slot or item effects
 * (1 with ref -1), nobody (2: the world's hazards); allies, thorns and item splash name theirs.
 */
export function damageEnemy(
  run: Run, slot: number, raw: number, source: 0 | 1 | 2, ref = -1,
  meter = source === 0 ? METER_ATTACK : source === 1 ? (ref >= 0 ? ref : METER_ITEM) : -1,
): void {
  const e = run.enemies;
  if (e.alive[slot] === 0) return;
  const amount = raw * berserkScale(run);
  const before = e.hp[slot];
  e.hp[slot] = before - amount;
  e.lastHitTick[slot] = run.tick;
  if (e.role[slot] === Role.Sieger) e.aggro[slot] = 1;
  const dealt = Math.min(amount, before);
  run.stats.damageDealt += dealt;
  if (source !== 2) lifestealOnHit(run, dealt);
  run.events.push(EventKind.Hit, slot, amount, e.x[slot], e.y[slot], source, ref);
  if (meter >= 0) run.players[run.current]!.meter.add(meter, dealt, e.hp[slot] <= 0);
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
  const resist = run.data.enemies[e.type[slot]].knockbackScale ?? 1;
  if (resist <= 0) return;
  const speed = ((source === 1 ? knockback.ability : knockback.attack) * resist) / knockback.seconds;
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

/** A coin falls this far east of the crystal and a heart this far west, so they do not hide each other. */
const COIN_OFFSET = 24;
const HEART_OFFSET = 24;

/**
 * Emits Death, counts the kill, frees the slot, remembers the place of a common enemy's death for gravebinders
 * (sim/corpses.ts) and drops an XP crystal and, for a type with gold, a coin
 * (XP and gold go straight to the hero when their store is full). An elite or a boss always drops a heart, a common
 * enemy with rules.sustain.hearts.chance drawn from sustainRng; a heart that does not fit is lost. A type with xp 0
 * drops nothing and leaves no place.
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
  const type = e.type[slot];
  if (e.slamState[slot] !== Slam.None) {
    run.events.push(EventKind.Slam, slot, SlamEvent.Cancelled, e.slamX[slot], e.slamY[slot], windupRadius(run, slot), 0);
  }
  if (run.isBoss[e.type[slot]] === 1 || run.isElite[e.type[slot]] === 1) onGearEliteKill(run);
  if (run.isBoss[e.type[slot]] === 1) {
    run.events.push(EventKind.BossDeath, e.type[slot], run.bossesKilled++, x, y, 0, 0);
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
  // an enemy worth nothing (a risen, xp 0) drops nothing and leaves no place to raise from: nothing to farm
  if (xp <= 0) return;
  if (run.isBoss[type] === 0 && run.isElite[type] === 0) run.corpses.record(x, y, run.tick);
  if (run.crystals.drop(x, y, xp) < 0) gainXp(run, xp);
  if (gold > 0 && run.coins.drop(x + COIN_OFFSET, y, gold) < 0) gainGold(run, gold);
  if (run.isBoss[type] === 1 || run.isElite[type] === 1 || run.sustainRng.next() < run.data.rules.sustain.hearts.chance) {
    run.hearts.drop(x - HEART_OFFSET, y, 1);
  }
}
