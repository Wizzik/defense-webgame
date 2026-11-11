import { describe, expect, it } from "vitest";
import type { GameData } from "../data/schema";
import { Role } from "./enemies";
import { createRun } from "./run";
import { spawnEnemies } from "./spawner";
import { buildPhaseTables, pickType } from "./spawn-tables";
import { gameData } from "./testing/game-data";

type Phase = GameData["rules"]["phases"][number];

const GATES = [{ x: -1800, y: 2200 }, { x: 1800, y: 2200 }];
const GATE_RADIUS = 150;

function phase(over: Partial<Phase> = {}): Phase {
  return { mix: { shieldbearer: 1 }, pack: { min: 6, max: 10, everySeconds: 5 }, hunterShare: 0.3, elites: 0, ...over };
}

function newRun(tweak?: (d: GameData) => void, seed = 1) {
  const data = gameData();
  data.rules.arena.gates = GATES.map((g) => ({ ...g }));
  data.rules.arena.gateRadius = GATE_RADIUS;
  data.rules.run.phaseSeconds = 50;
  data.rules.run.firstPackSeconds = 0;
  data.rules.run.timeScaling = { seconds: 1200, cap: 2 };
  data.rules.enemies.maxAlive = 150;
  data.rules.enemies.elite = "captain";
  data.rules.phases = [phase()];
  tweak?.(data);
  return createRun(data, { seed, durationSeconds: 100000 });
}

type TestRun = ReturnType<typeof newRun>;

/** Spawner only: nobody moves, so counts stay exact. Returns the spawns of each call. */
function spawnOnly(run: TestRun, steps: number): number[] {
  const added: number[] = [];
  for (let i = 0; i < steps; i++) {
    const before = run.stats.spawned;
    spawnEnemies(run);
    added.push(run.stats.spawned - before);
    run.tick++;
  }
  return added;
}

const typeOf = (run: TestRun, id: string): number => run.data.enemies.findIndex((e) => e.id === id);

describe("spawn tables", () => {
  it("pickType follows the weights in mix order", () => {
    const data = gameData();
    data.rules.phases = [phase({ mix: { musketeer: 1, shieldbearer: 3 } })];
    const [table] = buildPhaseTables(data);
    const musketeer = data.enemies.findIndex((e) => e.id === "musketeer");
    const shieldbearer = data.enemies.findIndex((e) => e.id === "shieldbearer");
    expect(pickType(table!, 0)).toBe(musketeer);
    expect(pickType(table!, 0.24)).toBe(musketeer);
    expect(pickType(table!, 0.25)).toBe(shieldbearer);
    expect(pickType(table!, 0.999999)).toBe(shieldbearer);
  });

  it("an unknown enemy in a mix throws", () => {
    const data = gameData();
    data.rules.phases = [phase({ mix: { ghost: 1 } })];
    expect(() => buildPhaseTables(data)).toThrow('unknown enemy "ghost"');
  });
});

