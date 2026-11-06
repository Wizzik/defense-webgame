import { damageEnemy } from "../combat";
import { TICKS_PER_SECOND, TICK_SECONDS } from "../constants";
import { EventKind } from "../events";
import type { Run } from "../run";
import { abilityCooldownTicks } from "./slots";
import type { AbilitySlot } from "./slots";

/** Auto-casts a line wave at the nearest enemy and advances the wave in flight. */
export function updateLine(run: Run, slot: AbilitySlot, index: number): void {
  const def = slot.def;
  if (def.kind !== "line") return;
  const L = slot.level - 1;
  const p = def.params;
  const length = p.length[L];
  const hero = run.hero;
  const e = run.enemies;

  if (slot.cooldown > 0) slot.cooldown--;

  if (!slot.active && slot.cooldown <= 0 && hero.hp > 0) {
    let best = -1;
    let bestSq = 0;
    const maxSq = length * length;
    let bestDx = 0;
    let bestDy = 0;
    for (let i = 0; i < e.capacity; i++) {
      if (e.alive[i] === 0) continue;
      const dx = e.x[i] - hero.x;
      const dy = e.y[i] - hero.y;
      const sq = dx * dx + dy * dy;
      if (sq > maxSq || (best >= 0 && sq >= bestSq)) continue;
      best = i;
      bestSq = sq;
      bestDx = dx;
      bestDy = dy;
    }
    if (best < 0) return;

    let dirX = hero.facingX;
    let dirY = hero.facingY;
    if (!hero.moving && bestSq > 0) {
      const len = Math.sqrt(bestSq);
      dirX = bestDx / len;
      dirY = bestDy / len;
    }
    slot.originX = hero.x;
    slot.originY = hero.y;
    slot.dirX = dirX;
    slot.dirY = dirY;
    slot.front = 0;
    slot.active = true;
    slot.hit.fill(0);
    run.events.push(EventKind.Cast, index, length, hero.x, hero.y, dirX, dirY);
    slot.cooldown = abilityCooldownTicks(run, slot);
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
    damageEnemy(run, i, damage, 1); // spells ignore armor
    if (e.alive[i] !== 0 && stun > e.stunTicks[i]) e.stunTicks[i] = stun;
  }
  slot.front = next;
  if (slot.front >= length) slot.active = false;
}
