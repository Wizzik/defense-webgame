import { damageEnemy } from "../combat";
import type { Run } from "../run";
import { CastMode, castMode, startCast } from "./slots";
import type { AbilitySlot } from "./slots";
import { nearestEnemy } from "./targeting";

export const CONE_START_HALF_WIDTH = 60;

/** Auto-casts a widening cone at the nearest enemy and strikes the nearest maxTargets enemies inside it. */
export function updateCone(run: Run, slot: AbilitySlot, index: number): void {
  const def = slot.def;
  if (def.kind !== "cone") return;
  if (castMode(run, index) === CastMode.None) return;
  const L = slot.level - 1;
  const p = def.params;
  const hero = run.hero;
  const e = run.enemies;
  const length = p.length[L];
  const lead = nearestEnemy(run, hero.x, hero.y, length);
  if (lead < 0) return;
  const dx = e.x[lead] - hero.x;
  const dy = e.y[lead] - hero.y;
  const sq = dx * dx + dy * dy;
  let dirX = hero.facingX;
  let dirY = hero.facingY;
  if (sq > 0) {
    const len = Math.sqrt(sq);
    dirX = dx / len;
    dirY = dy / len;
  }
  startCast(run, index, length, hero.x, hero.y, dirX, dirY);

  const endHalf = p.endWidth[L] / 2;
  const damage = p.damage[L] * hero.stats.spellPower;
  const picked = slot.hit; // reused as the "already struck" marks
  picked.fill(0);
  for (let n = 0; n < p.maxTargets[L]; n++) {
    let best = -1;
    let bestT = 0;
    for (let i = 0; i < e.capacity; i++) {
      if (e.alive[i] === 0 || picked[i] !== 0) continue;
      const rx = e.x[i] - hero.x;
      const ry = e.y[i] - hero.y;
      const t = rx * dirX + ry * dirY;
      const c = run.data.enemies[e.type[i]].collision;
      if (t < -c || t > length) continue;
      const cross = rx * dirY - ry * dirX;
      const s = cross < 0 ? -cross : cross;
      const frac = t <= 0 ? 0 : t / length;
      const half = CONE_START_HALF_WIDTH + (endHalf - CONE_START_HALF_WIDTH) * frac;
      if (s > half + c) continue;
      if (best >= 0 && t >= bestT) continue; // ties go to the lower slot
      best = i;
      bestT = t;
    }
    if (best < 0) break;
    picked[best] = 1;
    damageEnemy(run, best, damage, 1, index);
  }
}
