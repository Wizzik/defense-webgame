import { describe, expect, it } from "vitest";
import type { GameData } from "../data/schema";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { createRun } from "./run";
import { spawnEnemies } from "./spawner";
import { buildPhaseTables, pickType } from "./spawn-tables";
import { gameData } from "./testing/game-data";

type Phase = GameData["rules"]["phases"][number];

const ARENA = { width: 6000, height: 6000, castle: { x: 100, y: -50 }, heroStart: { x: 0, y: 500 }, spawn: { radius: 2400, spread: 150 } };
const SPREAD = ARENA.spawn.spread;

function phase(over: Partial<Phase> = {}): Phase {
  return { mix: { shieldbearer: 1 }, pack: { min: 6, max: 10, everySeconds: 5 }, packs: 1, hunterShare: 0.3, elites: 0, ...over };
}

function newRun(tweak?: (d: GameData) => void, seed = 1) {
  const data = gameData();
  data.rules.arena = JSON.parse(JSON.stringify(ARENA));
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

interface Pack { tick: number; role: number; count: number; x: number; y: number; first: number }

/** Like spawnOnly, but returns the PackSpawn events; `first` is the pack's first slot while nobody dies. */
function spawnPacks(run: TestRun, steps: number): Pack[] {
  const packs: Pack[] = [];
  for (let i = 0; i < steps; i++) {
    run.events.clear();
    let first = run.stats.spawned;
    spawnEnemies(run);
    const ev = run.events;
    for (let k = 0; k < ev.count; k++) {
      if (ev.kind[k] !== EventKind.PackSpawn) continue;
      packs.push({ tick: run.tick, role: ev.a[k]!, count: ev.value[k]!, x: ev.x[k]!, y: ev.y[k]!, first });
      first += ev.value[k]!;
    }
    run.tick++;
  }
  return packs;
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

  it("a pack appears on the ring around the castle", () => {
    const run = newRun((d) => {
      d.rules.phases = [phase({ pack: { min: 5, max: 5, everySeconds: 1 } })];
    });
    const packs = spawnPacks(run, 91);
    expect(packs).toHaveLength(4);
    const e = run.enemies;
    for (const pack of packs) {
      const dx = pack.x - ARENA.castle.x;
      const dy = pack.y - ARENA.castle.y;
      expect(Math.abs(Math.sqrt(dx * dx + dy * dy) - ARENA.spawn.radius)).toBeLessThan(1e-6);
      expect(pack.count).toBe(5);
      for (let i = pack.first; i < pack.first + 5; i++) {
        expect(e.role[i]).toBe(pack.role);
        expect(Math.abs(e.x[i]! - pack.x)).toBeLessThanOrEqual(SPREAD);
        expect(Math.abs(e.y[i]! - pack.y)).toBeLessThanOrEqual(SPREAD);
      }
    }
    // packs of different intervals come from different directions
    expect(new Set(packs.map((p) => Math.round(p.x))).size).toBe(4);
  });

  it("packs of one interval come from different sides", () => {
    const two = newRun((d) => {
      d.rules.phases = [phase({ packs: 2 })];
    });
    const [a, b, ...rest] = spawnPacks(two, 1);
    expect(rest).toHaveLength(0);
    expect(a!.x + b!.x).toBeCloseTo(2 * ARENA.castle.x, 6);
    expect(a!.y + b!.y).toBeCloseTo(2 * ARENA.castle.y, 6);

    const three = newRun((d) => {
      d.rules.phases = [phase({ packs: 3 })];
    });
    const packs = spawnPacks(three, 1);
    expect(packs).toHaveLength(3);
    const r2 = ARENA.spawn.radius * ARENA.spawn.radius;
    for (let k = 0; k < 3; k++) {
      const p = packs[k]!;
      const q = packs[(k + 1) % 3]!;
      const dot = (p.x - ARENA.castle.x) * (q.x - ARENA.castle.x) + (p.y - ARENA.castle.y) * (q.y - ARENA.castle.y);
      expect(dot / r2).toBeCloseTo(-0.5, 9);
    }
  });

  it("each pack has its own role and size", () => {
    const run = newRun((d) => {
      d.rules.enemies.maxAlive = 2000;
      d.rules.phases = [phase({ packs: 3, pack: { min: 3, max: 12, everySeconds: 1 }, hunterShare: 0.5 })];
    });
    const packs = spawnPacks(run, 20 * 30);
    expect(packs).toHaveLength(60);
    let mixedSizes = 0;
    let mixedRoles = 0;
    for (let i = 0; i < packs.length; i += 3) {
      const trio = packs.slice(i, i + 3);
      expect(new Set(trio.map((p) => p.tick)).size).toBe(1);
      if (new Set(trio.map((p) => p.count)).size > 1) mixedSizes++;
      if (new Set(trio.map((p) => p.role)).size > 1) mixedRoles++;
      for (const pack of trio) {
        expect(pack.count).toBeGreaterThanOrEqual(3);
        expect(pack.count).toBeLessThanOrEqual(12);
        for (let s = pack.first; s < pack.first + pack.count; s++) expect(run.enemies.role[s]).toBe(pack.role);
      }
    }
    expect(mixedSizes).toBeGreaterThan(5);
    expect(mixedRoles).toBeGreaterThan(5);
  });

  it("pack members stay inside the arena", () => {
    const run = newRun((d) => {
      d.rules.arena.castle = { x: 0, y: 0 };
      d.rules.arena.spawn = { radius: 2900, spread: 400 };
      d.rules.enemies.maxAlive = 2000;
      d.rules.phases = [phase({ packs: 3, pack: { min: 20, max: 20, everySeconds: 1 } })];
    });
    spawnPacks(run, 20 * 30);
    const e = run.enemies;
    expect(e.aliveCount).toBe(1200);
    let onEdge = 0;
    for (let i = 0; i < 1200; i++) {
      const limit = 3000 - run.data.enemies[e.type[i]!]!.collision;
      expect(Math.abs(e.x[i]!)).toBeLessThanOrEqual(limit);
      expect(Math.abs(e.y[i]!)).toBeLessThanOrEqual(limit);
      if (Math.abs(e.x[i]!) === limit || Math.abs(e.y[i]!) === limit) onEdge++;
      const d = Math.sqrt(e.x[i]! * e.x[i]! + e.y[i]! * e.y[i]!);
      expect(d).toBeGreaterThan(run.castle.radius + 100);
    }
    expect(onEdge).toBeGreaterThan(0);
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

  it("elites come once per phase with the first pack of its first interval", () => {
    const run = newRun((d) => {
      const elitePhase = () => phase({ packs: 2, pack: { min: 3, max: 3, everySeconds: 20 }, elites: 2 });
      d.rules.phases = [elitePhase(), elitePhase()];
    });
    // intervals at 0, 20 and 40 s (phase 0) and 60 s (phase 1), two packs each
    const packs = spawnPacks(run, 60 * 30 + 1);
    expect(packs.map((p) => p.count)).toEqual([5, 3, 3, 3, 3, 3, 5, 3]);
    const captain = typeOf(run, "captain");
    const captains: number[] = [];
    for (let i = 0; i < run.enemies.aliveCount; i++) if (run.enemies.type[i] === captain) captains.push(i);
    expect(captains).toEqual([0, 1, 20, 21]);
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

  it("a volley at the cap fills only free slots and banks nothing", () => {
    const run = newRun((d) => {
      d.rules.enemies.maxAlive = 5;
      d.rules.phases = [phase({ packs: 2, pack: { min: 4, max: 4, everySeconds: 1 } })];
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
    const [pack] = spawnPacks(run, 1);
    const half = SPREAD * Math.sqrt(20 / 8);
    let farthest = 0;
    for (let i = 0; i < 20; i++) {
      const dx = Math.abs(run.enemies.x[i]! - pack!.x);
      const dy = Math.abs(run.enemies.y[i]! - pack!.y);
      expect(dx).toBeLessThanOrEqual(half);
      expect(dy).toBeLessThanOrEqual(half);
      farthest = Math.max(farthest, dx, dy);
    }
    expect(farthest).toBeGreaterThan(SPREAD);
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
