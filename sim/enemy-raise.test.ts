import { describe, expect, it } from "vitest";
import { killEnemy } from "./combat";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { stateHash } from "./hash";
import { NO_INPUT } from "./input";
import { enemyRun, eventsOf, place, typeOf, type EnemyRun } from "./testing/enemy-run";

function raiseRun() {
  const run = enemyRun((d) => {
    d.enemies.find((e) => e.id === "gravebinder")!.moveSpeed = 0;
    d.rules.sustain.hearts.chance = 1;
  });
  run.hero.x = 4000;
  run.hero.y = 4000;
  return run;
}

/** Kills a fresh enemy of `id` at (x, y): its death is the corpse. */
function corpse(run: EnemyRun, id: string, x: number, y: number): void {
  killEnemy(run, place(run, id, Role.Sieger, x, y));
}

function raisedAt(run: EnemyRun): number[][] {
  return eventsOf(run, EventKind.Raise).map((k) => [run.events.x[k]!, run.events.y[k]!]);
}

describe("the gravebinder raises the fallen", () => {
  it("raises 2 risen from the 2 nearest deaths within 500 and keeps the third", () => {
    const run = raiseRun();
    corpse(run, "ghoul", 100, 0);
    corpse(run, "ghoul", 0, 200);
    corpse(run, "brute", 300, 0);
    corpse(run, "ghoul", 900, 0);
    run.tick += 60;
    const binder = place(run, "gravebinder", Role.Sieger, 0, 0);
    run.step(NO_INPUT);
    expect(raisedAt(run)).toEqual([[100, 0], [0, 200]]);
    const risen = typeOf(run, "risen");
    const slots = eventsOf(run, EventKind.Raise).map((k) => run.events.a[k]!);
    for (const slot of slots) expect(run.enemies.type[slot]).toBe(risen);
    expect(run.stats.raised).toBe(2);
    expect(run.enemies.raiseCooldown[binder]).toBe(5 * 30);
    expect(run.corpses.take(300, 0, 10, 0)).toBeGreaterThanOrEqual(0);
  });

  it("a death older than 10 s stays down", () => {
    const run = raiseRun();
    corpse(run, "ghoul", 100, 0);
    run.tick += 11 * 30;
    const binder = place(run, "gravebinder", Role.Sieger, 0, 0);
    run.step(NO_INPUT);
    expect(raisedAt(run)).toEqual([]);
    expect(run.enemies.raiseCooldown[binder]).toBe(0);
  });

  it("the deaths of the risen, elites and bosses are not remembered", () => {
    const run = raiseRun();
    corpse(run, "risen", 100, 0);
    corpse(run, "bone-tyrant", 0, 100);
    corpse(run, "captain", 0, -100);
    corpse(run, "iron-marshal", -100, 0);
    expect(run.corpses.take(0, 0, 1000, 0)).toBe(-1);
  });

  it("a killed risen gives no XP, gold or heart", () => {
    const run = raiseRun();
    const xp = run.hero.xp;
    corpse(run, "risen", 100, 0);
    expect(run.crystals.count + run.coins.count + run.hearts.count).toBe(0);
    expect(run.hero.xp).toBe(xp);
    expect(run.gold).toBe(0);
    corpse(run, "ghoul", 200, 0);
    expect(run.hearts.count).toBe(1);
  });

  it("with a full store nobody rises and nobody leaves", () => {
    const run = raiseRun();
    corpse(run, "ghoul", 100, 0);
    place(run, "gravebinder", Role.Sieger, 0, 0);
    while (run.enemies.aliveCount < run.enemies.capacity) place(run, "brute", Role.Sieger, 2000, 2000);
    run.step(NO_INPUT);
    expect(raisedAt(run)).toEqual([]);
    expect(run.enemies.aliveCount).toBe(run.enemies.capacity);
    expect(run.corpses.take(100, 0, 10, 0)).toBeGreaterThanOrEqual(0);
  });

  it("the same seed gives the same state", () => {
    const play = () => {
      const run = raiseRun();
      place(run, "gravebinder", Role.Sieger, 0, 0);
      for (let k = 0; k < 6; k++) corpse(run, "ghoul", 60 * k, 100);
      for (let i = 0; i < 300; i++) run.step(NO_INPUT);
      return stateHash(run);
    };
    expect(play()).toBe(play());
  });
});
