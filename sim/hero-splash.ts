import { onHitCleave } from "./abilities/on-hit";
import { armorReduction, damageEnemy } from "./combat";
import type { Run } from "./run";

/**
 * The splash of a base-attack blow: the hero's own (`baseAttack.splash`, the Redcleaver's wide axes) and the cleave
 * of a learned on_hit spell (`splashRadius`, `splashPercent`). Every other living enemy whose body is within a radius
 * of the target's centre takes that share of the blow's raw damage, after its own armor; inside both it takes both.
 * Walks the store in slot order, allocates nothing.
 */
export function splashBlow(run: Run, main: number, x: number, y: number, raw: number): void {
  const splash = run.hero.def.baseAttack.splash;
  const baseRadius = splash?.radius ?? 0;
  const baseShare = splash?.share ?? 0;
  const cleave = onHitCleave(run);
  const cleaveRadius = cleave.share > 0 ? cleave.radius : 0;
  const cleaveShare = cleave.share;
  if (baseRadius <= 0 && cleaveRadius <= 0) return;
  const { enemies: e, data } = run;
  const armorUnit = data.constants.defenseArmor;
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0 || i === main) continue;
    const def = data.enemies[e.type[i]];
    const dx = e.x[i] - x;
    const dy = e.y[i] - y;
    const sq = dx * dx + dy * dy;
    let share = 0;
    const baseReach = baseRadius + def.collision;
    if (baseRadius > 0 && sq <= baseReach * baseReach) share += baseShare;
    const cleaveReach = cleaveRadius + def.collision;
    if (cleaveRadius > 0 && sq <= cleaveReach * cleaveReach) share += cleaveShare;
    if (share > 0) damageEnemy(run, i, raw * share * (1 - armorReduction(def.armor, armorUnit)), 0);
  }
}
