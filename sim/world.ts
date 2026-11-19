import type { Hero } from "../data/schema";
import type { GearBonus } from "./gear";

export interface HeroStats {
  maxHp: number;
  regenPerSecond: number;
  armor: number;
  attackIntervalSeconds: number;
  damageMin: number;
  damageMax: number;
  spellPower: number;
  cooldownScale: number;
  moveSpeed: number;
  collision: number;
}

/** Sum of the learned passives at their levels (fractions, except regen in hp/s and magnet in world units). */
export interface PassiveBonus {
  attack: number;
  spellPower: number;
  cooldown: number;
  hp: number;
  regen: number;
  moveSpeed: number;
  attackSpeed: number;
  gold: number;
  magnet: number;
}

export function emptyPassiveBonus(): PassiveBonus {
  return { attack: 0, spellPower: 0, cooldown: 0, hp: 0, regen: 0, moveSpeed: 0, attackSpeed: 0, gold: 0, magnet: 0 };
}

export interface HeroState {
  def: Hero;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  /** Unit vector; (0, 1) at the start (north). */
  facingX: number;
  facingY: number;
  /** The hero moved in this step. */
  moving: boolean;
  level: number;
  xp: number;
  str: number;
  agi: number;
  int: number;
  hp: number;
  stats: HeroStats;
  /** Sum of the learned auras (fractions, 0 = none); filled by auraBonuses before every stat recomputation. */
  bonus: { damage: number; moveSpeed: number; attackSpeed: number };
  /** Sum of the worn items' stats; filled by recomputeGear (sim/gear.ts). */
  gear: GearBonus;
  /** Sum of the learned passives; filled by passiveBonuses (sim/abilities/passive.ts) before every stat recomputation. */
  passive: PassiveBonus;
  /** Steps of the dash left; the hero moves along (dashDirX, dashDirY) while > 0. */
  dashTicks: number;
  /** Steps until the next dash may start. */
  dashCooldown: number;
  dashDirX: number;
  dashDirY: number;
  /** Steps until the next basic attack (Task 5). */
  attackCooldown: number;
  /** Level-ups waiting for a card choice (Task 7). */
  pendingLevelUps: number;
  /** Multiplier on the final move speed: 1, or rules.sustain.boots.moveSpeed while the boots orb runs (sim/buffs.ts). */
  speedScale: number;
}

export interface CastleState {
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  lastHitTick: number;
}

export interface RunStats {
  kills: number;
  /** Enemies created by the spawner. */
  spawned: number;
  damageDealt: number;
  /** All XP the hero gained, level-ups included. */
  xpGained: number;
  /** All gold the hero gained. */
  goldGained: number;
  /** Hearts picked up. */
  hearts: number;
  /** Orbs picked up, by kind. */
  orbsBoots: number;
  orbsBerserk: number;
  orbsHeal: number;
  /** Hp healed by lifesteal, hearts and the heal orb. */
  healedLifesteal: number;
  healedHearts: number;
  healedOrb: number;
}
