import type { GameData } from "../data/schema";
import { TICKS_PER_SECOND } from "./constants";
import { Role } from "./enemies";
import { EventKind } from "./events";
import type { Run } from "./run";
import { dirX, dirY, randomDirection } from "./spawn-direction";
import { enemyType } from "./spawn-tables";
import { packHalf, scatterMember, timeScale } from "./spawner";

/** One entry of `rules.events`, prepared so that a step does not allocate. */
export interface TimedEvent {
  tick: number;
  /** Type index of the boss; -1 for a rush. */
  boss: number;
  /** A rush: type indices and how many of each, in the order of the design. */
  types: Int32Array;
  counts: Int32Array;
  members: number;
}

/** Built once, when the run is created. */
export function buildTimeline(data: GameData): TimedEvent[] {
  return data.rules.events.map((event, i) => {
    const tick = Math.round(event.atSeconds * TICKS_PER_SECOND);
    if (event.kind === "boss") {
      const boss = enemyType(data, event.enemy, `event ${i}`);
      return { tick, boss, types: new Int32Array(0), counts: new Int32Array(0), members: 0 };
    }
    const units = Object.entries(event.units);
    const counts = Int32Array.from(units, ([, count]) => count);
    return {
      tick,
      boss: -1,
      types: Int32Array.from(units, ([id]) => enemyType(data, id, `event ${i}`)),
      counts,
      members: counts.reduce((sum, n) => sum + n, 0),
    };
  });
}

/**
 * Fires the timed events of the run (`rules.events`): elite rushes and minibosses. A rush is announced
 * `rushWarningSeconds` ahead with the side it will come from; only the next rush on the list is announced,
 * and a run that starts after the warning step draws the side when the rush comes. Events of one step fire
 * in the order of the list. The order of the rng draws is part of the determinism.
 */
export function updateTimeline(run: Run): void {
  const timeline = run.timeline;
  if (run.nextEvent >= timeline.length) return;
  const { rules } = run.data;
  if (!run.rushWarned) {
    for (let i = run.nextEvent; i < timeline.length; i++) {
      const event = timeline[i];
      if (event.boss >= 0) continue;
      const warnTicks = Math.round(rules.run.rushWarningSeconds * TICKS_PER_SECOND);
      if (warnTicks > 0 && run.tick === event.tick - warnTicks) {
        randomDirection(run.rng);
        run.rushWarned = true;
        run.rushDirX = dirX;
        run.rushDirY = dirY;
        run.events.push(
          EventKind.RushWarning, 0, rules.run.rushWarningSeconds,
          rules.arena.castle.x + dirX * rules.arena.spawn.radius,
          rules.arena.castle.y + dirY * rules.arena.spawn.radius, 0, 0,
        );
      }
      break;
    }
  }
  while (run.nextEvent < timeline.length && run.tick >= timeline[run.nextEvent].tick) {
    const event = timeline[run.nextEvent++];
    if (event.boss >= 0) {
      spawnBoss(run, event.boss, Role.Sieger);
    } else {
      spawnRush(run, event);
    }
  }
}

function spawnRush(run: Run, event: TimedEvent): void {
  const { rules } = run.data;
  if (!run.rushWarned) {
    randomDirection(run.rng);
    run.rushDirX = dirX;
    run.rushDirY = dirY;
  }
  run.rushWarned = false;
  const cx = rules.arena.castle.x + run.rushDirX * rules.arena.spawn.radius;
  const cy = rules.arena.castle.y + run.rushDirY * rules.arena.spawn.radius;
  const half = packHalf(rules, event.members);
  const scale = timeScale(rules, run.tick);
  const store = run.enemies;
  let spawned = 0;
  for (let t = 0; t < event.types.length; t++) {
    for (let k = 0; k < event.counts[t]; k++) {
      if (store.aliveCount >= store.capacity) break;
      scatterMember(run, event.types[t], Role.Sieger, cx, cy, half, scale);
      spawned++;
    }
  }
  if (spawned > 0) run.events.push(EventKind.PackSpawn, Role.Sieger, spawned, cx, cy, 0, 0);
}

/**
 * A boss comes alone at a random point of the spawn ring. It always gets a slot: in a full store the oldest
 * common enemy leaves without a death event and without XP. Returns the slot (-1 only when every slot holds a boss).
 */
export function spawnBoss(run: Run, type: number, role: number): number {
  const { rules } = run.data;
  const store = run.enemies;
  const def = run.data.enemies[type];
  randomDirection(run.rng);
  const limitX = rules.arena.width / 2 - def.collision;
  const limitY = rules.arena.height / 2 - def.collision;
  const x = Math.max(-limitX, Math.min(limitX, rules.arena.castle.x + dirX * rules.arena.spawn.radius));
  const y = Math.max(-limitY, Math.min(limitY, rules.arena.castle.y + dirY * rules.arena.spawn.radius));
  if (store.aliveCount >= store.capacity) {
    const oldest = store.oldestWhere(run.isBoss);
    if (oldest < 0) return -1;
    store.kill(oldest);
  }
  const scale = timeScale(rules, run.tick);
  const slot = store.spawn(type, role, x, y, def.hp * scale, scale, run.tick);
  if (def.slam) store.slamCooldown[slot] = Math.round(def.slam.cooldownSeconds[0] * TICKS_PER_SECOND);
  run.stats.spawned++;
  run.bossCount++;
  run.events.push(EventKind.BossSpawn, slot, type, x, y, 0, 0);
  return slot;
}
