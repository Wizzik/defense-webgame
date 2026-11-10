import type { Run } from "../run";
import { CastMode, castMode, startCast } from "./slots";
import type { AbilitySlot } from "./slots";
import { nearestEnemy } from "./targeting";

/** Auto-casts a homing bolt at the nearest enemy; waits when nothing is in range or the bolt store is full. */
export function updateProjectile(run: Run, slot: AbilitySlot, index: number): void {
  const def = slot.def;
  if (def.kind !== "projectile") return;
  if (castMode(run, index) === CastMode.None) return;
  const store = run.projectiles;
  if (store.count >= store.capacity) return;
  const L = slot.level - 1;
  const p = def.params;
  const hero = run.hero;
  const e = run.enemies;
  const target = nearestEnemy(run, hero.x, hero.y, p.range[L]);
  if (target < 0) return;
  const dx = e.x[target] - hero.x;
  const dy = e.y[target] - hero.y;
  const sq = dx * dx + dy * dy;
  let dirX = hero.facingX;
  let dirY = hero.facingY;
  if (sq > 0) {
    const len = Math.sqrt(sq);
    dirX = dx / len;
    dirY = dy / len;
  }
  startCast(run, index, 0, hero.x, hero.y, dirX, dirY);
  store.spawn(index, target, e.spawnTick[target], hero.x, hero.y, p.speed?.[L] ?? 1200,
    p.damage[L] * hero.stats.spellPower);
}
