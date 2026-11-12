import { describe, expect, it } from "vitest";
import { killEnemy } from "./combat";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { stateHash } from "./hash";
import { NO_INPUT } from "./input";
import { gainXp } from "./level-up";
import { createRun } from "./run";
import { spawnBoss } from "./timeline";
import { gameData } from "./testing/game-data";
import { silenceSpawns } from "./testing/silence";

function newRun(durationSeconds = 100) {
  const data = gameData();
  data.rules.arena.width = 6000;
  data.rules.arena.height = 5000;
  data.rules.arena.heroStart = { x: 0, y: 0 };
  data.rules.arena.castle = { x: 0, y: -2000 };
  data.rules.hero.collision = 32;
  // Nobody spawns, so no enemy pushes the hero.
  silenceSpawns(data);
  // The movement tests count in world units, so the hero speed is pinned.
  for (const hero of data.heroes) hero.moveSpeed = 300;
  return createRun(data, { seed: 1, durationSeconds });
}

describe("gameData", () => {
  it("returns independent copies", () => {
    const a = gameData();
    a.rules.hero.collision = 1;
    expect(gameData().rules.hero.collision).not.toBe(1);
  });
});

describe("Run", () => {
  it("hero moves north at move speed", () => {
    const run = newRun();
    for (let i = 0; i < 30; i++) run.step({ moveX: 0, moveY: 1, card: -1, actions: 0 });
    expect(run.hero.y).toBeCloseTo(300, 6);
    expect(run.hero.x).toBe(0);
    expect(run.hero.moving).toBe(true);
    expect(run.hero.facingY).toBe(1);
  });

  it("diagonal speed is normalized", () => {
    const run = newRun();
    for (let i = 0; i < 30; i++) run.step({ moveX: 1, moveY: 1, card: -1, actions: 0 });
    expect(run.hero.x).toBeCloseTo(300 / Math.SQRT2, 6);
    expect(run.hero.y).toBeCloseTo(300 / Math.SQRT2, 6);
  });

  it("hero stays inside the arena", () => {
    const run = newRun(1000);
    for (let i = 0; i < 600; i++) run.step({ moveX: 1, moveY: 1, card: -1, actions: 0 });
    expect(run.hero.x).toBe(3000 - 32);
    expect(run.hero.y).toBe(2500 - 32);
    for (let i = 0; i < 900; i++) run.step({ moveX: -1, moveY: -1, card: -1, actions: 0 });
    expect(run.hero.x).toBe(-(3000 - 32));
    expect(run.hero.y).toBe(-(2500 - 32));
  });

  it("the run goes on after the duration until the final boss falls", () => {
    const run = newRun(2);
    for (let i = 0; i < 60; i++) run.step(NO_INPUT);
    expect(run.state).toBe("playing");
    expect(run.inFinale).toBe(true);
    expect(run.finalBossSlot).toBe(-1);
    run.step(NO_INPUT);
    expect(run.finalBossSlot).toBeGreaterThanOrEqual(0);
    expect(run.enemies.type[run.finalBossSlot]).toBe(run.finalBossType);
    for (let i = 0; i < 100; i++) run.step(NO_INPUT);
    expect(run.state).toBe("playing");
    expect(run.result).toBeNull();
  });

  /** A run in its finale: the final boss has come and stands far from the hero. */
  function finaleRun() {
    const run = newRun(1);
    for (let i = 0; i < 31; i++) run.step(NO_INPUT);
    expect(run.finalBossSlot).toBeGreaterThanOrEqual(0);
    return run;
  }

  it("killing the final boss wins the run", () => {
    const run = finaleRun();
    killEnemy(run, run.finalBossSlot);
    expect(run.finalBossDead).toBe(true);
    expect(run.state).toBe("playing");
    run.step(NO_INPUT);
    expect(run.state).toBe("won");
    expect(run.result).toBe("won");
    const ends = [];
    for (let k = 0; k < run.events.count; k++) if (run.events.kind[k] === EventKind.RunEnd) ends.push(run.events.a[k]);
    expect(ends).toEqual([0]);
  });

  it("a level-up in the step the final boss dies does not open an offer", () => {
    const run = finaleRun();
    killEnemy(run, run.finalBossSlot);
    gainXp(run, 1000);
    expect(run.hero.pendingLevelUps).toBeGreaterThan(0);
    run.step(NO_INPUT);
    expect(run.state).toBe("won");
    expect(run.offer).toBeNull();
  });

  it("a castle that falls in the step the final boss dies loses the run", () => {
    const run = finaleRun();
    killEnemy(run, run.finalBossSlot);
    run.castle.hp = 0;
    run.step(NO_INPUT);
    expect(run.state).toBe("lost");
    expect(run.result).toBe("castle");
  });

  it("a hero who falls in the step the final boss dies loses the run", () => {
    const run = finaleRun();
    killEnemy(run, run.finalBossSlot);
    run.hero.hp = -1000;
    run.step(NO_INPUT);
    expect(run.state).toBe("lost");
    expect(run.result).toBe("hero");
  });

  it("a living miniboss does not block the win", () => {
    const run = finaleRun();
    const mini = spawnBoss(run, run.data.enemies.findIndex((e) => e.id === "iron-marshal"), Role.Sieger);
    killEnemy(run, run.finalBossSlot);
    run.step(NO_INPUT);
    expect(run.enemies.alive[mini]).toBe(1);
    expect(run.state).toBe("won");
  });

  it("killing a miniboss does not win the run", () => {
    const run = finaleRun();
    const mini = spawnBoss(run, run.data.enemies.findIndex((e) => e.id === "iron-marshal"), Role.Sieger);
    killEnemy(run, mini);
    run.step(NO_INPUT);
    expect(run.state).toBe("playing");
  });

  it("step after the end does nothing", () => {
    const run = finaleRun();
    killEnemy(run, run.finalBossSlot);
    run.step(NO_INPUT);
    expect(run.state).toBe("won");
    const before = stateHash(run);
    run.step({ moveX: 1, moveY: 1, card: -1, actions: 0 });
    expect(stateHash(run)).toBe(before);
    expect(run.tick).toBe(32);
  });

  it("saves previous positions for interpolation", () => {
    const run = newRun();
    run.step({ moveX: 0, moveY: 1, card: -1, actions: 0 });
    run.step({ moveX: 0, moveY: 1, card: -1, actions: 0 });
    expect(run.hero.prevY).toBeCloseTo(10, 6);
    expect(run.hero.y).toBeCloseTo(20, 6);
  });
});
