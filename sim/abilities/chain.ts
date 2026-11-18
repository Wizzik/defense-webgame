import { MAX_BOUNCES } from "../../data/schema";
import { damageEnemy } from "../combat";
import { EventKind } from "../events";
import type { Run } from "../run";
import { chainJumps } from "./chain-hits";
import { CastMode, castMode, startCast } from "./slots";
import type { AbilitySlot } from "./slots";
import { nearestEnemy } from "./targeting";

/** Radius of the flash every struck enemy shows, in world units. */
export const CHAIN_FLASH = 60;
/** Enemies one cast struck (scratch, allocated once; the schema caps bounces at MAX_BOUNCES). */
const struck = new Int32Array(MAX_BOUNCES + 1);

/**
 * Strikes the nearest enemy in range, then leaps `bounces` times to the nearest enemy not struck yet within
 * `bounceRange` of the last one. Cast: x/y = the hero, u/v = the direction to the first target; every struck
 * enemy sends a Blast (a = the slot) in order, so the client can draw the bolt from the hero along the chain.
 */
export function updateChain(run: Run, slot: AbilitySlot, index: number): void {
  const def = slot.def;
  if (def.kind !== "chain") return;
  if (castMode(run, index) === CastMode.None) return;
  const L = slot.level - 1;
  const p = def.params;
  const hero = run.hero;
  const e = run.enemies;
  const target = nearestEnemy(run, hero.x, hero.y, p.range[L]);
  if (target < 0) return;
  const tx = e.x[target];
  const ty = e.y[target];
  const dx = tx - hero.x;
  const dy = ty - hero.y;
  const sq = dx * dx + dy * dy;
  let dirX = hero.facingX;
  let dirY = hero.facingY;
  if (sq > 0) {
    const len = Math.sqrt(sq);
    dirX = dx / len;
    dirY = dy / len;
  }
  const damage = p.damage[L] * hero.stats.spellPower;
  startCast(run, index, p.bounces[L], hero.x, hero.y, dirX, dirY);
  run.events.push(EventKind.Blast, index, CHAIN_FLASH, tx, ty, 0, 0);
  damageEnemy(run, target, damage, 1, index);
  chainJumps(run, target, tx, ty, Math.min(p.bounces[L], MAX_BOUNCES), p.bounceRange[L], damage, struck, CHAIN_FLASH, index);
}
