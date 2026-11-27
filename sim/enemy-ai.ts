import { armorReduction, damageCastle, damageHero, rollDamage } from "./combat";
import { TICK_SECONDS, TICKS_PER_SECOND } from "./constants";
import { Action, Role } from "./enemies";
import { attackDelayTicks, bloodlustDamageScale, bloodlustSpeedScale, updateBloodlust } from "./enemy-bloodlust";
import { slowHero } from "./hero-snares";
import { updateRaise } from "./enemy-raise";
import { auraDamageScale, auraSpeedScale, updateEnemyAuras } from "./enemy-aura";
import { cancelCharge, Charge, chargeVX, chargeVY, updateCharge } from "./enemy-charge";
import { cancelSlam, updateSlam } from "./enemy-slam";
import { strikeVX, strikeVY, updateStrike } from "./enemy-strike";
import { avoidIslands, Behavior, steer, steerHold, steerX, steerY } from "./enemy-steer";
import { crossesFeature, flowDir, flowX, flowY } from "./world-map/flow";
import { heroFlow } from "./world-map/hero-flow";
import { weatherSpeedScale } from "./weather";
import { groundSpeedScale, pushOut as pushOutOfMap, pushX as mapPushX, pushY as mapPushY } from "./world-map/geometry";
import type { Run } from "./run";
import { enemyTarget } from "./targets";

const MAX_NEIGHBOURS = 64;
const neighbours = new Int32Array(MAX_NEIGHBOURS);

/**
 * Moves, targets and attacks every living enemy in slot order. Each enemy goes for the hero of its target player
 * (sim/targets.ts; `run.current` is that player while the enemy acts, 0 after) and keeps out of every hero. The walking direction of a type comes
 * from `steer` (flankers come from the side, skirmishers back off, supports follow an ally). Separation looks at the
 * neighbours within twice the collision radius; if more than MAX_NEIGHBOURS (64) are
 * in range, the rest are ignored, which only matters in an extreme pile-up.
 */
