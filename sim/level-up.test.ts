import { describe, expect, it } from "vitest";
import { EventKind } from "./events";
import { stateHash } from "./hash";
import { NO_INPUT } from "./input";
import { debugGrantXp, gainXp, xpToNext } from "./level-up";
import { progressionRun } from "./testing/progression-run";

describe("level-up", () => {
  it("xp curve follows the rules", () => {
    const { rules } = progressionRun().data;
    expect([1, 2, 3].map((l) => xpToNext(rules, l))).toEqual([4, 6, 8]);
  });

  it("level-up adds the per-level growth", () => {
    const run = progressionRun();
    const maxBefore = run.hero.stats.maxHp;
    const hpBefore = run.hero.hp;
    run.hero.hp = hpBefore - 50;
    gainXp(run, 5);
    const hero = run.hero;
    expect(hero.level).toBe(2);
    expect(hero.xp).toBe(1);
    expect(hero.str).toBeCloseTo(38.2, 9);
    expect(hero.agi).toBeCloseTo(22.5, 9);
    expect(hero.int).toBeCloseTo(26.3, 9);
    expect(hero.pendingLevelUps).toBe(1);
    const grown = hero.stats.maxHp - maxBefore;
    expect(grown).toBeGreaterThan(0);
    expect(hero.hp).toBeCloseTo(hpBefore - 50 + grown, 9);
    const k = run.events.kind.indexOf(EventKind.LevelUp);
    expect(k).toBeGreaterThanOrEqual(0);
    expect(run.events.a[k]).toBe(2);
    expect(run.events.x[k]).toBe(hero.x);
  });

  it("debugGrantXp behaves like gainXp", () => {
    const a = progressionRun();
    const b = progressionRun();
    gainXp(a, 9);
    debugGrantXp(b, 9);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it("level-up pauses the run with three distinct cards", () => {
    const run = progressionRun();
    gainXp(run, 4);
    run.step(NO_INPUT);
    expect(run.state).toBe("levelUp");
    const cards = run.offer!.cards;
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((c) => JSON.stringify(c))).size).toBe(3);
    const tick = run.tick;
    run.step({ moveX: 1, moveY: 1, card: -1, actions: 0 });
    expect(run.tick).toBe(tick);
    expect(run.hero.x).toBe(0);
  });

  it("chains pending level-ups", () => {
    const run = progressionRun();
    gainXp(run, 10);
    expect(run.hero.level).toBe(3);
    expect(run.hero.pendingLevelUps).toBe(2);
    run.step(NO_INPUT);
    expect(run.state).toBe("levelUp");
    const tick = run.tick;
    run.step({ moveX: 1, moveY: 0, card: -1, actions: 0 });
    expect(run.hero.x).toBe(0);
    expect(run.tick).toBe(tick);
    run.step({ moveX: 1, moveY: 0, card: 0, actions: 0 });
    expect(run.state).toBe("levelUp");
    expect(run.hero.pendingLevelUps).toBe(1);
    expect(run.offer).not.toBeNull();
    expect(run.tick).toBe(tick);
    run.step({ moveX: 1, moveY: 0, card: 0, actions: 0 });
    expect(run.state).toBe("playing");
    expect(run.offer).toBeNull();
    expect(run.hero.pendingLevelUps).toBe(0);
    expect(run.tick).toBe(tick);
  });

  it("duration does not pass during level-up", () => {
    const run = progressionRun({ durationSeconds: 2 });
    for (let i = 0; i < 58; i++) run.step(NO_INPUT);
    gainXp(run, 4);
    run.step(NO_INPUT);
    expect(run.tick).toBe(59);
    expect(run.state).toBe("levelUp");
    for (let i = 0; i < 100; i++) run.step(NO_INPUT);
    expect(run.state).toBe("levelUp");
    expect(run.tick).toBe(59);
    run.step({ moveX: 0, moveY: 0, card: 0, actions: 0 });
    expect(run.state).toBe("playing");
    run.step(NO_INPUT);
    expect(run.state).toBe("won");
  });

  it("a level-up does not revive a dead hero", () => {
    const run = progressionRun();
    run.hero.hp = -5;
    run.crystals.drop(run.hero.x, run.hero.y, 50);
    run.step(NO_INPUT);
    expect(run.hero.level).toBeGreaterThan(1);
    expect(run.hero.hp).toBeLessThanOrEqual(0);
    expect(run.result).toBe("hero");
    expect(run.state).toBe("lost");
  });
});