describe("spawner", () => {
  it("first pack comes at firstPackSeconds", () => {
    const run = newRun((d) => {
      d.rules.run.firstPackSeconds = 3;
    });
    spawnOnly(run, 90);
    expect(run.stats.spawned).toBe(0);
    spawnOnly(run, 1);
    expect(run.stats.spawned).toBeGreaterThan(0);
  });

  it("packs come every everySeconds", () => {
    const run = newRun();
    const added = spawnOnly(run, 301);
    const ticks = added.flatMap((n, tick) => (n > 0 ? [tick] : []));
    expect(ticks).toEqual([0, 150, 300]);
  });

  it("pack size stays within min and max", () => {
    const run = newRun((d) => {
      d.rules.enemies.maxAlive = 1000;
      d.rules.phases = [phase({ pack: { min: 6, max: 10, everySeconds: 1 } })];
    });
    const sizes = spawnOnly(run, 40 * 30).filter((n) => n > 0);
    expect(sizes).toHaveLength(40);
    for (const size of sizes) {
      expect(size).toBeGreaterThanOrEqual(6);
      expect(size).toBeLessThanOrEqual(10);
    }
    expect(new Set(sizes).size).toBeGreaterThan(1);
  });

  it("counts every spawned enemy in the run stats", () => {
    const run = newRun();
    spawnOnly(run, 200);
    expect(run.stats.spawned).toBeGreaterThan(0);
    expect(run.stats.spawned).toBe(run.enemies.aliveCount);
  });

  it("a pack shares one gate and one role; gates alternate", () => {
    const run = newRun((d) => {
      d.rules.phases = [phase({ pack: { min: 5, max: 5, everySeconds: 1 }, hunterShare: 0.5 })];
    });
    spawnOnly(run, 91);
    const e = run.enemies;
    expect(e.aliveCount).toBe(20);
    for (let pack = 0; pack < 4; pack++) {
      const first = pack * 5;
      for (let i = first; i < first + 5; i++) {
        expect(e.gate[i]).toBe(pack % 2);
        expect(e.role[i]).toBe(e.role[first]);
        expect(Math.abs(e.x[i]! - GATES[pack % 2]!.x)).toBeLessThanOrEqual(GATE_RADIUS);
      }
    }
  });

  it("hunter share decides the role of whole packs", () => {
    const run = newRun((d) => {
      d.rules.enemies.maxAlive = 200;
      d.rules.phases = [phase({ pack: { min: 1, max: 1, everySeconds: 1 / 30 }, hunterShare: 0.25 })];
    });
    spawnOnly(run, 200);
    expect(run.enemies.aliveCount).toBe(200);
    let hunters = 0;
    for (let i = 0; i < 200; i++) if (run.enemies.role[i] === Role.Hunter) hunters++;
    expect(hunters / 200).toBeGreaterThanOrEqual(0.15);
    expect(hunters / 200).toBeLessThanOrEqual(0.35);
  });

  it("mix weights pick the types", () => {
    const run = newRun((d) => {
      d.rules.enemies.maxAlive = 500;
      d.rules.phases = [phase({ mix: { shieldbearer: 3, musketeer: 1 }, pack: { min: 50, max: 50, everySeconds: 1 } })];
    });
    spawnOnly(run, 10 * 30);
    expect(run.enemies.aliveCount).toBe(500);
    const shieldbearer = typeOf(run, "shieldbearer");
    const musketeer = typeOf(run, "musketeer");
    let musketeers = 0;
    for (let i = 0; i < 500; i++) {
      const type = run.enemies.type[i]!;
      expect([shieldbearer, musketeer]).toContain(type);
      if (type === musketeer) musketeers++;
    }
    expect(musketeers / 500).toBeGreaterThanOrEqual(0.15);
    expect(musketeers / 500).toBeLessThanOrEqual(0.35);
  });

  it("elites come once per phase with its first pack", () => {
    const run = newRun((d) => {
      const elitePhase = () => phase({ pack: { min: 3, max: 3, everySeconds: 20 }, elites: 2 });
      d.rules.phases = [elitePhase(), elitePhase()];
    });
    // packs at 0 s and 20 s (phase 0), 40 s (phase 0), 60 s (phase 1)
    const added = spawnOnly(run, 60 * 30 + 1).filter((n) => n > 0);
    expect(added).toEqual([5, 3, 3, 5]);
    const captain = typeOf(run, "captain");
    const captains: number[] = [];
    for (let i = 0; i < run.enemies.aliveCount; i++) if (run.enemies.type[i] === captain) captains.push(i);
    expect(captains).toEqual([0, 1, 11, 12]);
  });

  it("elites go first when the cap cuts the pack", () => {
    const run = newRun((d) => {
      d.rules.enemies.maxAlive = 2;
      d.rules.phases = [phase({ pack: { min: 3, max: 3, everySeconds: 20 }, elites: 2 })];
    });
    spawnOnly(run, 1);
    const captain = typeOf(run, "captain");
    expect(Array.from(run.enemies.type.subarray(0, 2))).toEqual([captain, captain]);
    // the phase's elites were sent: the next pack brings none
    run.enemies.kill(0);
    run.enemies.kill(1);
    spawnOnly(run, 20 * 30);
    expect(run.enemies.aliveCount).toBe(2);
    expect(Array.from(run.enemies.type.subarray(0, 2))).not.toContain(captain);
  });

  it("the next pack follows the new phase", () => {
    const run = newRun((d) => {
      d.rules.phases = [
        phase({ mix: { shieldbearer: 1 }, pack: { min: 4, max: 4, everySeconds: 20 }, hunterShare: 0 }),
        phase({ mix: { musketeer: 1 }, pack: { min: 2, max: 2, everySeconds: 5 }, hunterShare: 1 }),
      ];
    });
    const added = spawnOnly(run, 65 * 30 + 1);
    const ticks = added.flatMap((n, tick) => (n > 0 ? [tick] : []));
    // 0, 20 and 40 s belong to phase 0; the pack at 60 s and the interval after it to phase 1
    expect(ticks).toEqual([0, 600, 1200, 1800, 1950]);
    expect(added[1800]).toBe(2);
    const musketeer = typeOf(run, "musketeer");
    for (let i = 0; i < 12; i++) {
      expect(run.enemies.type[i]).not.toBe(musketeer);
      expect(run.enemies.role[i]).toBe(Role.Sieger);
    }
    for (let i = 12; i < 16; i++) {
      expect(run.enemies.type[i]).toBe(musketeer);
      expect(run.enemies.role[i]).toBe(Role.Hunter);
    }
  });

  it("a pack at the cap fills only free slots and banks nothing", () => {
    const run = newRun((d) => {
      d.rules.enemies.maxAlive = 5;
      d.rules.phases = [phase({ pack: { min: 8, max: 8, everySeconds: 1 } })];
    });
    spawnOnly(run, 1);
    expect(run.enemies.aliveCount).toBe(5);
    expect(run.stats.spawned).toBe(5);
    run.enemies.kill(1);
    run.enemies.kill(3);
    spawnOnly(run, 29);
    expect(run.enemies.aliveCount).toBe(3);
    spawnOnly(run, 1);
    expect(run.enemies.aliveCount).toBe(5);
    expect(run.stats.spawned).toBe(7);
  });

  it("pack spread grows with its size", () => {
    const run = newRun((d) => {
      d.rules.phases = [phase({ pack: { min: 20, max: 20, everySeconds: 5 } })];
    });
    spawnOnly(run, 1);
    const half = GATE_RADIUS * Math.sqrt(20 / 8);
    let farthest = 0;
    for (let i = 0; i < 20; i++) {
      const dx = Math.abs(run.enemies.x[i]! - GATES[0]!.x);
      const dy = Math.abs(run.enemies.y[i]! - GATES[0]!.y);
      expect(dx).toBeLessThanOrEqual(half);
      expect(dy).toBeLessThanOrEqual(half);
      farthest = Math.max(farthest, dx, dy);
    }
    expect(farthest).toBeGreaterThan(GATE_RADIUS);
  });

  it("a small pack stays within the gate radius", () => {
    const run = newRun((d) => {
      d.rules.phases = [phase({ pack: { min: 4, max: 4, everySeconds: 5 } })];
    });
    spawnOnly(run, 1);
    for (let i = 0; i < 4; i++) {
      expect(Math.abs(run.enemies.x[i]! - GATES[0]!.x)).toBeLessThanOrEqual(GATE_RADIUS);
      expect(Math.abs(run.enemies.y[i]! - GATES[0]!.y)).toBeLessThanOrEqual(GATE_RADIUS);
    }
  });

  it("phase changes after phaseSeconds", () => {
    const run = newRun((d) => {
      d.rules.phases = [phase(), phase()];
    });
    spawnOnly(run, 1499);
    expect(run.phaseIndex).toBe(0);
    spawnOnly(run, 1);
    expect(run.phaseIndex).toBe(1);
  });

  it("scales hp with time", () => {
    const run = newRun();
    run.tick = 600 * 30;
    spawnEnemies(run);
    expect(run.enemies.aliveCount).toBeGreaterThan(0);
    const def = run.data.enemies[run.enemies.type[0]!]!;
    expect(run.enemies.hp[0]).toBeCloseTo(def.hp * 1.5, 6);
    expect(run.enemies.damageScale[0]).toBeCloseTo(1.5, 6);
  });

  it("same seed spawns at the same positions", () => {
    const a = newRun(undefined, 7);
    const b = newRun(undefined, 7);
    const c = newRun(undefined, 8);
    spawnOnly(a, 900);
    spawnOnly(b, 900);
    spawnOnly(c, 900);
    expect(a.enemies.aliveCount).toBeGreaterThan(5);
    expect(Array.from(a.enemies.x)).toEqual(Array.from(b.enemies.x));
    expect(Array.from(a.enemies.y)).toEqual(Array.from(b.enemies.y));
    expect(Array.from(a.enemies.x)).not.toEqual(Array.from(c.enemies.x));
  });
});
