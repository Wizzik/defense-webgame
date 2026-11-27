import { chillAttackScale, updateChill } from "./chill";
import { isChoosing } from "./player";
import { snareSpeedScale } from "./hero-snares";
import type { GameData } from "../data/schema";
import { consumeEmpower, extraTargets, onHitBonus, onHitStunTicks } from "./abilities/on-hit";
import { armorReduction, damageEnemy, rollDamage, stunEnemy } from "./combat";
import { TICKS_PER_SECOND, TICK_SECONDS } from "./constants";
import { EventKind } from "./events";
import { onGearAttack } from "./gear-effects";
import { hitExtraTargets } from "./hero-multishot";
import { blink } from "./hero-blink";
import { splashBlow } from "./hero-splash";
import { InputAction } from "./input";
import type { TickInput } from "./input";
import type { Run } from "./run";
import { weatherSpeedScale } from "./weather";
import { groundSpeedScale, pushOut, pushX, pushY } from "./world-map/geometry";
import type { HeroState, HeroStats } from "./world";

/** Derives the hero's combat stats from attributes plus gear and passives (map formulas plus run rules). Writes into `out`. */
export function heroStats(data: GameData, hero: HeroState, out: HeroStats): HeroStats {
  const { constants: c, rules } = data;
  const def = hero.def;
  const gear = hero.gear;
  const passive = hero.passive;
  const str = hero.str + gear.str;
  const agi = hero.agi + gear.agi;
  const int = hero.int + gear.int;
  const primary = def.primary === "str" ? str : def.primary === "agi" ? agi : int;
  const bonus = primary * c.primaryAttackBonus;
  const power = def.power ?? 1;
  const damage = (1 + hero.bonus.damage + gear.damage + passive.attack) * power;
  out.maxHp = (def.hp + str * c.strHitPointBonus + gear.hp) * (1 + passive.hp);
  out.regenPerSecond = rules.hero.baseRegen + str * rules.hero.regenPerStr + gear.regen + passive.regen;
  out.armor = def.armor + agi * c.agiDefenseBonus + gear.armor;
  out.attackIntervalSeconds =
    def.baseAttack.cooldown
    / Math.min(1 + agi * c.agiAttackSpeedBonus + hero.bonus.attackSpeed + gear.attackSpeed + passive.attackSpeed,
      1 + c.attackSpeedCap);
  out.damageMin = (def.baseAttack.damageMin + bonus) * damage;
  out.damageMax = (def.baseAttack.damageMax + bonus) * damage;
  out.spellPower = (1 + int * rules.hero.spellPowerPerInt) * (1 + gear.spellPower + passive.spellPower) * power;
  out.cooldownScale = 1 / (1 + int * rules.hero.cooldownSpeedPerInt + passive.cooldown + gear.cooldownSpeed);
  out.moveSpeed = def.moveSpeed * (1 + hero.bonus.moveSpeed + gear.moveSpeed + passive.moveSpeed) * hero.speedScale;
  out.collision = rules.hero.collision;
  const { caps } = rules.loot;
  out.critChance = Math.min(gear.critChance, caps.critChance);
  out.critDamage = rules.loot.critDamage + Math.min(gear.critDamage, caps.critDamage);
  out.dodge = Math.min(gear.dodge, caps.dodge);
  out.damageTakenScale = 1 - Math.min(gear.damageTaken, caps.damageTaken);
  out.thorns = gear.thorns;
  out.ultimateScale = 1 / (1 + gear.ultimateCooldown);
  out.areaScale = 1 + gear.areaSize;
  return out;
}

