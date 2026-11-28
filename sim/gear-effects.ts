import { METER_ITEM } from "./damage-meter";
import { chainJumps } from "./abilities/chain-hits";
import { damageEnemy } from "./combat";
import { TICKS_PER_SECOND } from "./constants";
import { applySlow } from "./enemies";
import { EventKind } from "./events";
import { ROLLED_ITEM } from "./gear";
import type { Run } from "./run";

/** Enemies a chain may reach in one cast (the schema caps `jumps` at 8). */
const MAX_JUMPS = 8;
/** The slow aura is applied again every this many steps and lasts a little longer, so it never lapses in between. */
const AURA_PERIOD = 10;
const AURA_TICKS = AURA_PERIOD + 5;
/** Radius of the flash a chain jump shows, in world units. */
const CHAIN_FLASH = 60;
/** Death bursts waiting for the next updateGearEffects; more in one step are lost. */
export const MAX_BURSTS = 16;

/**
 * The special effects of the worn items: the numbers (0 where the hero wears no such item; set by `loadEffects`)
 * and the counters they keep during the run. Fixed fields only; nothing here allocates in a step.
 */
export class GearFx {
  chainEvery = 0;
  chainDamage = 0;
  chainJumps = 0;
  chainRange = 0;
  /** Basic attacks since the last chain. */
  chainCount = 0;
  splashChance = 0;
  splashRadius = 0;
  splashFraction = 0;
  shieldThreshold = 0;
  shieldTicks = 0;
  /** Steps from one shield to the next (its length plus the cooldown). */
  shieldPeriod = 0;
  /** Steps until the shield may start again. */
  shieldWait = 0;
  hasteSpeed = 0;
  hasteTicks = 0;
  /** Steps of haste left. */
  hasteLeft = 0;
  /** Fraction of an extra cooldown step carried over. */
  hasteCarry = 0;
  auraRadius = 0;
  auraSlow = 0;
  goldHeal = 0;
  healKills = 0;
  healHp = 0;
  /** Kills since the last heal. */
  healCount = 0;
  novaDamage = 0;
  novaRadius = 0;
  novaTicks = 0;
  /** Steps until the nova may fire again; 1 when a hit asked for one (it fires in updateGearEffects). */
  novaWait = 0;
  novaPending = 0;
  eliteBonus = 0;
  burstChance = 0;
  burstDamage = 0;
  burstRadius = 0;
  /** Bursts waiting (their places), and whether one is being dealt now (a burst's kills start none). */
  burstCount = 0;
  bursting = 0;
  readonly burstX = new Float64Array(MAX_BURSTS);
  readonly burstY = new Float64Array(MAX_BURSTS);
  castleWard = 0;
  /** Scratch: enemies a chain already hit, and the grid's answer for the aura. */
  readonly chainHit = new Int32Array(MAX_JUMPS + 1);
  readonly near: Int32Array;

  constructor(maxEnemies: number) {
    this.near = new Int32Array(maxEnemies);
  }
}

/**
 * Reads the effects of the worn items into `run.gear.fx`. Counters stay. When two worn items carry the same
 * kind, the one in the later slot counts (effects do not stack). Called by recomputeGear.
 */
