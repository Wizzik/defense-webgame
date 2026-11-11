// Tests only: a quiet run (no spawns, no knockback) for ability tests, with helpers for enemies and events.
import { debugSetAbilityLevel } from "../abilities/slots";
import type { GameData } from "../../data/schema";
import { Role } from "../enemies";
import { createRun } from "../run";
import { gameData } from "./game-data";
import { silenceSpawns } from "./silence";

export function quietData(): GameData {
  const data = gameData();
  data.rules.arena = {
    width: 6000, height: 5000, castle: { x: 0, y: -2400 }, heroStart: { x: 0, y: 0 },
    gates: [{ x: -1800, y: 2200 }, { x: 1800, y: 2200 }], gateRadius: 150,
  };
  silenceSpawns(data);
  data.rules.enemies.knockback = { attack: 0, ability: 0, seconds: 0.15 };
  data.enemies[0].collision = 31;
  return data;
}

/** A run of `hero` with exactly the given slot levels (slots not listed are set to 0). */
export function abilityRun(hero: string, levels: Record<number, number>, data: GameData = quietData()) {
  const run = createRun(data, { seed: 5, hero, durationSeconds: 100000 });
  for (let i = 0; i < run.abilities.length; i++) debugSetAbilityLevel(run, i, levels[i] ?? 0);
  run.hero.hp = run.hero.stats.maxHp;
  return run;
}

export type AbilityRun = ReturnType<typeof abilityRun>;

/** A stunned enemy of type 0 at hero + (dx, dy), with a lot of hp. */
export function addEnemy(run: AbilityRun, dx: number, dy: number, hp = 1e6): number {
  const i = run.enemies.spawn(0, Role.Hunter, 0, run.hero.x + dx, run.hero.y + dy, hp, 1, 0);
  run.enemies.stunTicks[i] = 1e6;
  return i;
}

/** Indices of the events of `kind` in the current step. */
export function eventsOf(run: AbilityRun, kind: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < run.events.count; k++) if (run.events.kind[k] === kind) out.push(k);
  return out;
}
