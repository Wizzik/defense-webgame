import { damageEnemy } from "../combat";
import { TICKS_PER_SECOND, TICK_SECONDS } from "../constants";
import type { Run } from "../run";
import { CastMode, castMode, startCast } from "./slots";
import type { AbilitySlot } from "./slots";
import { nearestEnemy } from "./targeting";

/** Auto-casts a line wave at the nearest enemy and advances the wave in flight. */
export function updateLine(run: Run, slot: AbilitySlot, index: number): void {
  const def = slot.def;
  if (def.kind !== "line") return;
  const L = slot.level - 1;
  const p = def.params;
  const length = p.length[L];
  const hero = run.hero;
  const e = run.enemies;

  if (!slot.active && castMode(run, index) !== CastMode.None) {
    const best = nearestEnemy(run, hero.x, hero.y, length);
    if (best < 0) return;
    const dx = e.x[best] - hero.x;
    const dy = e.y[best] - hero.y;
    const sq = dx * dx + dy * dy;

    let dirX = hero.facingX;
    let dirY = hero.facingY;
    if (!hero.moving && sq > 0) {
      const len = Math.sqrt(sq);
      dirX = dx / len;
      dirY = dy / len;
    }
    slot.originX = hero.x;
    slot.originY = hero.y;
    slot.dirX = dirX;
    slot.dirY = dirY;
    slot.front = 0;
    slot.active = true;
    slot.hit.fill(0);
    startCast(run, index, length, hero.x, hero.y, dirX, dirY);
  }

  if (!slot.active) return;

  const next = Math.min(length, slot.front + (p.waveSpeed?.[L] ?? length / TICK_SECONDS) * TICK_SECONDS);
  const halfWidth = p.width[L] / 2;
  const damage = p.damage[L] * hero.stats.spellPower;
  const stun = Math.round((p.stunSeconds?.[L] ?? 0) * TICKS_PER_SECOND);
  for (let i = 0; i < e.capacity; i++) {
    // A slot freed and refilled during the flight may inherit hit = 1; rare, accepted.
    if (e.alive[i] === 0 || slot.hit[i] !== 0) continue;
    const rx = e.x[i] - slot.originX;
    const ry = e.y[i] - slot.originY;
    const t = rx * slot.dirX + ry * slot.dirY;
    const cross = rx * slot.dirY - ry * slot.dirX;
    const s = cross < 0 ? -cross : cross;
    const c = run.data.enemies[e.type[i]].collision;
    if (!(t + c > slot.front && t - c <= next && t >= -c && s <= halfWidth + c)) continue;
    slot.hit[i] = 1;
    damageEnemy(run, i, damage, 1, index); // spells ignore armor
    if (e.alive[i] !== 0 && stun > e.stunTicks[i]) e.stunTicks[i] = stun;
  }
  slot.front = next;
  if (slot.front >= length) slot.active = false;
}
