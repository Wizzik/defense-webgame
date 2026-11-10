import type { GameData } from "../data/schema";
import { consumeEmpower } from "./abilities/on-hit";
import { armorReduction, damageEnemy, rollDamage } from "./combat";
import { TICKS_PER_SECOND, TICK_SECONDS } from "./constants";
import type { TickInput } from "./input";
import type { Run } from "./run";
import type { HeroState, HeroStats } from "./world";

/** Derives the hero's combat stats from attributes (map formulas plus run rules). Writes into `out`. */
export function heroStats(data: GameData, hero: HeroState, out: HeroStats): HeroStats {
  const { constants: c, rules } = data;
  const def = hero.def;
  const primary = def.primary === "str" ? hero.str : def.primary === "agi" ? hero.agi : hero.int;
  const bonus = primary * c.primaryAttackBonus;
  out.maxHp = def.hp + hero.str * c.strHitPointBonus;
  out.regenPerSecond = rules.hero.baseRegen + hero.str * rules.hero.regenPerStr;
  out.armor = def.armor + hero.agi * c.agiDefenseBonus;
  out.attackIntervalSeconds =
    def.baseAttack.cooldown
    / Math.min(1 + hero.agi * c.agiAttackSpeedBonus + hero.bonus.attackSpeed, 1 + c.attackSpeedCap);
  out.damageMin = (def.baseAttack.damageMin + bonus) * (1 + hero.bonus.damage);
  out.damageMax = (def.baseAttack.damageMax + bonus) * (1 + hero.bonus.damage);
  out.spellPower = 1 + hero.int * rules.hero.spellPowerPerInt;
  out.cooldownScale = 1 / (1 + hero.int * rules.hero.cooldownSpeedPerInt);
  out.moveSpeed = def.moveSpeed * (1 + hero.bonus.moveSpeed);
  out.collision = rules.hero.collision;
  return out;
}

function sign(n: number): number {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

/** Moves the hero by the input direction at move speed, kept inside the arena. */
export function moveHero(run: Run, input: TickInput): void {
  const hero = run.hero;
  let dx = sign(input.moveX);
  let dy = sign(input.moveY);
  hero.moving = false;
  if (dx === 0 && dy === 0) return;
  const len = Math.sqrt(dx * dx + dy * dy);
  dx /= len;
  dy /= len;
  const step = hero.stats.moveSpeed * TICK_SECONDS;
  const { arena } = run.data.rules;
  const limitX = arena.width / 2 - hero.stats.collision;
  const limitY = arena.height / 2 - hero.stats.collision;
  hero.x = Math.max(-limitX, Math.min(limitX, hero.x + dx * step));
  hero.y = Math.max(-limitY, Math.min(limitY, hero.y + dy * step));
  hero.facingX = dx;
  hero.facingY = dy;
  hero.moving = true;
}

/** Regenerates the hero, counts the attack cooldown down and attacks the nearest enemy in reach. */
export function updateHeroCombat(run: Run): void {
  const { hero, enemies: e, data } = run;
  const stats = hero.stats;
  if (hero.hp > 0) hero.hp = Math.min(stats.maxHp, hero.hp + stats.regenPerSecond * TICK_SECONDS);
  if (hero.attackCooldown > 0) hero.attackCooldown--;
  if (hero.attackCooldown > 0 || hero.hp <= 0) return;

  const range = hero.def.baseAttack.range;
  let best = -1;
  let bestSq = 0;
  let bestDx = 0;
  let bestDy = 0;
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0) continue;
    const reach = stats.collision + data.enemies[e.type[i]].collision + range;
    const dx = e.x[i] - hero.x;
    const dy = e.y[i] - hero.y;
    const sq = dx * dx + dy * dy;
    if (sq > reach * reach) continue;
    if (best < 0 || sq < bestSq) {
      best = i;
      bestSq = sq;
      bestDx = dx;
      bestDy = dy;
    }
  }
  if (best < 0) return;

  const reduction = armorReduction(data.enemies[e.type[best]].armor, data.constants.defenseArmor);
  const empower = consumeEmpower(run, e.x[best], e.y[best]);
  const amount = rollDamage(run.rng, stats.damageMin, stats.damageMax) * empower * (1 - reduction);
  if (!hero.moving && bestSq > 0) {
    const len = Math.sqrt(bestSq);
    hero.facingX = bestDx / len;
    hero.facingY = bestDy / len;
  }
  hero.attackCooldown = Math.round(stats.attackIntervalSeconds * TICKS_PER_SECOND);
  damageEnemy(run, best, amount, 0);
}
