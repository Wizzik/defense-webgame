import type { Hero } from "../data/schema";

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
}
