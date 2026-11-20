import { describe, expect, it } from "vitest";
import { damageEnemy } from "./combat";
import { TICKS_PER_SECOND } from "./constants";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { factionIndexOfPhase } from "./factions";
import { NO_INPUT } from "./input";
import { createRun, type Run } from "./run";
import { spawnEnemies } from "./spawner";
import { updateTimeline } from "./timeline";
import { gameData } from "./testing/game-data";

const typeOf = (run: Run, id: string) => run.data.enemies.findIndex((e) => e.id === id);

function countOf(run: Run, type: number): number {
  let n = 0;
  for (let i = 0; i < run.enemies.capacity; i++) if (run.enemies.alive[i] === 1 && run.enemies.type[i] === type) n++;
  return n;
}

describe("enemy factions", () => {
  it("phases 1-5 are human, 6-10 orc, 11-15 undead, 16-20 elf, the finale elf", () => {
    const { rules } = gameData();
    for (let p = 0; p <= 4; p++) expect(factionIndexOfPhase(rules, p), `phase index ${p}`).toBe(0);
    for (let p = 5; p <= 9; p++) expect(factionIndexOfPhase(rules, p), `phase index ${p}`).toBe(1);
    for (let p = 10; p <= 14; p++) expect(factionIndexOfPhase(rules, p), `phase index ${p}`).toBe(2);
    for (let p = 15; p <= 19; p++) expect(factionIndexOfPhase(rules, p), `phase index ${p}`).toBe(3);
    expect(factionIndexOfPhase(rules, 20)).toBe(3);
    expect(rules.factions.map((f) => f.id)).toEqual(["human", "orc", "undead", "elf"]);
  });

  it("a run that starts in phase 11 sends undead elites, not captains", () => {
    const run = createRun(gameData(), { seed: 3, startPhase: 11 });
    run.nextPackTick = run.tick;
    spawnEnemies(run);
    expect(countOf(run, typeOf(run, "bone-tyrant"))).toBe(run.data.rules.phases[10].elites);
    expect(countOf(run, typeOf(run, "captain"))).toBe(0);
  });

  it("rushes take the elite and the heavy of the faction of their phase", () => {
    const run = createRun(gameData(), { seed: 5, durationSeconds: 100000 });
    run.tick = 180 * TICKS_PER_SECOND;
    updateTimeline(run);
    expect(countOf(run, typeOf(run, "captain"))).toBe(2);
    expect(countOf(run, typeOf(run, "lancer"))).toBe(3);

    const late = createRun(gameData(), { seed: 5, durationSeconds: 100000 });
    while (late.nextEvent < late.timeline.length && late.timeline[late.nextEvent].tick < 540 * TICKS_PER_SECOND) late.nextEvent++;
    late.tick = 540 * TICKS_PER_SECOND;
    updateTimeline(late);
    expect(countOf(late, typeOf(late, "bone-tyrant"))).toBe(5);
    expect(countOf(late, typeOf(late, "rotgut"))).toBe(8);
  });

  it("the faction event comes exactly once, in the step that enters phase 6", () => {
    const run = createRun(gameData(), { seed: 2, startPhase: 5 });
    run.shieldTicks = 1_000_000;
    const seen: { tick: number; a: number; value: number }[] = [];
    while (run.tick < 260 * TICKS_PER_SECOND) {
      const tick = run.tick;
      run.step(run.state === "levelUp" ? { ...NO_INPUT, card: 0 } : run.state === "chest" ? { ...NO_INPUT, card: 0 } : NO_INPUT);
      for (let k = 0; k < run.events.count; k++) {
        if (run.events.kind[k] === EventKind.Faction) seen.push({ tick, a: run.events.a[k]!, value: run.events.value[k]! });
      }
    }
    expect(seen).toEqual([{ tick: 250 * TICKS_PER_SECOND, a: 1, value: 6 }]);
    expect(run.factionIndex).toBe(1);
  });

  it("a run that starts after phase 5 announces its faction in its first step", () => {
    const run = createRun(gameData(), { seed: 2, startPhase: 16 });
    run.step(NO_INPUT);
    const kinds = Array.from(run.events.kind.subarray(0, run.events.count));
    const at = kinds.indexOf(EventKind.Faction);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(run.events.a[at]).toBe(3);
    expect(run.events.value[at]).toBe(16);
  });

  it("a type with knockbackScale 0 is not pushed by a hit", () => {
    const data = gameData();
    data.enemies[0].knockbackScale = 0;
    const run = createRun(data, { seed: 1, durationSeconds: 100000 });
    const slot = run.enemies.spawn(0, Role.Sieger, run.hero.x + 100, run.hero.y, 1e6, 1, 0);
    damageEnemy(run, slot, 1, 0);
    expect(run.enemies.knockVX[slot]).toBe(0);
    expect(run.enemies.knockVY[slot]).toBe(0);
    const other = run.enemies.spawn(1, Role.Sieger, run.hero.x + 100, run.hero.y, 1e6, 1, 0);
    damageEnemy(run, other, 1, 0);
    expect(run.enemies.knockVX[other]).not.toBe(0);
  });

  it("elites of every faction drop a heart and count as elites", () => {
    const run = createRun(gameData(), { seed: 1, durationSeconds: 100000 });
    for (const id of ["captain", "warlord", "bone-tyrant", "grove-warden"]) expect(run.isElite[typeOf(run, id)], id).toBe(1);
    expect(run.isElite[typeOf(run, "lancer")]).toBe(0);
    for (const id of ["captain", "warlord", "dread-regent"]) expect(run.hasAura[typeOf(run, id)], id).toBe(1);
  });
});
