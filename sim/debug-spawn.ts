import { enemyDamageScale, enemyHp } from "./difficulty";
import type { FactionId } from "../data/schema";
import { Role } from "./enemies";
import type { Run } from "./run";
import { timeScale } from "./spawner";

/** Distance between two enemies of the row, and of the row from the hero (world units). */
const SPACING = 300;
const NORTH = 600;

/** A type debugSpawnEach sends for `faction`: of that faction, no boss, and not one that only rises (xp 0). */
function sent(run: Run, type: number, faction: FactionId): boolean {
  const def = run.data.enemies[type];
  return run.isBoss[type] === 0 && def.faction === faction && def.xp > 0;
}

/**
 * Debug: one hunter of every enemy type of a faction (the current one by default) in a row north of the hero.
 * A full store skips the rest. Bosses are left out (they come by the timeline; `?phase` starts near one), and so
 * are the risen, which only a gravebinder raises.
 */
export function debugSpawnEach(run: Run, faction: FactionId = run.data.rules.factions[run.factionIndex]!.id): void {
  const { enemies: store, hero } = run;
  const defs = run.data.enemies;
  const scale = timeScale(run.data.rules, run.tick);
  let common = 0;
  for (let type = 0; type < defs.length; type++) if (sent(run, type, faction)) common++;
  let k = 0;
  for (let type = 0; type < defs.length; type++) {
    if (!sent(run, type, faction)) continue;
    if (store.aliveCount >= store.capacity) return;
    const x = hero.x + (k++ - (common - 1) / 2) * SPACING;
    store.spawn(type, Role.Hunter, x, hero.y + NORTH, enemyHp(run, type, scale), enemyDamageScale(run, scale), run.tick);
    run.stats.spawned++;
  }
}
