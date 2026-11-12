import { describe, expect, it } from "vitest";
import { TICKS_PER_SECOND } from "./constants";
import { killEnemy } from "./combat";
import { Role } from "./enemies";
import { updateEnemies } from "./enemy-ai";
import { EventKind } from "./events";
import { stateHash } from "./hash";
import { NO_INPUT } from "./input";
import { createRun, type Run } from "./run";
import { timeScale } from "./spawner";
import { spawnBoss, updateTimeline } from "./timeline";
import { enemyRun } from "./testing/enemy-run";
import { gameData } from "./testing/game-data";

/** The tests set the events they count on, so balance tuning cannot break them. */
const newRun = (seed = 1) => {
  const data = gameData();
  data.rules.events = [
    { atSeconds: 180, kind: "rush", units: { captain: 3, lancer: 4 } },
    { atSeconds: 250, kind: "boss", enemy: "iron-marshal" },
    { atSeconds: 360, kind: "rush", units: { captain: 4, lancer: 6 } },
    { atSeconds: 500, kind: "boss", enemy: "pale-abbot" },
    { atSeconds: 750, kind: "boss", enemy: "gunmaster" },
  ];
  data.rules.run.rushWarningSeconds = 7;
  return createRun(data, { seed, durationSeconds: 100000 });
};
const typeOf = (run: Run, id: string) => run.data.enemies.findIndex((e) => e.id === id);

interface Seen { kind: number; a: number; value: number; x: number; y: number }

/** Runs only the timeline at the given second and returns the events of that step. */
function at(run: Run, seconds: number): Seen[] {
  run.tick = Math.round(seconds * TICKS_PER_SECOND);
  run.events.clear();
  updateTimeline(run);
  const ev = run.events;
  const seen: Seen[] = [];
  for (let i = 0; i < ev.count; i++) seen.push({ kind: ev.kind[i]!, a: ev.a[i]!, value: ev.value[i]!, x: ev.x[i]!, y: ev.y[i]! });
  return seen;
}

function fill(run: Run, count: number): void {
  for (let i = 0; i < count; i++) run.enemies.spawn(0, Role.Sieger, 1000, 1000, 100, 1, i);
}

function aliveOfType(run: Run, type: number): number[] {
  const slots: number[] = [];
  for (let i = 0; i < run.enemies.capacity; i++) if (run.enemies.alive[i] === 1 && run.enemies.type[i] === type) slots.push(i);
  return slots;
}

