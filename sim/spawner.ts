import { TICKS_PER_SECOND } from "./constants";
import { Role } from "./enemies";
import type { Rules } from "../data/schema";
import type { Run } from "./run";
import { pickType } from "./spawn-tables";

/** A pack of this size fits the gate radius; a bigger one spreads over a wider square. */
const PACK_AT_GATE_RADIUS = 8;

/** Enemy hp and damage multiplier: min(cap, 1 + t / seconds), t in seconds. */
export function timeScale(rules: Rules, tick: number): number {
  const { seconds, cap } = rules.run.timeScaling;
  return Math.min(cap, 1 + tick / TICKS_PER_SECOND / seconds);
}

/**
 * Sends a pack when its time comes: one gate (gates alternate), one role, types drawn from the
 * phase's mix, all at once in a square around the gate. The elites of a phase come with its first
 * pack, ahead of the others. At the cap the pack fills only the free slots and the rest is dropped.
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
  run.nextPackTick = run.tick + Math.max(1, Math.round(phase.pack.everySeconds * TICKS_PER_SECOND));
  const size = phase.pack.min + Math.floor(rng.next() * (phase.pack.max - phase.pack.min + 1));
  const elites = run.elitePhase !== phaseIndex ? phase.elites : 0;
  run.elitePhase = phaseIndex;
  const role = rng.next() < phase.hunterShare ? Role.Hunter : Role.Sieger;
  const gates = rules.arena.gates;
  const gate = run.nextGate;
  run.nextGate = (gate + 1) % gates.length;
  const half = rules.arena.gateRadius * Math.max(1, Math.sqrt((size + elites) / PACK_AT_GATE_RADIUS));
  const scale = timeScale(rules, run.tick);
  for (let k = 0; k < elites + size; k++) {
    if (store.aliveCount >= store.capacity) break;
    const type = k < elites ? run.eliteType : pickType(table, rng.next());
    const x = gates[gate].x + (rng.next() * 2 - 1) * half;
    const y = gates[gate].y + (rng.next() * 2 - 1) * half;
    store.spawn(type, role, gate, x, y, defs[type].hp * scale, scale, run.tick);
    run.stats.spawned++;
  }
}
