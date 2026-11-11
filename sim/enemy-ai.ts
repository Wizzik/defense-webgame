import { armorReduction, damageCastle, damageHero, rollDamage } from "./combat";
import { TICK_SECONDS, TICKS_PER_SECOND } from "./constants";
import { Action, Role } from "./enemies";
import { Behavior, steer, steerHold, steerX, steerY } from "./enemy-steer";
import type { Run } from "./run";

const MAX_NEIGHBOURS = 64;
const neighbours = new Int32Array(MAX_NEIGHBOURS);

/**
 * Moves, targets and attacks every living enemy in slot order. The walking direction of a type comes
 * from `steer` (flankers come from the side, skirmishers back off, supports follow an ally). Separation looks at the
 * neighbours within twice the collision radius; if more than MAX_NEIGHBOURS (64) are
 * in range, the rest are ignored, which only matters in an extreme pile-up.
 */
export function updateEnemies(run: Run): void {
  const { enemies: e, hero, castle, grid, data } = run;
  const { rules, enemies: defs, constants } = data;
  const arenaX = rules.arena.width / 2;
  const arenaY = rules.arena.height / 2;

  const knockTotal = Math.max(1, Math.round(rules.enemies.knockback.seconds * TICKS_PER_SECOND));

  grid.clear();
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 1) grid.insert(i, e.x[i], e.y[i]);
  }

  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0) continue;
    const def = defs[e.type[i]];
    const x = e.x[i];
    const y = e.y[i];
    if (e.attackCooldown[i] > 0) e.attackCooldown[i]--;

    // Slow lowers walking speed only (not knockback) and runs down even while stunned.
    let walk = def.moveSpeed;
    if (e.slowTicks[i] > 0) {
      walk *= 1 - e.slowFactor[i];
      e.slowTicks[i]--;
    }

    let vx = 0;
    let vy = 0;
    let tx = castle.x;
    let ty = castle.y;

    if (e.stunTicks[i] > 0) {
      e.stunTicks[i]--;
      e.action[i] = Action.Stunned;
    } else {
      const hx = hero.x - x;
      const hy = hero.y - y;
      const heroDist = Math.sqrt(hx * hx + hy * hy);
      if (e.role[i] === Role.Sieger) {
        if (heroDist < rules.enemies.siegerAggroRange) e.aggro[i] = 1;
        else if (heroDist > rules.enemies.leashRange) e.aggro[i] = 0;
      }
      const targetsHero = e.role[i] === Role.Hunter || e.aggro[i] === 1 || run.enemyBehavior[e.type[i]] === Behavior.Flank;
      let targetRadius: number;
      if (targetsHero) {
        tx = hero.x;
        ty = hero.y;
        targetRadius = hero.stats.collision;
      } else {
        targetRadius = castle.radius;
      }
      const dx = tx - x;
      const dy = ty - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const reach = def.collision + targetRadius + def.attack.range;
      const ux = dist > 1e-6 ? dx / dist : 0;
      const uy = dist > 1e-6 ? dy / dist : 0;
      steer(run, i, targetsHero, ux, uy, dist, reach);
      if (dist <= reach && !steerHold) {
        e.action[i] = Action.Attack;
        if (e.attackCooldown[i] <= 0) {
          const raw = rollDamage(run.rng, def.attack.damageMin, def.attack.damageMax) * e.damageScale[i];
          if (targetsHero) {
            const k = 1 - armorReduction(hero.stats.armor, constants.defenseArmor);
            damageHero(run, raw * k, i);
          } else {
            damageCastle(run, raw, i);
          }
          e.attackCooldown[i] = Math.round(def.attack.cooldown * TICKS_PER_SECOND);
          e.lastAttackTick[i] = run.tick;
        }
        e.facingX[i] = ux;
        e.facingY[i] = uy;
      } else {
        e.action[i] = Action.Move;
        vx = steerX * walk;
        vy = steerY * walk;
      }
    }

    // Separation: push away from neighbours, linearly from 0 at 2 * collision to moveSpeed on overlap.
    const sepRadius = 2 * def.collision;
    const found = grid.query(x, y, sepRadius, neighbours);
    for (let k = 0; k < found; k++) {
      const j = neighbours[k];
      if (j === i) continue;
      const ox = x - e.x[j];
      const oy = y - e.y[j];
      const d = Math.sqrt(ox * ox + oy * oy);
      if (d < 1e-6) {
        vx += i < j ? def.moveSpeed : -def.moveSpeed;
        continue;
      }
      const push = (def.moveSpeed * (sepRadius - d)) / (sepRadius * d);
      vx += ox * push;
      vy += oy * push;
    }

    let nx = x + vx * TICK_SECONDS;
    let ny = y + vy * TICK_SECONDS;

    // Knockback fades linearly over its ticks; it moves the enemy but never turns it.
    if (e.knockTicks[i] > 0) {
      const fade = e.knockTicks[i] / knockTotal;
      nx += e.knockVX[i] * fade * TICK_SECONDS;
      ny += e.knockVY[i] * fade * TICK_SECONDS;
      e.knockTicks[i]--;
    }

    // Keep out of the hero and the castle.
    nx = pushOut(nx, ny, hero.x, hero.y, hero.stats.collision + def.collision);
    ny = pushOutY;
    nx = pushOut(nx, ny, castle.x, castle.y, castle.radius + def.collision);
    ny = pushOutY;
    nx = Math.max(-arenaX + def.collision, Math.min(arenaX - def.collision, nx));
    ny = Math.max(-arenaY + def.collision, Math.min(arenaY - def.collision, ny));
    e.x[i] = nx;
    e.y[i] = ny;

    // Only a moving enemy faces its velocity; attacking and stunned ones keep facing their target.
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (e.action[i] === Action.Move && speed > 1e-6) {
      e.facingX[i] = vx / speed;
      e.facingY[i] = vy / speed;
    }
  }
}

/** Second result of pushOut (avoids allocating a pair). */
let pushOutY = 0;

/** Moves (x, y) out of the circle at (cx, cy); returns x and leaves y in `pushOutY`. */
function pushOut(x: number, y: number, cx: number, cy: number, radius: number): number {
  const dx = x - cx;
  const dy = y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) {
    pushOutY = y;
    return x;
  }
  const d = Math.sqrt(d2);
  if (d < 1e-6) {
    pushOutY = cy;
    return cx + radius;
  }
  pushOutY = cy + (dy / d) * radius;
  return cx + (dx / d) * radius;
}
