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
 * others. At the cap a pack fills only the free slots and the rest is dropped. In the finale the packs of the
 * last phase come at `finale.packScale` of their size.
 * The order of the rng draws is part of the determinism.
 */
export function spawnEnemies(run: Run): void {
  if (run.tick < run.nextPackTick) return;
  const { rules } = run.data;
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
  const finale = run.inFinale;
  randomDirection(rng);
  const baseX = dirX;
  const baseY = dirY;
  for (let p = 0; p < phase.packs; p++) {
    rotatedDirection(baseX, baseY, p, phase.packs);
    const rolled = phase.pack.min + Math.floor(rng.next() * (phase.pack.max - phase.pack.min + 1));
    const size = finale ? Math.max(1, Math.round(rolled * rules.run.finale.packScale)) : rolled;
    const role = rng.next() < phase.hunterShare ? Role.Hunter : Role.Sieger;
    const cx = arena.castle.x + dirX * arena.spawn.radius;
    const cy = arena.castle.y + dirY * arena.spawn.radius;
    const packElites = p === 0 ? elites : 0;
    const n = size + packElites;
    const half = packHalf(rules, n);
    let spawned = 0;
    for (let k = 0; k < n; k++) {
      if (store.aliveCount >= store.capacity) break;
      const type = k < packElites ? run.eliteType : pickType(table, rng.next());
      scatterMember(run, type, role, cx, cy, half, scale);
      spawned++;
    }
    if (spawned > 0) run.events.push(EventKind.PackSpawn, role, spawned, cx, cy, 0, 0);
  }
}

/** Half the side of the square a pack of `members` is scattered in. */
export function packHalf(rules: Rules, members: number): number {
  return rules.arena.spawn.spread * Math.max(1, Math.sqrt(members / PACK_AT_SPREAD));
}

/**
 * Spawns one pack member at a random point of the square around (cx, cy), clamped into the arena.
 * Draws two rng values (x, then y). The caller checks that a slot is free.
 */
export function scatterMember(
  run: Run, type: number, role: number, cx: number, cy: number, half: number, scale: number,
): number {
  const { arena } = run.data.rules;
  const def = run.data.enemies[type];
  const x = clamp(cx + (run.rng.next() * 2 - 1) * half, arena.width / 2 - def.collision);
  const y = clamp(cy + (run.rng.next() * 2 - 1) * half, arena.height / 2 - def.collision);
  run.stats.spawned++;
  return run.enemies.spawn(type, role, x, y, def.hp * scale, scale, run.tick);
}

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}
