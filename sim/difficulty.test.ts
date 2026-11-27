import { describe, expect, it } from "vitest";
import type { DifficultyId } from "../data/schema";
import { TICKS_PER_SECOND } from "./constants";
import { gainGold } from "./crystals";
import { difficultyMods } from "./difficulty";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { stateHash } from "./hash";
import { createRun, type Run } from "./run";
import { spawnEnemies, timeScale } from "./spawner";
import { gameData } from "./testing/game-data";
import { spawnBoss, updateTimeline } from "./timeline";

const rules = () => gameData().rules;

/** A run whose difficulty table and events are fixed here, so tuning cannot break the tests. */
function newRun(difficulty: DifficultyId, world = 1, extra: { startPhase?: number; seed?: number } = {}): Run {
  const data = gameData();
  data.rules.difficulty.worldStep = { hp: 0.25, damage: 0.25 };
  data.rules.difficulty.reward = { goldPerWorld: 0.1, magicFindPerWorld: 0.1 };
  const rushes = [
    { atSeconds: 90, elites: 1, heavies: 2 },
    { atSeconds: 270, elites: 2, heavies: 3 },
    { atSeconds: 450, elites: 3, heavies: 4 },
    { atSeconds: 630, elites: 4, heavies: 6 },
    { atSeconds: 810, elites: 5, heavies: 8 },
  ];
  data.rules.difficulty.levels = {
    normal: { hp: 1, damage: 1, packSize: 1, eliteHp: 1, magicFind: 0, extraRushes: [] },
    insane: { hp: 1.75, damage: 1.75, packSize: 1.2, eliteHp: 1, magicFind: 0.25, extraRushes: rushes },
    hell: { hp: 3, damage: 3, packSize: 1.4, eliteHp: 1.5, magicFind: 0.5, extraRushes: rushes },
  };
  data.rules.events = [
    { atSeconds: 180, kind: "rush", elites: 2, heavies: 3 },
    { atSeconds: 250, kind: "boss", enemy: "iron-marshal" },
    { atSeconds: 540, kind: "rush", elites: 5, heavies: 8 },
  ];
  data.rules.run.rushWarningSeconds = 7;
  return createRun(data, { seed: extra.seed ?? 1, world, difficulty, startPhase: extra.startPhase });
}

interface Seen { kind: number; value: number }

/** Runs only the timeline at the given second and returns the events of that step. */
function at(run: Run, seconds: number): Seen[] {
  run.tick = Math.round(seconds * TICKS_PER_SECOND);
  run.events.clear();
  updateTimeline(run);
  const seen: Seen[] = [];
  for (let i = 0; i < run.events.count; i++) seen.push({ kind: run.events.kind[i]!, value: run.events.value[i]! });
  return seen;
}

function alive(run: Run): number[] {
  const slots: number[] = [];
  for (let i = 0; i < run.enemies.capacity; i++) if (run.enemies.alive[i] === 1) slots.push(i);
  return slots;
}