function sign(n: number): number {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

/** Between savePrevious and moveHero: R sets ultimateRequested, T toggles ultimateAuto, Space starts a dash. */
export function applyActions(run: Run, input: TickInput): void {
  const actions = input.actions;
  if (actions === 0) return;
  if ((actions & InputAction.Ultimate) !== 0) run.ultimateRequested = true;
  if ((actions & InputAction.ToggleAuto) !== 0) run.ultimateAuto = !run.ultimateAuto;
  const hero = run.hero;
  if ((actions & InputAction.Blink) !== 0) blink(run, input);
  if ((actions & InputAction.Dash) === 0 || hero.hp <= 0 || hero.dashCharges <= 0 || hero.dashTicks > 0) return;
  if (hero.rootTicks > 0) return;
  let dx = sign(input.moveX);
  let dy = sign(input.moveY);
  if (dx === 0 && dy === 0) {
    dx = hero.facingX;
    dy = hero.facingY;
  } else {
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;
  }
  const { dash } = run.data.rules.hero;
  hero.dashDirX = dx;
  hero.dashDirY = dy;
  hero.dashTicks = Math.round(dash.seconds * TICKS_PER_SECOND);
  hero.dashCharges--;
  if (hero.dashCooldown <= 0) hero.dashCooldown = Math.round(dash.cooldownSeconds * TICKS_PER_SECOND);
  run.events.push(EventKind.Dash, 0, dash.distance, hero.x, hero.y, dx, dy);
}

/** Dash charges the hero holds at most: 1, or `dash.charges.count` from `dash.charges.fromLevel` (Petr 2026-11-26). */
export function maxDashCharges(run: Run): number {
  const { charges } = run.data.rules.hero.dash;
  return run.hero.level >= charges.fromLevel ? charges.count : 1;
}

/**
 * Refills spent dash charges one at a time: `dashCooldown` counts down the charge being refilled; when it comes back
 * and another is missing, the next one starts (so three spent charges take three cooldowns).
 */
function refillDash(run: Run): void {
  const hero = run.hero;
  if (hero.dashCooldown > 0) {
    hero.dashCooldown--;
    if (hero.dashCooldown === 0) hero.dashCharges++;
  }
  if (hero.dashCooldown === 0 && hero.dashCharges < maxDashCharges(run)) {
    hero.dashCooldown = Math.round(run.data.rules.hero.dash.cooldownSeconds * TICKS_PER_SECOND);
  }
}

/** The longest piece of one step's movement that is pushed out of obstacles on its own (the wall is 90 thick). */
export const MOVE_PIECE = 24;

/**
 * Moves the hero by the input direction at move speed (+ the path bonus on a path) or along the dash, kept inside the
 * arena and out of obstacles; roots hold it. A dash ends at an obstacle that stops more than half a piece of it.
 */
export function moveHero(run: Run, input: TickInput): void {
  walkHero(run, input);
  updateChill(run, run.hero.moving);
}

function walkHero(run: Run, input: TickInput): void {
  const hero = run.hero;
  refillDash(run);
  if (hero.blinkCooldown > 0) hero.blinkCooldown--;
  if (hero.hp <= 0) {
    // a fallen co-op hero lies where he fell until a teammate revives him (one player: the run has ended)
    hero.dashTicks = 0;
    hero.moving = false;
    return;
  }
  let dx: number;
  let dy: number;
  let step: number;
  let dashing = false;
  if (hero.rootTicks > 0) {
    hero.dashTicks = 0;
    hero.moving = false;
    return;
  }
  if (hero.dashTicks > 0) {
    const { dash } = run.data.rules.hero;
    dx = hero.dashDirX;
    dy = hero.dashDirY;
    step = dash.distance / Math.round(dash.seconds * TICKS_PER_SECOND);
    hero.dashTicks--;
    dashing = true;
  } else {
    dx = sign(input.moveX);
    dy = sign(input.moveY);
    hero.moving = false;
    if (dx === 0 && dy === 0) return;
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;
    step = hero.stats.moveSpeed * snareSpeedScale(hero) * TICK_SECONDS *
      groundSpeedScale(run.map, hero.x, hero.y) * weatherSpeedScale(run);
  }
  const { arena } = run.data.rules;
  const r = hero.stats.collision;
  const limitX = arena.width / 2 - r;
  const limitY = arena.height / 2 - r;
  // In pieces of at most MOVE_PIECE, each pushed out of the obstacles, so a dash cannot jump through the wall.
  const pieces = Math.ceil(step / MOVE_PIECE);
  const piece = step / pieces;
  for (let k = 0; k < pieces; k++) {
    const tx = Math.max(-limitX, Math.min(limitX, hero.x + dx * piece));
    const ty = Math.max(-limitY, Math.min(limitY, hero.y + dy * piece));
    pushOut(run.map, tx, ty, r);
    const ex = pushX - tx;
    const ey = pushY - ty;
    hero.x = Math.max(-limitX, Math.min(limitX, pushX));
    hero.y = Math.max(-limitY, Math.min(limitY, pushY));
    if (dashing && ex * ex + ey * ey > (piece * piece) / 4) {
      // a dash that runs into an obstacle ends there
      hero.dashTicks = 0;
      break;
    }
  }
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
  if (hero.attackCooldown > 0 || hero.hp <= 0 || isChoosing(run)) return;

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
  const bonus = onHitBonus(run, e.x[best], e.y[best]);
  const stun = onHitStunTicks;
  // a crit (gear) draws from the run's generator only for a hero who has crit chance
  const crit = stats.critChance > 0 && run.rng.next() < stats.critChance ? 1 + stats.critDamage : 1;
  const raw = (rollDamage(run.rng, stats.damageMin, stats.damageMax) * empower + bonus) * crit;
  const amount = raw * (1 - reduction);
  if (!hero.moving && bestSq > 0) {
    const len = Math.sqrt(bestSq);
    hero.facingX = bestDx / len;
    hero.facingY = bestDy / len;
  }
  hero.attackCooldown = Math.round(stats.attackIntervalSeconds * TICKS_PER_SECOND * chillAttackScale(run));
  const targetX = e.x[best];
  const targetY = e.y[best];
  const extra = extraTargets(run);
  damageEnemy(run, best, amount, 0);
  splashBlow(run, best, targetX, targetY, raw);
  // more blows (two axes): each rolls its own damage on the same target, or on its splash ground once it fell
  const strikes = hero.def.baseAttack.strikes ?? 1;
  for (let s = 1; s < strikes; s++) {
    const blow = (rollDamage(run.rng, stats.damageMin, stats.damageMax) + bonus) * crit;
    if (e.alive[best] === 1) damageEnemy(run, best, blow * (1 - reduction), 0);
    splashBlow(run, best, targetX, targetY, blow);
  }
  if (e.alive[best] === 1) stunEnemy(run, best, stun);
  hitExtraTargets(run, best, extra, stun, bonus);
  onGearAttack(run, best, targetX, targetY, amount);
}
