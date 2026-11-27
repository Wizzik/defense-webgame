import { armorReduction, damageEnemy } from "./combat";
import type { Run } from "./run";

/**
 * The splash of a base-attack blow (`baseAttack.splash`, the Redcleaver's wide axes): every other living enemy whose
 * body is within `radius` of the target's centre takes `share` of the blow's raw damage, after its own armor.
 * Walks the store in slot order, allocates nothing.
 */
export function splashBlow(run: Run, main: number, x: number, y: number, raw: number): void {
  const splash = run.hero.def.baseAttack.splash;
  if (splash === undefined) return;
  const { enemies: e, data } = run;
  const armorUnit = data.constants.defenseArmor;
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0 || i === main) continue;
    const def = data.enemies[e.type[i]];
    const reach = splash.radius + def.collision;
    const dx = e.x[i] - x;
    const dy = e.y[i] - y;
    if (dx * dx + dy * dy > reach * reach) continue;
    damageEnemy(run, i, raw * splash.share * (1 - armorReduction(def.armor, armorUnit)), 0);
  }
}
