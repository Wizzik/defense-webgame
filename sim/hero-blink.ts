import { hitEnemiesAround } from "./abilities/hits";
import { TICKS_PER_SECOND } from "./constants";
import { EventKind } from "./events";
import type { TickInput } from "./input";
import { isChoosing } from "./player";
import type { Run } from "./run";
import { nearestFree, pushX, pushY } from "./world-map/geometry";

/**
 * The blink (key F, Petr 2026-11-26), every hero's own from `rules.hero.blink.fromLevel`: the hero is put at the aimed
 * point in the same step (input aimX, aimY from the hero; missing: `aheadDistance` straight ahead), at any distance
 * (Petr 2026-11-27), kept in the arena and moved to the nearest free spot off the obstacles, and a burst of `damage` x spell power within `radius` around the
 * landing spot hurts and stuns the enemies there. It ends a dash and works through roots (a jump, not a walk).
 */
export function blink(run: Run, input: TickInput): void {
  const hero = run.hero;
  const rule = run.data.rules.hero.blink;
  if (hero.hp <= 0 || hero.level < rule.fromLevel || hero.blinkCooldown > 0 || isChoosing(run)) return;
  const dx = input.aimX ?? hero.facingX * rule.aheadDistance;
  const dy = input.aimY ?? hero.facingY * rule.aheadDistance;
  const halfX = run.data.rules.arena.width / 2 - hero.stats.collision;
  const halfY = run.data.rules.arena.height / 2 - hero.stats.collision;
  const fromX = hero.x;
  const fromY = hero.y;
  const tx = Math.max(-halfX, Math.min(halfX, fromX + dx));
  const ty = Math.max(-halfY, Math.min(halfY, fromY + dy));
  nearestFree(run.map, tx, ty, hero.stats.collision);
  hero.x = pushX;
  hero.y = pushY;
  hero.dashTicks = 0;
  hero.rootTicks = 0;
  const reach = Math.sqrt(dx * dx + dy * dy);
  if (reach > 1e-6) {
    hero.facingX = dx / reach;
    hero.facingY = dy / reach;
  }
  hero.blinkCooldown = Math.round(rule.cooldownSeconds * TICKS_PER_SECOND);
  const stun = Math.round(rule.stunSeconds * TICKS_PER_SECOND);
  const hits = hitEnemiesAround(run, -1, hero.x, hero.y, rule.radius, rule.damage * hero.stats.spellPower, stun, 0, 0);
  run.events.push(EventKind.Blink, hits, rule.radius, fromX, fromY, hero.x, hero.y);
}
