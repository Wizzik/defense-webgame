import { describe, expect, it } from "vitest";
import { botInput, idleCard } from "../../sim/bot";
import { createRun } from "../../sim/index";
import type { TickInput } from "../../sim/input";
import { gameData } from "../../sim/testing/game-data";
import { worldLine, factionLine, formatHeroSummary, formatSummary, idleInput, kitLine, lossWindows, parseArgs, phaseXpLine, playBot, type RunSummary, sustainLine } from "./run";

describe("formatSummary", () => {
  it("formats a lost run", () => {
    expect(
      formatSummary({
        hero: "stonehorn", seed: 1, result: "castle", seconds: 134, kills: 63, spawned: 320, level: 7,
        castleHp: 0, castleMaxHp: 3000, castleHpPercent: 0, heroHp: 812, heroMaxHp: 1555, minHeroHpPercent: 42,
        bosses: [], enraged: false, phaseXp: [0], chests: 4, gold: 321, sharedSpells: [], passives: [], fullKitPhase: null, burst: [null, null, null, null], attack: [null, null, null, null],
        sustain: { hearts: 0, orbsBoots: 0, orbsBerserk: 0, orbsHeal: 0, healedLifesteal: 0, healedHearts: 0, healedOrb: 0 },
        factions: { rootedSeconds: 0, cloudDamage: 0, raised: 0 }, world: { islands: 0, waves: 0, bolts: 0, boltHits: 0 },
      }),
    ).toBe(
      "stonehorn seed 1: lost (castle) at 2:14, kills 63, spawned 320, level 7, castle 0%, hero 812/1555, hero low 42%, chests 4, gold 321",
    );
  });

  it("formats a won run", () => {
    expect(
      formatSummary({
        hero: "nightglaive", seed: 2, result: "won", seconds: 180, kills: 5, spawned: 9, level: 2,
        castleHp: 1860, castleMaxHp: 3000, castleHpPercent: 62, heroHp: 1, heroMaxHp: 2, minHeroHpPercent: 0,
        bosses: [], enraged: false, phaseXp: [0], chests: 4, gold: 321, sharedSpells: [], passives: [], fullKitPhase: null, burst: [null, null, null, null], attack: [null, null, null, null],
        sustain: { hearts: 0, orbsBoots: 0, orbsBerserk: 0, orbsHeal: 0, healedLifesteal: 0, healedHearts: 0, healedOrb: 0 },
        factions: { rootedSeconds: 0, cloudDamage: 0, raised: 0 }, world: { islands: 0, waves: 0, bolts: 0, boltHits: 0 },
      }),
    ).toBe("nightglaive seed 2: won at 3:00, kills 5, spawned 9, level 2, castle 62%, hero 1/2, hero low 0%, chests 4, gold 321");
  });
});

