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
      if (dx * dx + dy * dy <= reach * reach) damageEnemy(run, i, damage, 0);
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

/** Gold of a collected coin heals the castle while it stands. */
export function onGearGold(run: Run, value: number): void {
  const heal = run.gear.fx.goldHeal;
  const castle = run.castle;
  if (heal <= 0 || castle.hp <= 0) return;
  castle.hp = Math.min(castle.maxHp, castle.hp + heal * value);
}

/** Every step, after the abilities: the low-hp shield, the haste on cooldowns and the slow aura. */
export function updateGearEffects(run: Run): void {
  const fx = run.gear.fx;
  const hero = run.hero;
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
