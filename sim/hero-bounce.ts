import { armorReduction, damageEnemy } from "./combat";
import { EventKind } from "./events";
import type { Run } from "./run";

/** The most leaps of one bouncing shot; the schema caps `baseAttack.bounce.count` at it. */
export const MAX_ATTACK_BOUNCES = 8;

/** Enemies the current shot struck (scratch, allocated once). */
const struck = new Int32Array(MAX_ATTACK_BOUNCES + 1);

/** Radius of the small flash a leap shows (the value of its Blast event). */
export const BOUNCE_FLASH = 40;

/**
 * A bouncing base attack (`baseAttack.bounce`, the map's `mbounce` weapon): after the shot hit `main` (at x, y) for
 * `raw` before armor, it leaps up to `count` times to the nearest enemy within `range` of the last one that it has
 * not struck yet, each leap losing `falloff` of the damage before it (raw x (1 - falloff)^k). Every leap is a base
 * attack hit (meter: attack) after its target's armor and sends a Blast (a = -1). Allocates nothing.
 */
export function bounceShot(run: Run, main: number, x: number, y: number, raw: number): void {
  const bounce = run.hero.def.baseAttack.bounce;
  if (bounce === undefined) return;
  const { enemies: e, data } = run;
  const jumps = bounce.count < MAX_ATTACK_BOUNCES ? bounce.count : MAX_ATTACK_BOUNCES;
  const rangeSq = bounce.range * bounce.range;
  const keep = 1 - bounce.falloff;
  struck[0] = main;
  let fromX = x;
  let fromY = y;
  let damage = raw;
  for (let jump = 1; jump <= jumps; jump++) {
    let best = -1;
    let bestSq = rangeSq;
    for (let i = 0; i < e.capacity; i++) {
      if (e.alive[i] === 0) continue;
      let seen = false;
      for (let h = 0; h < jump; h++) {
        if (struck[h] === i) {
          seen = true;
          break;
        }
      }
      if (seen) continue;
      const dx = e.x[i]! - fromX;
      const dy = e.y[i]! - fromY;
      const sq = dx * dx + dy * dy;
      if (sq <= bestSq) {
        bestSq = sq;
        best = i;
      }
    }
    if (best < 0) return;
    struck[jump] = best;
    fromX = e.x[best]!;
    fromY = e.y[best]!;
    damage *= keep;
    run.events.push(EventKind.Blast, -1, BOUNCE_FLASH, fromX, fromY, 0, 0);
    const reduction = armorReduction(data.enemies[e.type[best]!]!.armor, data.constants.defenseArmor);
    damageEnemy(run, best, damage * (1 - reduction), 0);
  }
}