const summary = (over: Partial<RunSummary>): RunSummary => ({
  hero: "stonehorn", seed: 1, result: "won", seconds: 1040, kills: 1, spawned: 2, level: 3,
  castleHp: 1, castleMaxHp: 2, castleHpPercent: 50, heroHp: 1, heroMaxHp: 2, minHeroHpPercent: 10,
  bosses: [], enraged: false, phaseXp: [0], chests: 0, gold: 0, sharedSpells: [], passives: [], fullKitPhase: null, burst: [null, null, null, null], attack: [null, null, null, null],
  sustain: { hearts: 0, orbsBoots: 0, orbsBerserk: 0, orbsHeal: 0, healedLifesteal: 0, healedHearts: 0, healedOrb: 0 },
        factions: { rootedSeconds: 0, cloudDamage: 0, raised: 0 }, world: { islands: 0, waves: 0, bolts: 0, boltHits: 0 }, ...over,
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

  it("parses worlds and difficulties", () => {
    expect(parseArgs([])).toMatchObject({ worlds: [1], difficulties: ["normal"] });
    expect(parseArgs(["--world", "all", "--difficulty", "hell"])).toMatchObject({ worlds: [1, 2, 3, 4, 5], difficulties: ["hell"] });
    expect(parseArgs(["--world", "3", "--difficulty", "all"])).toMatchObject({ worlds: [3], difficulties: ["normal", "insane", "hell"] });
    expect(() => parseArgs(["--world", "7"])).toThrow("--world");
    expect(() => parseArgs(["--world", "0"])).toThrow("--world");
    expect(() => parseArgs(["--difficulty", "nightmare"])).toThrow("--difficulty");
  });

  it("a summary lists boss kill times", () => {
    const s = playBot(gameData(), 1, 260, "stonehorn", false, 6);
    expect(s.bosses[0]).toMatchObject({ id: "iron-marshal", spawnSeconds: 250 });
    // the run starts in phase 6, so the phases before it show the XP the start gave
    expect(s.phaseXp.length).toBeGreaterThanOrEqual(6);
    expect(new Set(s.phaseXp.slice(0, 6)).size).toBe(1);
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

  it("the kit line counts the picks and gives the median full-kit phase", () => {
    const runs = [
      summary({ sharedSpells: ["meteor", "smite"], passives: ["might"], fullKitPhase: 15 }),
      summary({ sharedSpells: ["smite", "frost-ring"], passives: ["vigor", "might"], fullKitPhase: 17 }),
      summary({ sharedSpells: ["smite"], passives: [], fullKitPhase: null }),
    ];
    expect(kitLine(runs)).toBe(
      "  shared spells: smite 3, frost-ring 1, meteor 1; passives: might 2, vigor 1; full kit median phase 16 (2 of 3)",
    );
    expect(kitLine([summary({})])).toBe("  shared spells: -; passives: -; full kit median phase - (0 of 1)");
    expect(formatHeroSummary("stonehorn", runs, false, "dread-regent")).toContain("full kit median phase 16");
  });

  it("a played run reports the shared spells and passives it learned", () => {
    const runs = [1, 2, 3].map((seed) => playBot(gameData(), seed, 120, "stonehorn"));
    expect(runs.some((s) => s.sharedSpells.length + s.passives.length > 0)).toBe(true);
    for (const s of runs) {
      for (const id of s.sharedSpells) expect(gameData().rules.progression.sharedSpells).toContain(id);
      for (const id of s.passives) expect(gameData().rules.progression.passives).toContain(id);
    }
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

  it("idle input never moves or acts and takes the weakest card", () => {
    const run = createRun(gameData(), { seed: 1 });
    const input: TickInput = { moveX: 1, moveY: -1, card: 2, actions: 7 };
    expect(idleInput(run, input)).toEqual({ moveX: 0, moveY: 0, card: -1, actions: 0 });
    run.hero.pendingLevelUps = 1;
    run.step(input);
    expect(run.state).toBe("levelUp");
    const card = idleInput(run, input).card;
    expect(card).toBe(idleCard(run, run.offer!));
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

describe("chests in the summaries", () => {
  it("a hero summary gives the average chests of all and of won runs, and the average gold", () => {
    const text = formatHeroSummary("stonehorn", [
      summary({ chests: 10, gold: 900 }),
      summary({ chests: 14, gold: 1100 }),
      summary({ result: "castle", chests: 3, gold: 400 }),
    ], false, "dread-regent");
    expect(text).toContain("chests avg 9.0 (won runs 12.0), gold avg 800");
  });

  it("a played run reports its chests and gold", () => {
    const s = playBot(gameData(), 1, 300);
    expect(s.gold).toBeGreaterThan(0);
    expect(s.chests).toBeGreaterThan(0);
  });

  it("idle input takes the first card of a chest", () => {
    const run = createRun(gameData(), { seed: 1 });
    run.chestOffer = { cards: [1, 2, 3].map((slot) => ({ slot, item: 0, action: 0 as const })) };
    run.state = "chest";
    expect(idleInput(run, { moveX: 0, moveY: 0, card: -1, actions: 0 }).card).toBe(0);
  });
});

describe("sustain in the summaries", () => {
  it("sustainLine gives the averages per run", () => {
    const line = sustainLine([
      summary({ sustain: { hearts: 20, orbsBoots: 4, orbsBerserk: 3, orbsHeal: 2, healedLifesteal: 800, healedHearts: 1900, healedOrb: 2000 } }),
      summary({ sustain: { hearts: 26.2, orbsBoots: 4.4, orbsBerserk: 5, orbsHeal: 4.2, healedLifesteal: 824, healedHearts: 1908, healedOrb: 2420 } }),
    ]);
    expect(line).toBe("  sustain: hearts 23.1, orbs boots 4.2 berserk 4.0 heal 3.1, healed lifesteal 812 hearts 1904 orb 2210");
  });

  it("a hero summary ends with the sustain line", () => {
    expect(formatHeroSummary("stonehorn", [summary({})], false, "dread-regent")).toContain("\n  sustain: hearts 0.0,");
  });

  it("a played run reports hearts and orbs", () => {
    const s = playBot(gameData(), 1, 300);
    expect(s.sustain.hearts).toBeGreaterThan(0);
    expect(s.sustain.orbsBoots + s.sustain.orbsBerserk + s.sustain.orbsHeal).toBeGreaterThan(0);
  });
});

describe("factions in the summaries", () => {
  it("factionLine gives the averages per run", () => {
    const line = factionLine([
      summary({ factions: { rootedSeconds: 3, cloudDamage: 800, raised: 10 } }),
      summary({ factions: { rootedSeconds: 4.2, cloudDamage: 1000, raised: 13 } }),
    ]);
    expect(line).toBe("  factions: rooted 3.6 s, cloud hp 900, raised 11.5");
  });

  it("a hero summary ends with the factions line", () => {
    expect(formatHeroSummary("stonehorn", [summary({})], false, "dread-regent")).toMatch(/\n  sustain: [^\n]*\n  factions: rooted 0\.0 s/);
  });
});

describe("the world in the summaries", () => {
  it("worldLine gives the averages per run", () => {
    const line = worldLine([
      summary({ world: { islands: 34, waves: 20, bolts: 41, boltHits: 3 } }),
      summary({ world: { islands: 37, waves: 22, bolts: 44, boltHits: 4 } }),
    ]);
    expect(line).toBe("  world: islands 35.5, storm waves 21.0, bolts 42.5, bolts on the hero 3.5");
  });

  it("worldLine adds the sandstorms in a weather world and the thicket share in a thicket world", () => {
    const sand = worldLine([
      summary({ world: { islands: 30, waves: 2, bolts: 0, boltHits: 0, kind: "weather", sand: 2, thicketShare: 0 } }),
      summary({ world: { islands: 32, waves: 3, bolts: 0, boltHits: 0, kind: "weather", sand: 3, thicketShare: 0 } }),
    ]);
    expect(sand).toBe("  world: islands 31.0, storm waves 2.5, bolts 0.0, bolts on the hero 0.0, sand 2.5");
    const wood = worldLine([summary({ world: { islands: 40, waves: 0, bolts: 0, boltHits: 0, kind: "thicket", sand: 0, thicketShare: 0.042 } })]);
    expect(wood).toBe("  world: islands 40.0, storm waves 0.0, bolts 0.0, bolts on the hero 0.0, thicket 4.2 %");
  });

  it("worldLine names the blizzards and the chilled share in a snow world", () => {
    const snow = worldLine([summary({ world: { islands: 34, waves: 3, bolts: 0, boltHits: 0, kind: "weather", effect: "snow", sand: 3, thicketShare: 0, chillShare: 0.025 } })]);
    expect(snow).toBe("  world: islands 34.0, storm waves 3.0, bolts 0.0, bolts on the hero 0.0, snow 3.0, chill 2.5 %");
  });

  it("worldLine names the meteors, their hits and the hero's seconds in fire in a meteors world", () => {
    const fire = worldLine([summary({ world: { islands: 35, waves: 50, bolts: 220, boltHits: 6, kind: "meteors", sand: 0, thicketShare: 0, fireSeconds: 7.5 } })]);
    expect(fire).toBe("  world: islands 35.0, meteor waves 50.0, meteors 220.0, meteors on the hero 6.0, fire 7.5 s");
  });

  it("playBot counts the hero's seconds in fire in world 5", () => {
    const fire = playBot(gameData(), 1, 300, "stonehorn", false, undefined, [], 5);
    expect(fire.world.kind).toBe("meteors");
    expect(fire.world.bolts).toBeGreaterThan(0);
    expect(fire.world.fireSeconds).toBeGreaterThanOrEqual(0);
  });

  it("playBot counts the blizzards of world 4", () => {
    const snow = playBot(gameData(), 1, 400, "stonehorn", false, 2, [], 4);
    expect(snow.world.effect).toBe("snow");
    expect(snow.world.sand).toBeGreaterThanOrEqual(1);
    expect(snow.world.chillShare).toBeGreaterThanOrEqual(0);
  });

  it("playBot counts the sandstorms of world 2 and the thicket steps of world 3", () => {
    const sand = playBot(gameData(), 1, 400, "stonehorn", false, 2, [], 2);
    expect(sand.world.kind).toBe("weather");
    expect(sand.world.sand).toBeGreaterThanOrEqual(1);
    const wood = playBot(gameData(), 1, 200, "stonehorn", false, undefined, [], 3);
    expect(wood.world.kind).toBe("thicket");
    expect(wood.world.thicketShare).toBeGreaterThanOrEqual(0);
    expect(wood.world.thicketShare).toBeLessThanOrEqual(1);
  });

  it("a hero summary ends with the world line", () => {
    expect(formatHeroSummary("stonehorn", [summary({})], false, "dread-regent")).toMatch(/\n  factions: [^\n]*\n  world: islands 0\.0/);
  });

  it("playBot counts the islands and the storm", () => {
    const s = playBot(gameData(), 1, 200, "stonehorn");
    expect(s.world.islands).toBeGreaterThanOrEqual(30);
    expect(s.world.waves).toBeGreaterThanOrEqual(1);
    expect(s.world.bolts).toBeGreaterThanOrEqual(s.world.waves);
  });
});
