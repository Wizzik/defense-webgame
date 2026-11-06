import type { GameData } from "../data/schema";
import { TICK_SECONDS } from "./constants";
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
    def.baseAttack.cooldown / Math.min(1 + hero.agi * c.agiAttackSpeedBonus, 1 + c.attackSpeedCap);
  out.damageMin = def.baseAttack.damageMin + bonus;
  out.damageMax = def.baseAttack.damageMax + bonus;
  out.spellPower = 1 + hero.int * rules.hero.spellPowerPerInt;
  out.cooldownScale = 1 / (1 + hero.int * rules.hero.cooldownSpeedPerInt);
  out.moveSpeed = def.moveSpeed;
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
