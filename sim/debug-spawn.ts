import { Role } from "./enemies";
import type { Run } from "./run";
import { timeScale } from "./spawner";

/** Distance between two enemies of the row, and of the row from the hero (world units). */
const SPACING = 300;
const NORTH = 600;

/** Debug: one hunter of every enemy type in a row north of the hero. A full store skips the rest. */
export function debugSpawnEach(run: Run): void {
  const { enemies: store, hero } = run;
  const defs = run.data.enemies;
  const scale = timeScale(run.data.rules, run.tick);
  for (let type = 0; type < defs.length; type++) {
    if (store.aliveCount >= store.capacity) return;
    const x = hero.x + (type - (defs.length - 1) / 2) * SPACING;
    store.spawn(type, Role.Hunter, x, hero.y + NORTH, defs[type].hp * scale, scale, run.tick);
    run.stats.spawned++;
  }
}