export function updateEnemies(run: Run): void {
  const { enemies: e, castle, grid, data } = run;
  const { rules, enemies: defs, constants } = data;
  const arenaX = rules.arena.width / 2;
  const arenaY = rules.arena.height / 2;

  const knockTotal = Math.max(1, Math.round(rules.enemies.knockback.seconds * TICKS_PER_SECOND));

  grid.clear();
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 1) grid.insert(i, e.x[i], e.y[i]);
  }

  updateEnemyAuras(run);
  updateBloodlust(run);
  updateRaise(run);

  const weatherScale = weatherSpeedScale(run);
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0) continue;
    const def = defs[e.type[i]];
    const x = e.x[i];
    const y = e.y[i];
    // the hero this enemy goes for (multiplayer migration step 3): run.hero, damageHero and the snares read him
    // -1: every hero is fallen or choosing in co-op (step 5): the enemy goes for the castle
    const target = enemyTarget(run, i);
    const ignored = target < 0;
    run.current = ignored ? 0 : target;
    const hero = run.hero;
    if (e.attackCooldown[i] > 0) e.attackCooldown[i]--;
    if (e.chargeCooldown[i] > 0) e.chargeCooldown[i]--;
    if (e.slamCooldown[i] > 0) e.slamCooldown[i]--;
    // Slow lowers walking speed only (not knockback) and runs down even while stunned.
    let walk = def.moveSpeed * auraSpeedScale(run, i) * bloodlustSpeedScale(run, i);
    if (run.enraged && i === run.finalBossSlot) walk *= rules.run.finale.enrage.moveSpeed;
    walk *= groundSpeedScale(run.map, x, y) * weatherScale;
    if (e.slowTicks[i] > 0) {
      walk *= 1 - e.slowFactor[i];
      e.slowTicks[i]--;
    }

    let vx = 0;
    let vy = 0;
    let tx = castle.x;
    let ty = castle.y;
    let charging = false;
    let leaping = false;

    if (e.stunTicks[i] > 0) {
      e.stunTicks[i]--;
      e.action[i] = Action.Stunned;
      cancelCharge(run, i);
      cancelSlam(run, i);
    } else {
      const hx = hero.x - x;
      const hy = hero.y - y;
      const heroDist = ignored ? Infinity : Math.sqrt(hx * hx + hy * hy);
      if (ignored) cancelCharge(run, i);
      if (e.role[i] === Role.Sieger) {
        if (heroDist < rules.enemies.siegerAggroRange) e.aggro[i] = 1;
        else if (heroDist > rules.enemies.leashRange) e.aggro[i] = 0;
      }
      // a hero who defends near the castle draws every enemy; farther out the siegers turn to the castle
      const cx = hero.x - castle.x;
      const cy = hero.y - castle.y;
      const defendRange = rules.enemies.heroDefendRange;
      const defending = cx * cx + cy * cy <= defendRange * defendRange;
      const targetsHero = !ignored && (defending || e.role[i] === Role.Hunter || e.aggro[i] === 1 ||
        run.enemyHunter[e.type[i]] === 1 || run.enemyBehavior[e.type[i]] === Behavior.Flank);
      // a strike from afar and a slam come before a charge and never start in the middle of one
      const free = e.chargeState[i] === Charge.None;
      const striking = free && updateStrike(run, i, targetsHero, heroDist);
      const slamming = !striking && free && updateSlam(run, i, heroDist);
      if (!striking && !slamming) charging = updateCharge(run, i, targetsHero, heroDist, walk);
      if (striking) {
        // a leap: nobody pushes it aside, like a charge
        leaping = strikeVX !== 0 || strikeVY !== 0;
        e.action[i] = leaping ? Action.Move : Action.Attack;
        vx = strikeVX;
        vy = strikeVY;
      } else if (slamming) {
        e.action[i] = Action.Attack;
      } else if (charging) {
        e.action[i] = Action.Move;
        vx = chargeVX;
        vy = chargeVY;
      } else {
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
        // Behind the wall the flow field leads through a gate (spec 4.6), ahead of a flanker's or skirmisher's angle;
        // a melee blow does not reach over it.
        const walled = crossesFeature(run.map, x, y, tx, ty, def.collision);
        if (dist <= reach && !steerHold && !(walled && def.attack.kind === "melee")) {
          e.action[i] = Action.Attack;
          if (e.attackCooldown[i] <= 0) {
            let raw = rollDamage(run.rng, def.attack.damageMin, def.attack.damageMax) * e.damageScale[i];
            raw *= auraDamageScale(run, i) * bloodlustDamageScale(run, i);
            if (targetsHero) {
              const k = 1 - armorReduction(hero.stats.armor, constants.defenseArmor);
              damageHero(run, raw * k, i);
              if (def.web !== undefined && run.shieldTicks === 0) {
                slowHero(run, def.web.slow, Math.round(def.web.seconds * TICKS_PER_SECOND));
              }
            } else {
              damageCastle(run, raw, i);
            }
            e.attackCooldown[i] = attackDelayTicks(run, i);
            e.lastAttackTick[i] = run.tick;
          }
          e.facingX[i] = ux;
          e.facingY[i] = uy;
        } else {
          e.action[i] = Action.Move;
          if (walled) flowDir(targetsHero ? heroFlow(run) : run.map.toCastle, x, y);
          if (walled && (flowX !== 0 || flowY !== 0)) {
            vx = flowX * walk;
            vy = flowY * walk;
          } else {
            avoidIslands(run, i, def.collision);
            vx = steerX * walk;
            vy = steerY * walk;
          }
        }
      }
    }

    // Separation: push away from neighbours, linearly from 0 at 2 * collision to moveSpeed on overlap.
    // A charging enemy holds its line: nobody pushes it aside.
    const sepRadius = 2 * def.collision;
    const found = charging || leaping ? 0 : grid.query(x, y, sepRadius, neighbours);
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

    // Keep out of every hero and the castle.
    for (let p = 0; p < run.players.length; p++) {
      const other = run.players[p]!.hero;
      nx = pushOut(nx, ny, other.x, other.y, other.stats.collision + def.collision);
      ny = pushOutY;
    }
    nx = pushOut(nx, ny, castle.x, castle.y, castle.radius + def.collision);
    ny = pushOutY;
    // Out of the wall and the islands; a charge or a leap flies over them and is pushed out after it lands.
    if (!charging && !leaping) {
      pushOutOfMap(run.map, nx, ny, def.collision);
      nx = mapPushX;
      ny = mapPushY;
    }
    const insideX = Math.max(-arenaX + def.collision, Math.min(arenaX - def.collision, nx));
    const insideY = Math.max(-arenaY + def.collision, Math.min(arenaY - def.collision, ny));
    // A charge ends at the arena edge.
    if (charging && (insideX !== nx || insideY !== ny)) cancelCharge(run, i);
    nx = insideX;
    ny = insideY;
    e.x[i] = nx;
    e.y[i] = ny;

    // Only a moving enemy faces its velocity; attacking and stunned ones keep facing their target.
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (e.action[i] === Action.Move && speed > 1e-6) {
      e.facingX[i] = vx / speed;
      e.facingY[i] = vy / speed;
    }
  }
  run.current = 0;
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