describe("difficultyMods", () => {
  it("world 1 on normal changes nothing but Normal's own pack size", () => {
    const r = rules();
    expect(difficultyMods(r, 1, "normal")).toEqual({
      hp: 1, damage: 1, packSize: r.difficulty.levels.normal!.packSize, eliteHp: 1, gold: 1, magicFind: 0, xp: 1,
    });
  });

  it("a co-op group gains a kill's XP over its bigger packs (Petr's batch 3)", () => {
    const r = rules();
    r.coop.perPlayer.packSize = 0.3;
    expect(difficultyMods(r, 1, "normal", 1).xp).toBe(1);
    expect(difficultyMods(r, 1, "normal", 3).xp).toBeCloseTo(1 / 1.6, 12);
  });

  it("world 3 insane and world 5 hell", () => {
    const r = rules();
    r.difficulty.worldStep = { hp: 0.25, damage: 0.25 };
    r.difficulty.reward = { goldPerWorld: 0.1, magicFindPerWorld: 0.1 };
    r.difficulty.levels.insane = { ...r.difficulty.levels.insane, hp: 1.75, damage: 1.75, magicFind: 0.25 };
    r.difficulty.levels.hell = { ...r.difficulty.levels.hell, hp: 3, damage: 3, eliteHp: 1.5 };
    const insane = difficultyMods(r, 3, "insane");
    expect(insane.hp).toBeCloseTo(2.625, 12);
    expect(insane.damage).toBeCloseTo(2.625, 12);
    expect(insane.gold).toBeCloseTo(1.2, 12);
    expect(insane.magicFind).toBeCloseTo(0.45, 12);
    const hell = difficultyMods(r, 5, "hell");
    expect(hell.hp).toBe(6);
    expect(hell.eliteHp).toBe(1.5);
  });

  it("a world's strength multiplies enemy hp and damage on top of the world step", () => {
    const r = rules();
    r.difficulty.worldStep = { hp: 0.25, damage: 0.25 };
    const strong = difficultyMods(r, 5, "normal", 1, 1.2);
    expect(strong.hp).toBeCloseTo(2.4, 12);
    expect(strong.damage).toBeCloseTo(2.4, 12);
    expect(strong.packSize).toBe(r.difficulty.levels.normal!.packSize);
    expect(strong.gold).toBe(difficultyMods(r, 5, "normal").gold);
  });

  it("createRun takes the strength of its world from the data", () => {
    const data = gameData();
    data.worlds[3]!.strength = 1.5;
    const run = createRun(data, { seed: 1, world: 4 });
    expect(run.mods.hp).toBeCloseTo(1.5 * difficultyMods(data.rules, 4, "normal").hp, 12);
    expect(createRun(data, { seed: 1, world: 3 }).mods.hp).toBeCloseTo(difficultyMods(data.rules, 3, "normal").hp, 12);
  });
});

