import { TICKS_PER_SECOND } from "./constants";
import { Role } from "./enemies";
import { EventKind } from "./events";
import type { Rules } from "../data/schema";
import type { Run } from "./run";
import { dirX, dirY, randomDirection, rotatedDirection } from "./spawn-direction";
import { pickType } from "./spawn-tables";

/** A pack of this size fits `arena.spawn.spread`; a bigger one spreads over a wider square. */
const PACK_AT_SPREAD = 8;

/** Enemy hp and damage multiplier: min(cap, 1 + t / seconds), t in seconds. */
export function timeScale(rules: Rules, tick: number): number {
  const { seconds, cap } = rules.run.timeScaling;
  return Math.min(cap, 1 + tick / TICKS_PER_SECOND / seconds);
}

/**
 * Sends the packs of an interval when its time comes. Each pack has its own direction on the circle
 * `arena.spawn.radius` around the castle (the packs of one interval are spread evenly around it), its
 * own size and its own role; its members come all at once in a square around the pack's centre, clamped
 * to the arena. The elites of a phase come with the first pack of its first interval, ahead of the
 * others. At the cap a pack fills only the free slots and the rest is dropped.
 * The order of the rng draws is part of the determinism.
 */
export function spawnEnemies(run: Run): void {
  if (run.tick < run.nextPackTick) return;
  const { rules, enemies: defs } = run.data;
  const phaseIndex = run.phaseIndex;
  const phase = rules.phases[phaseIndex];
  const table = run.phaseTables[phaseIndex];
  const store = run.enemies;
  const { rng } = run;
  const { arena } = rules;
  run.nextPackTick = run.tick + Math.max(1, Math.round(phase.pack.everySeconds * TICKS_PER_SECOND));
  const elites = run.elitePhase !== phaseIndex ? phase.elites : 0;
  run.elitePhase = phaseIndex;
  const scale = timeScale(rules, run.tick);
  const edgeX = arena.width / 2;
  const edgeY = arena.height / 2;
  randomDirection(rng);
  const baseX = dirX;
  const baseY = dirY;
  for (let p = 0; p < phase.packs; p++) {
    rotatedDirection(baseX, baseY, p, phase.packs);
    const size = phase.pack.min + Math.floor(rng.next() * (phase.pack.max - phase.pack.min + 1));
    const role = rng.next() < phase.hunterShare ? Role.Hunter : Role.Sieger;
    const cx = arena.castle.x + dirX * arena.spawn.radius;
    const cy = arena.castle.y + dirY * arena.spawn.radius;
    const packElites = p === 0 ? elites : 0;
    const n = size + packElites;
    const half = arena.spawn.spread * Math.max(1, Math.sqrt(n / PACK_AT_SPREAD));
    let spawned = 0;
    for (let k = 0; k < n; k++) {
      if (store.aliveCount >= store.capacity) break;
      const type = k < packElites ? run.eliteType : pickType(table, rng.next());
      const collision = defs[type].collision;
      const x = clamp(cx + (rng.next() * 2 - 1) * half, edgeX - collision);
      const y = clamp(cy + (rng.next() * 2 - 1) * half, edgeY - collision);
      store.spawn(type, role, x, y, defs[type].hp * scale, scale, run.tick);
      run.stats.spawned++;
      spawned++;
    }
    if (spawned > 0) run.events.push(EventKind.PackSpawn, role, spawned, cx, cy, 0, 0);
  }
}

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}
