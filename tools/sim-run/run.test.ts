import { describe, expect, it } from "vitest";
import { botInput } from "../../sim/bot";
import { createRun } from "../../sim/index";
import type { TickInput } from "../../sim/input";
import { gameData } from "../../sim/testing/game-data";
import { formatHeroSummary, formatSummary, idleInput, lossWindows, parseArgs, phaseXpLine, playBot, type RunSummary } from "./run";

describe("formatSummary", () => {
  it("formats a lost run", () => {
    expect(
      formatSummary({
        hero: "stonehorn", seed: 1, result: "castle", seconds: 134, kills: 63, spawned: 320, level: 7,
        castleHp: 0, castleMaxHp: 3000, castleHpPercent: 0, heroHp: 812, heroMaxHp: 1555, minHeroHpPercent: 42,
        bosses: [], enraged: false, phaseXp: [0],
      }),
    ).toBe(
      "stonehorn seed 1: lost (castle) at 2:14, kills 63, spawned 320, level 7, castle 0%, hero 812/1555, hero low 42%",
    );
  });

  it("formats a won run", () => {
    expect(
      formatSummary({
        hero: "nightglaive", seed: 2, result: "won", seconds: 180, kills: 5, spawned: 9, level: 2,
        castleHp: 1860, castleMaxHp: 3000, castleHpPercent: 62, heroHp: 1, heroMaxHp: 2, minHeroHpPercent: 0,
        bosses: [], enraged: false, phaseXp: [0],
      }),
    ).toBe("nightglaive seed 2: won at 3:00, kills 5, spawned 9, level 2, castle 62%, hero 1/2, hero low 0%");
  });
});

const summary = (over: Partial<RunSummary>): RunSummary => ({
  hero: "stonehorn", seed: 1, result: "won", seconds: 1040, kills: 1, spawned: 2, level: 3,
  castleHp: 1, castleMaxHp: 2, castleHpPercent: 50, heroHp: 1, heroMaxHp: 2, minHeroHpPercent: 10,
  bosses: [], enraged: false, phaseXp: [0], ...over,
});

describe("summaries of the full run", () => {
  it("a run line lists its bosses and the enrage", () => {
    const line = formatSummary(summary({
      bosses: [
        { id: "iron-marshal", spawnSeconds: 250, killSeconds: 281 },
        { id: "pale-abbot", spawnSeconds: 500, killSeconds: null },
      ],
      enraged: true,
    }));
    expect(line).toContain("bosses: iron-marshal 31 s, pale-abbot alive");
    expect(line.endsWith(", enraged")).toBe(true);
  });

  it("parses --seeds 3-7", () => {
    expect(parseArgs(["--seeds", "3-7"])).toMatchObject({ seed: 3, runs: 5 });
    expect(parseArgs(["--seed", "4", "--runs", "2"])).toMatchObject({ seed: 4, runs: 2 });
    expect(parseArgs(["--hero", "stonehorn", "--phase", "6", "--phase-xp", "--idle"])).toMatchObject({
      hero: "stonehorn", phase: 6, phaseXp: true, idle: true,
    });
    expect(() => parseArgs(["--seeds", "7-3"])).toThrow("--seeds");
    expect(() => parseArgs(["--seeds", "x"])).toThrow("--seeds");
  });

  it("a summary lists boss kill times", () => {
    const s = playBot(gameData(), 1, 260, "stonehorn", false, 6);
    expect(s.bosses[0]).toMatchObject({ id: "iron-marshal", spawnSeconds: 250 });
    expect(s.phaseXp).toHaveLength(6);
    const runs = [
      summary({ bosses: [{ id: "iron-marshal", spawnSeconds: 250, killSeconds: 270 }, { id: "dread-regent", spawnSeconds: 1000, killSeconds: 1040 }] }),
      summary({ bosses: [{ id: "iron-marshal", spawnSeconds: 250, killSeconds: 290 }, { id: "dread-regent", spawnSeconds: 1000, killSeconds: 1090 }], seconds: 1090, enraged: true }),
      summary({ bosses: [{ id: "iron-marshal", spawnSeconds: 250, killSeconds: 300 }, { id: "dread-regent", spawnSeconds: 1000, killSeconds: null }], result: "hero", seconds: 1010 }),
      summary({ bosses: [{ id: "iron-marshal", spawnSeconds: 250, killSeconds: null }], result: "castle", seconds: 260 }),
    ];
    const text = formatHeroSummary("stonehorn", runs, false, "dread-regent");
    expect(text).toContain("4 runs: 2 won, 2 lost");
    expect(text).toContain("boss kill median: iron-marshal 40 s (3 of 4)");
    expect(text).toContain("final boss fight median 65 s");
    expect(text).toContain("enraged in 1");
    expect(text).toContain("losses by minutes: 4-6: 1, 6-8: 0, 8-10: 0, 10-12: 0, 12-14: 0, 14-16: 0, 16-18: 1");
  });

  it("loss windows count losses per two minutes", () => {
    const runs = [
      summary({ result: "castle", seconds: 119 }),
      summary({ result: "hero", seconds: 120 }),
      summary({ result: "won", seconds: 400 }),
      summary({ result: "castle", seconds: 130 }),
    ];
    expect(lossWindows(runs)).toBe("0-2: 1, 2-4: 2");
    expect(lossWindows([summary({})])).toBe("none");
  });

  it("--phase-xp prints one value per phase", () => {
    const runs = [summary({ phaseXp: [0, 10, 30] }), summary({ phaseXp: [0, 21] })];
    expect(phaseXpLine(runs, 4)).toBe("[0, 16, 30, 30]");
  });
});