describe("timeline", () => {
  it("a rush warns 7 s ahead and comes from the warned side", () => {
    const run = newRun();
    expect(at(run, 172.9)).toEqual([]);
    const warned = at(run, 173);
    expect(warned).toHaveLength(1);
    expect(warned[0]!.kind).toBe(EventKind.RushWarning);
    expect(warned[0]!.value).toBe(7);
    const { castle, spawn } = run.data.rules.arena;
    const dx = warned[0]!.x - castle.x;
    const dy = warned[0]!.y - castle.y;
    expect(Math.sqrt(dx * dx + dy * dy)).toBeCloseTo(spawn.radius, 6);
    expect(at(run, 179)).toEqual([]);
    expect(run.enemies.aliveCount).toBe(0);

    const came = at(run, 180);
    expect(came).toHaveLength(1);
    expect(came[0]!.kind).toBe(EventKind.PackSpawn);
    expect(came[0]!.a).toBe(Role.Sieger);
    expect(came[0]!.value).toBe(7);
    expect(came[0]!.x).toBeCloseTo(warned[0]!.x, 6);
    expect(came[0]!.y).toBeCloseTo(warned[0]!.y, 6);
    expect(aliveOfType(run, typeOf(run, "captain"))).toEqual([0, 1, 2]);
    expect(aliveOfType(run, typeOf(run, "lancer"))).toEqual([3, 4, 5, 6]);
    for (let i = 0; i < 7; i++) expect(run.enemies.role[i]).toBe(Role.Sieger);
    expect(run.enemies.hp[0]).toBe(run.data.enemies[typeOf(run, "captain")]!.hp * timeScale(run.data.rules, run.tick));
    expect(run.stats.spawned).toBe(7);
    expect(run.nextEvent).toBe(1);
    expect(at(run, 180 + 1 / TICKS_PER_SECOND)).toEqual([]);
  });

  it("a run that starts after the warning step still gets the rush", () => {
    const run = newRun();
    const came = at(run, 180);
    expect(came.map((e) => e.kind)).toEqual([EventKind.PackSpawn]);
    expect(run.enemies.aliveCount).toBe(7);
  });

  it("a rush at the cap fills only free slots", () => {
    const run = newRun();
    fill(run, run.enemies.capacity - 3);
    const came = at(run, 180);
    expect(came).toHaveLength(1);
    expect(came[0]!.value).toBe(3);
    expect(run.enemies.aliveCount).toBe(run.enemies.capacity);
    expect(aliveOfType(run, typeOf(run, "captain"))).toHaveLength(3);

    const full = newRun();
    fill(full, full.enemies.capacity);
    expect(at(full, 180)).toEqual([]);
    expect(full.nextEvent).toBe(1);
  });

  it("a miniboss comes alone at its time", () => {
    const run = newRun();
    at(run, 180);
    expect(at(run, 249.9)).toEqual([]);
    const came = at(run, 250);
    const marshal = typeOf(run, "iron-marshal");
    expect(came).toHaveLength(1);
    expect(came[0]!.kind).toBe(EventKind.BossSpawn);
    expect(came[0]!.value).toBe(marshal);
    const slot = came[0]!.a;
    expect(aliveOfType(run, marshal)).toEqual([slot]);
    expect(run.enemies.role[slot]).toBe(Role.Sieger);
    const scale = timeScale(run.data.rules, run.tick);
    expect(run.enemies.hp[slot]).toBe(run.data.enemies[marshal]!.hp * scale);
    expect(run.enemies.maxHp[slot]).toBe(run.enemies.hp[slot]);
    expect(run.enemies.damageScale[slot]).toBe(scale);
    expect(run.enemies.x[slot]).toBe(came[0]!.x);
    const { castle, spawn } = run.data.rules.arena;
    const dx = came[0]!.x - castle.x;
    const dy = came[0]!.y - castle.y;
    expect(Math.sqrt(dx * dx + dy * dy)).toBeCloseTo(spawn.radius, 6);
    expect(run.bossCount).toBe(1);
    expect(run.enemies.aliveCount).toBe(8);
  });

  it("a boss replaces the oldest common enemy when the store is full", () => {
    const run = newRun();
    fill(run, run.enemies.capacity);
    run.enemies.spawnTick[5] = -1; // slot 5 is the oldest
    at(run, 180);
    const came = at(run, 250);
    expect(came.map((e) => e.kind)).toEqual([EventKind.BossSpawn]);
    expect(came[0]!.a).toBe(5);
    expect(run.enemies.type[5]).toBe(typeOf(run, "iron-marshal"));
    expect(run.enemies.aliveCount).toBe(run.enemies.capacity);
    expect(run.stats.kills).toBe(0);
    let crystals = 0;
    for (let i = 0; i < run.crystals.capacity; i++) crystals += run.crystals.alive[i]!;
    expect(crystals).toBe(0);
  });

  it("oldestWhere skips the given types and prefers the lower slot on a tie", () => {
    const run = newRun();
    const marshal = typeOf(run, "iron-marshal");
    run.enemies.spawn(marshal, Role.Sieger, 0, 0, 1, 1, 0);
    run.enemies.spawn(0, Role.Sieger, 0, 0, 1, 1, 9);
    run.enemies.spawn(0, Role.Sieger, 0, 0, 1, 1, 4);
    run.enemies.spawn(0, Role.Sieger, 0, 0, 1, 1, 4);
    expect(run.enemies.oldestWhere(run.isBoss)).toBe(2);
    run.enemies.kill(1);
    run.enemies.kill(2);
    run.enemies.kill(3);
    expect(run.enemies.oldestWhere(run.isBoss)).toBe(-1);
  });

  it("phase mixes never contain a boss", () => {
    const data = gameData();
    const bosses = new Set(data.enemies.filter((e) => e.boss).map((e) => e.id));
    expect(bosses.size).toBe(4);
    for (const phase of data.rules.phases) {
      for (const id of Object.keys(phase.mix)) expect(bosses.has(id), id).toBe(false);
    }
    expect(bosses.has(data.rules.enemies.elite)).toBe(false);
  });

  it("same seed gives the same timeline", () => {
    const play = (seed: number) => {
      const run = newRun(seed);
      run.shieldTicks = 1_000_000; // nobody dies, so the run reaches the events
      let warnings = 0;
      let bosses = 0;
      for (let i = 0; i < 300 * TICKS_PER_SECOND; i++) {
        run.step(run.state === "levelUp" ? { ...NO_INPUT, card: 0 } : NO_INPUT);
        for (let k = 0; k < run.events.count; k++) {
          if (run.events.kind[k] === EventKind.RushWarning) warnings++;
          if (run.events.kind[k] === EventKind.BossSpawn) bosses++;
        }
      }
      return { hash: stateHash(run), warnings, bosses, next: run.nextEvent };
    };
    const a = play(7);
    expect(a.warnings).toBe(1);
    expect(a.bosses).toBe(1);
    expect(a.next).toBe(2);
    expect(play(7)).toEqual(a);
    expect(play(8).hash).not.toBe(a.hash);
  });

  describe("finale", () => {
    /** No timed events, so only the finale speaks. */
    const finaleRun = () => {
      const data = gameData();
      data.rules.events = [];
      return createRun(data, { seed: 1, durationSeconds: 5 });
    };

    it("the final boss comes at the duration as a hunter", () => {
      const run = finaleRun();
      expect(at(run, 4.9)).toEqual([]);
      expect(run.inFinale).toBe(false);
      const came = at(run, 5);
      const regent = typeOf(run, "dread-regent");
      expect(run.finalBossType).toBe(regent);
      expect(came.map((e) => [e.kind, e.value])).toEqual([[EventKind.BossSpawn, regent]]);
      expect(run.finalBossSlot).toBe(came[0]!.a);
      expect(run.enemies.role[run.finalBossSlot]).toBe(Role.Hunter);
      expect(run.inFinale).toBe(true);
      expect(at(run, 5 + 1 / TICKS_PER_SECOND)).toEqual([]);
      expect(aliveOfType(run, regent)).toHaveLength(1);
    });

    it("the final boss enrages 200 s after it came", () => {
      const run = finaleRun();
      at(run, 5);
      const slot = run.finalBossSlot;
      const before = run.enemies.damageScale[slot]!;
      expect(at(run, 204.9)).toEqual([]);
      expect(run.enraged).toBe(false);
      const seen = at(run, 205);
      expect(seen.map((e) => [e.kind, e.a])).toEqual([[EventKind.Enrage, slot]]);
      expect(run.enraged).toBe(true);
      expect(run.enemies.damageScale[slot]).toBe(before * 2);
      expect(run.slamCooldownScale).toBe(0.5);
      expect(at(run, 205 + 1 / TICKS_PER_SECOND)).toEqual([]);
      expect(run.enemies.damageScale[slot]).toBe(before * 2);
    });

    it("an enraged final boss walks faster", () => {
      const walked = (enraged: boolean) => {
        const run = enemyRun();
        const slot = spawnBoss(run, run.finalBossType, Role.Hunter);
        run.finalBossSlot = slot;
        run.enraged = enraged;
        run.enemies.x[slot] = 3000;
        run.enemies.y[slot] = 0;
        updateEnemies(run);
        return 3000 - run.enemies.x[slot]!;
      };
      expect(walked(false)).toBeGreaterThan(1);
      expect(walked(true)).toBeCloseTo(walked(false) * 1.3, 6);
    });

    it("a dead final boss never enrages", () => {
      const run = finaleRun();
      at(run, 5);
      killEnemy(run, run.finalBossSlot);
      expect(run.finalBossDead).toBe(true);
      expect(run.finalBossSlot).toBe(-1);
      expect(at(run, 205)).toEqual([]);
      expect(run.enraged).toBe(false);
      expect(run.slamCooldownScale).toBe(1);
    });

    it("bossLog records spawn and death ticks", () => {
      const run = newRun();
      expect(run.bossLog).toHaveLength(4);
      expect(run.bossLogCount).toBe(0);
      at(run, 180);
      const came = at(run, 250);
      const marshal = typeOf(run, "iron-marshal");
      expect(run.bossLogCount).toBe(1);
      expect(run.bossLog[0]).toEqual({ type: marshal, spawnTick: 250 * 30, deathTick: -1 });
      run.tick = 260 * 30;
      killEnemy(run, came[0]!.a);
      expect(run.bossLog[0]).toEqual({ type: marshal, spawnTick: 250 * 30, deathTick: 260 * 30 });
      expect(run.bossCount).toBe(0);
    });
  });
});