export function loadEffects(run: Run): void {
  const { gear, data } = run;
  const fx = gear.fx;
  fx.chainEvery = 0;
  fx.splashChance = 0;
  fx.shieldThreshold = 0;
  fx.hasteSpeed = 0;
  fx.auraRadius = 0;
  fx.goldHeal = 0;
  fx.healKills = 0;
  fx.novaDamage = 0;
  fx.eliteBonus = 0;
  fx.burstChance = 0;
  fx.castleWard = 0;
  for (let slot = 0; slot < gear.item.length; slot++) {
    const index = gear.item[slot]!;
    // a rolled mythic carries one of rules.loot.mythicEffects (random items)
    const effect = index >= 0 ? data.items[index]!.effect
      : gear.rolledEffect[slot]! >= 0 && gear.item[slot] === ROLLED_ITEM ? data.rules.loot.mythicEffects[gear.rolledEffect[slot]!]
      : undefined;
    if (!effect) continue;
    switch (effect.kind) {
      case "chain_on_attack":
        fx.chainEvery = effect.params.every;
        fx.chainDamage = effect.params.damage;
        fx.chainJumps = Math.min(effect.params.jumps, MAX_JUMPS);
        fx.chainRange = effect.params.range;
        break;
      case "splash_on_attack":
        fx.splashChance = effect.params.chance;
        fx.splashRadius = effect.params.radius;
        fx.splashFraction = effect.params.fraction;
        break;
      case "low_hp_shield":
        fx.shieldThreshold = effect.params.threshold;
        fx.shieldTicks = Math.round(effect.params.seconds * TICKS_PER_SECOND);
        fx.shieldPeriod = Math.round((effect.params.seconds + effect.params.cooldown) * TICKS_PER_SECOND);
        break;
      case "haste_on_elite_kill":
        fx.hasteSpeed = effect.params.cooldownSpeed;
        fx.hasteTicks = Math.round(effect.params.seconds * TICKS_PER_SECOND);
        break;
      case "slow_aura":
        fx.auraRadius = effect.params.radius;
        fx.auraSlow = effect.params.slow;
        break;
      case "gold_heals_castle":
        fx.goldHeal = effect.params.perGold;
        break;
      case "heal_on_kill":
        fx.healKills = effect.params.kills;
        fx.healHp = effect.params.hp;
        break;
      case "nova_when_hit":
        fx.novaDamage = effect.params.damage;
        fx.novaRadius = effect.params.radius;
        fx.novaTicks = Math.round(effect.params.cooldown * TICKS_PER_SECOND);
        break;
      case "elite_slayer":
        fx.eliteBonus = effect.params.share;
        break;
      case "death_burst":
        fx.burstChance = effect.params.chance;
        fx.burstDamage = effect.params.damage;
        fx.burstRadius = effect.params.radius;
        break;
      case "castle_ward":
        fx.castleWard = effect.params.share;
        break;
    }
  }
}

/**
 * After a basic attack of the hero hit enemy `target` (at x, y) for `amount`: the splash rolls its chance
 * (one value of the run's generator per attack, only for a hero who wears it) and the chain counts the attack.
 */
export function onGearAttack(run: Run, target: number, x: number, y: number, amount: number): void {
  const fx = run.gear.fx;
  const e = run.enemies;
  if (fx.splashChance > 0 && run.rng.next() < fx.splashChance) {
    const damage = amount * fx.splashFraction;
    run.events.push(EventKind.Blast, -1, fx.splashRadius, x, y, 0, 0);
    for (let i = 0; i < e.capacity; i++) {
      if (e.alive[i] === 0 || i === target) continue;
      const reach = fx.splashRadius + run.data.enemies[e.type[i]!]!.collision;
      const dx = e.x[i]! - x;
      const dy = e.y[i]! - y;
      if (dx * dx + dy * dy <= reach * reach) damageEnemy(run, i, damage, 0, -1, METER_ITEM);
    }
  }
  if (fx.chainEvery <= 0) return;
  if (++fx.chainCount < fx.chainEvery) return;
  fx.chainCount = 0;
  const damage = fx.chainDamage * run.hero.stats.spellPower;
  chainJumps(run, target, x, y, fx.chainJumps, fx.chainRange, damage, fx.chainHit, CHAIN_FLASH);
}

/** An elite or a boss fell: the haste starts (again). */
export function onGearEliteKill(run: Run): void {
  const fx = run.gear.fx;
  if (fx.hasteSpeed > 0) fx.hasteLeft = fx.hasteTicks;
}

/**
 * An enemy of the current player fell at (x, y): the heal counts the kill, and a death burst rolls its chance (one
 * value of the run's generator per kill, only for a hero who wears it; never for a kill of a burst).
 */
export function onGearKill(run: Run, x: number, y: number): void {
  const fx = run.gear.fx;
  if (fx.healKills > 0 && ++fx.healCount >= fx.healKills) {
    fx.healCount = 0;
    const hero = run.hero;
    if (hero.hp > 0) hero.hp = Math.min(hero.stats.maxHp, hero.hp + fx.healHp);
  }
  if (fx.burstChance <= 0 || fx.bursting === 1) return;
  if (run.rng.next() >= fx.burstChance || fx.burstCount >= MAX_BURSTS) return;
  fx.burstX[fx.burstCount] = x;
  fx.burstY[fx.burstCount] = y;
  fx.burstCount++;
}

