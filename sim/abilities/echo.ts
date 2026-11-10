import { TICKS_PER_SECOND } from "../constants";
import { EventKind } from "../events";
import type { Run } from "../run";
import { hitEnemiesAround } from "./hits";

/**
 * Called by startCast after every cast. Each learned on_cast slot other than `index` sends a stunning shockwave
 * around the hero and a Cast event of its own. It touches no cooldown and does not call startCast, so it cannot chain.
 */
export function onHeroCast(run: Run, index: number): void {
  const hero = run.hero;
  for (let j = 0; j < run.abilities.length; j++) {
    const slot = run.abilities[j];
    const def = slot.def;
    if (j === index || slot.level < 1) continue;
    if (def.kind !== "on_cast") continue;
    const L = slot.level - 1;
    const p = def.params;
    const radius = p.radius[L];
    run.events.push(EventKind.Cast, j, radius, hero.x, hero.y, 0, 0);
    hitEnemiesAround(run, j, hero.x, hero.y, radius, p.damage[L] * hero.stats.spellPower,
      Math.round(p.stunSeconds[L] * TICKS_PER_SECOND), 0, 0);
  }
}
