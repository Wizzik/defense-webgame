import { TICKS_PER_SECOND, TICK_SECONDS } from "./constants";
import { Role } from "./enemies";
import type { Rules } from "../data/schema";
import type { Run } from "./run";

/** Enemy hp and damage multiplier: min(cap, 1 + t / seconds), t in seconds. */
export function timeScale(rules: Rules, tick: number): number {
  const { seconds, cap } = rules.run.timeScaling;
  return Math.min(cap, 1 + tick / TICKS_PER_SECOND / seconds);
}

/** Spawns enemies at the gates at the rate of the current phase. */
export function spawnEnemies(run: Run): void {
  const { rules, enemies: defs } = run.data;
  const phase = rules.phases[run.phaseIndex];
  const store = run.enemies;
  run.spawnCredit += phase.spawnPerSecond * TICK_SECONDS;
  const type = defs.findIndex((e) => e.id === phase.enemy);
  if (type < 0) throw new Error(`spawnEnemies: unknown enemy "${phase.enemy}"`);
  const def = defs[type];
  const scale = timeScale(rules, run.tick);
  const gates = rules.arena.gates;
  const radius = rules.arena.gateRadius;
  while (run.spawnCredit >= 1 && store.aliveCount < store.capacity) {
    run.spawnCredit -= 1;
    const gate = run.nextGate;
    run.nextGate = (gate + 1) % gates.length;
    const role = run.rng.next() < phase.hunterShare ? Role.Hunter : Role.Sieger;
    const x = gates[gate].x + (run.rng.next() * 2 - 1) * radius;
    const y = gates[gate].y + (run.rng.next() * 2 - 1) * radius;
    store.spawn(type, role, gate, x, y, def.hp * scale, scale, run.tick);
  }
  // At the cap, keep at most one spawn banked so freed slots do not get a burst.
  if (store.aliveCount >= store.capacity) run.spawnCredit = Math.min(run.spawnCredit, 1);
}