/** The current hero took damage: the nova fires in the next updateGearEffects unless it waits out its cooldown. */
export function onGearHeroHit(run: Run): void {
  const fx = run.gear.fx;
  if (fx.novaDamage > 0 && fx.novaWait === 0) fx.novaPending = 1;
}

/** The damage scale of a hit on enemy type `type`: elite_slayer against elites and bosses. */
export function gearDamageScale(run: Run, type: number): number {
  const bonus = run.gear.fx.eliteBonus;
  return bonus > 0 && (run.isBoss[type] === 1 || run.isElite[type] === 1) ? 1 + bonus : 1;
}

/** The share less damage the castle takes: the strongest castle_ward any player wears (wards do not stack). */
export function castleWardShare(run: Run): number {
  let ward = 0;
  for (let p = 0; p < run.players.length; p++) ward = Math.max(ward, run.players[p]!.gear.fx.castleWard);
  return ward;
}

/** `damage` x spell power to every living enemy within `radius` of (x, y), for the item row of the meter. */
function blast(run: Run, x: number, y: number, radius: number, damage: number): void {
  const e = run.enemies;
  run.events.push(EventKind.Blast, -1, radius, x, y, 0, 0);
  const amount = damage * run.hero.stats.spellPower;
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0) continue;
    const reach = radius + run.data.enemies[e.type[i]!]!.collision;
    const dx = e.x[i]! - x;
    const dy = e.y[i]! - y;
    if (dx * dx + dy * dy <= reach * reach) damageEnemy(run, i, amount, 1, -1, METER_ITEM);
  }
}

/** Gold of a collected coin heals the castle while it stands. */
export function onGearGold(run: Run, value: number): void {
  const heal = run.gear.fx.goldHeal;
  const castle = run.castle;
  if (heal <= 0 || castle.hp <= 0) return;
  castle.hp = Math.min(castle.maxHp, castle.hp + heal * value);
}

/**
 * Every step, after the abilities: the low-hp shield, the haste on cooldowns, the slow aura, the nova of a hit and the
 * death bursts waiting since the last step.
 */
export function updateGearEffects(run: Run): void {
  const fx = run.gear.fx;
  const hero = run.hero;
  if (fx.novaWait > 0) fx.novaWait--;
  if (fx.novaPending === 1) {
    fx.novaPending = 0;
    if (fx.novaDamage > 0 && hero.hp > 0) {
      fx.novaWait = fx.novaTicks;
      blast(run, hero.x, hero.y, fx.novaRadius, fx.novaDamage);
    }
  }
  if (fx.burstCount > 0) {
    fx.bursting = 1;
    for (let b = 0; b < fx.burstCount; b++) blast(run, fx.burstX[b]!, fx.burstY[b]!, fx.burstRadius, fx.burstDamage);
    fx.burstCount = 0;
    fx.bursting = 0;
  }
  if (fx.shieldWait > 0) fx.shieldWait--;
  if (
    fx.shieldThreshold > 0 && fx.shieldWait === 0 && run.shieldTicks === 0
    && hero.hp > 0 && hero.hp < hero.stats.maxHp * fx.shieldThreshold
  ) {
    run.shieldTicks = fx.shieldTicks;
    fx.shieldWait = fx.shieldPeriod;
  }
  if (fx.hasteLeft > 0) {
    fx.hasteLeft--;
    fx.hasteCarry += fx.hasteSpeed - 1;
    while (fx.hasteCarry >= 1) {
      fx.hasteCarry -= 1;
      const slots = run.abilities;
      for (let i = 0; i < slots.length; i++) {
        if (slots[i]!.level >= 1 && slots[i]!.cooldown > 0) slots[i]!.cooldown--;
      }
    }
  }
  if (fx.auraRadius > 0 && hero.hp > 0 && run.tick % AURA_PERIOD === 0) {
    // the grid holds the enemies as updateEnemies placed them in this step
    const e = run.enemies;
    const found = run.grid.query(hero.x, hero.y, fx.auraRadius, fx.near);
    for (let k = 0; k < found; k++) {
      const i = fx.near[k]!;
      if (e.alive[i] === 1) applySlow(e, i, fx.auraSlow, AURA_TICKS);
    }
  }
}