describe("run world and difficulty", () => {
  it("createRun refuses a world or difficulty outside the data", () => {
    const data = gameData();
    expect(() => createRun(data, { seed: 1, world: 6 })).toThrow(/world/);
    expect(() => createRun(data, { seed: 1, world: 0 })).toThrow(/world/);
    expect(() => createRun(data, { seed: 1, world: 1.5 })).toThrow(/world/);
    expect(() => createRun(data, { seed: 1, difficulty: "nightmare" as DifficultyId })).toThrow(/difficulty/);
    const run = createRun(data, { seed: 1 });
    expect(run.world).toBe(1);
    expect(run.difficulty).toBe("normal");
  });

  it("world 2 hell: pack members, elites and bosses get the multipliers", () => {
    const run = newRun("hell", 2);
    run.tick = Math.round(20 * TICKS_PER_SECOND);
    run.nextPackTick = run.tick;
    run.elitePhase = -1;
    run.data.rules.phases[0]!.elites = 1;
    spawnEnemies(run);
    const scale = timeScale(run.data.rules, run.tick);
    const slots = alive(run);
    expect(slots.length).toBeGreaterThan(1);
    for (const slot of slots) {
      const type = run.enemies.type[slot]!;
      const def = run.data.enemies[type]!;
      const elite = run.isElite[type] === 1 ? 1.5 : 1;
      expect(run.enemies.maxHp[slot], def.id).toBeCloseTo(def.hp * scale * 3.75 * elite, 6);
      expect(run.enemies.damageScale[slot], def.id).toBeCloseTo(scale * 3.75, 12);
    }
    expect(slots.some((s) => run.isElite[run.enemies.type[s]!] === 1)).toBe(true);
    const bossType = run.data.enemies.findIndex((e) => e.id === "iron-marshal");
    const boss = spawnBoss(run, bossType, Role.Hunter);
    expect(run.enemies.maxHp[boss]).toBeCloseTo(run.data.enemies[bossType]!.hp * scale * 3.75 * 1.5, 6);
    expect(run.enemies.damageScale[boss]).toBeCloseTo(scale * 3.75, 12);
  });

  it("insane adds a rush at 90 s announced 7 s ahead; normal does not", () => {
    const insane = newRun("insane");
    const warned = at(insane, 83);
    expect(warned.map((e) => e.kind)).toEqual([EventKind.RushWarning]);
    const came = at(insane, 90);
    expect(came.map((e) => e.kind)).toEqual([EventKind.PackSpawn]);
    expect(came[0]!.value).toBe(3);
    const normal = newRun("normal");
    expect(at(normal, 83)).toEqual([]);
    expect(at(normal, 90)).toEqual([]);
  });

  it("an extra rush at the time of a normal event comes after it", () => {
    const data = gameData();
    data.rules.events = [{ atSeconds: 90, kind: "boss", enemy: "iron-marshal" }];
    data.rules.difficulty.levels.insane.extraRushes = [{ atSeconds: 90, elites: 1, heavies: 2 }];
    const run = createRun(data, { seed: 1, difficulty: "insane" });
    expect(at(run, 90).map((e) => e.kind)).toEqual([EventKind.BossSpawn, EventKind.PackSpawn]);
  });

  it("a start at phase 11 on insane skips the rushes before it and warns for the next one", () => {
    const run = newRun("insane", 1, { startPhase: 11 });
    const start = run.tick / TICKS_PER_SECOND;
    expect(start).toBe(500);
    const times = run.timeline.slice(run.nextEvent).map((e) => e.tick / TICKS_PER_SECOND);
    expect(times).toEqual([540, 630, 810]);
    expect(at(run, 533).map((e) => e.kind)).toEqual([EventKind.RushWarning]);
    expect(at(run, 540).map((e) => e.kind)).toEqual([EventKind.PackSpawn]);
    expect(at(run, 623).map((e) => e.kind)).toEqual([EventKind.RushWarning]);
  });

  it("hell packs at the cap of living enemies fill only the free slots and keep a living boss", () => {
    const run = newRun("hell", 1);
    const cap = run.enemies.capacity;
    const bossType = run.data.enemies.findIndex((e) => e.id === "iron-marshal");
    const boss = spawnBoss(run, bossType, Role.Hunter);
    while (run.enemies.aliveCount < cap - 3) run.enemies.spawn(0, Role.Sieger, 1000, 1000, 100, 1, 0);
    run.tick = Math.round(20 * TICKS_PER_SECOND);
    run.nextPackTick = run.tick;
    spawnEnemies(run);
    expect(run.enemies.aliveCount).toBe(cap);
    expect(run.enemies.alive[boss]).toBe(1);
    expect(run.enemies.type[boss]).toBe(bossType);
  });

  it("pack sizes grow by packSize", () => {
    const count = (d: DifficultyId) => {
      const run = newRun(d, 1, { seed: 5 });
      run.tick = Math.round(20 * TICKS_PER_SECOND);
      run.nextPackTick = run.tick;
      run.elitePhase = 0;
      const phase = run.data.rules.phases[0]!;
      phase.packs = 1;
      phase.pack = { ...phase.pack, min: 10, max: 10 };
      spawnEnemies(run);
      return run.enemies.aliveCount;
    };
    expect(count("normal")).toBe(10);
    expect(count("insane")).toBe(12);
    expect(count("hell")).toBe(14);
  });

  it("a coin of 10 gold gives 12 in world 3", () => {
    const run = newRun("normal", 3);
    expect(gainGold(run, 10)).toBe(12);
  });

  it("the world and the difficulty are part of the state hash", () => {
    expect(stateHash(newRun("normal", 1))).not.toBe(stateHash(newRun("normal", 2)));
    expect(stateHash(newRun("normal", 1))).not.toBe(stateHash(newRun("insane", 1)));
  });
});