describe("playBot", () => {
  it("reports the lowest hero hp of the run in whole percent", () => {
    const s = playBot(gameData(), 1, 60);
    expect(Number.isInteger(s.minHeroHpPercent)).toBe(true);
    expect(s.minHeroHpPercent).toBeGreaterThanOrEqual(0);
    expect(s.minHeroHpPercent).toBeLessThanOrEqual(100);
    expect(s.minHeroHpPercent).toBeLessThanOrEqual(Math.ceil((100 * s.heroHp) / s.heroMaxHp));
  });

  it("idle input never moves or acts and takes an attribute card", () => {
    const run = createRun(gameData(), { seed: 1 });
    const input: TickInput = { moveX: 1, moveY: -1, card: 2, actions: 7 };
    expect(idleInput(run, input)).toEqual({ moveX: 0, moveY: 0, card: -1, actions: 0 });
    run.hero.pendingLevelUps = 1;
    run.step(input);
    expect(run.state).toBe("levelUp");
    const card = idleInput(run, input).card;
    expect(run.offer!.cards[card]!.kind).toBe("attribute");
    expect(input.moveX).toBe(0);
  });

  it("an idle run differs from the autopilot run", () => {
    const bot = playBot(gameData(), 1, 60, "stonehorn");
    const idle = playBot(gameData(), 1, 60, "stonehorn", true);
    expect(idle.hero).toBe("stonehorn");
    expect([idle.kills, idle.level, idle.heroHp]).not.toEqual([bot.kills, bot.level, bot.heroHp]);
  });
});

describe("bot run speed", () => {
  for (const { id } of gameData().heroes) {
    it(`a full run stays fast (${id})`, () => {
      const run = createRun(gameData(), { seed: 1, durationSeconds: 300, hero: id });
      const input: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
      const start = performance.now();
      let steps = 0;
      while (steps < 9000 && run.state !== "won" && run.state !== "lost") {
        botInput(run, input);
        run.step(input);
        steps++;
      }
      const elapsed = performance.now() - start;
      expect(steps).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(8000);
    });
  }

  it("a full run with the late phases at full size stays fast", () => {
    const run = createRun(gameData(), { seed: 1, durationSeconds: 300 });
    const input: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
    const start = performance.now();
    // the hero and the castle cannot fall, so the run lasts its 300 s and the fight with the final boss
    while (run.state !== "won" && run.state !== "lost") {
      botInput(run, input);
      run.hero.hp = run.hero.stats.maxHp;
      run.castle.hp = run.castle.maxHp;
      run.step(input);
    }
    expect(run.state).toBe("won");
    expect(run.tick).toBeGreaterThan(300 * 30);
    expect(performance.now() - start).toBeLessThan(8000);
  });
});
