import { describe, expect, it } from "vitest";
import { chestPrice } from "./chests";
import { TICKS_PER_SECOND } from "./constants";
import { difficultyMods } from "./difficulty";
import { EventKind } from "./events";
import { NO_INPUT, type TickInput } from "./input";
import { reviveShare } from "./revive";
import { createRun, type Run } from "./run";
import { gameData, openArena } from "./testing/game-data";
import { silenceSpawns } from "./testing/silence";

// Multiplayer migration step 6: a fallen hero is revived by a teammate, the run ends when all are down,
// chests and enemy strength per player.

function players(count: number): Run {
  const data = openArena(gameData());
  silenceSpawns(data);
  const heroes = ["stonehorn", "sparkshot", "mistwarden", "tidecaller"].slice(0, count).map((hero) => ({ hero }));
  return createRun(data, { seed: 3, durationSeconds: 100000, players: heroes });
}

const idle = (n: number): TickInput[] => Array.from({ length: n }, () => NO_INPUT);

function fell(run: Run, p: number): void {
  run.players[p]!.hero.hp = 0;
}

/** Puts hero `q` right next to hero `p`. */
function standBy(run: Run, q: number, p: number): void {
  const mate = run.players[q]!.hero;
  const hero = run.players[p]!.hero;
  mate.x = hero.x + 40;
  mate.y = hero.y;
}

const reviveTicks = (run: Run): number => Math.round(run.data.rules.coop.revive.seconds * TICKS_PER_SECOND);

describe("co-op revive", () => {
  it("keeps the run going while one hero stands", () => {
    const run = players(2);
    fell(run, 1);
    run.step(idle(2));
    expect(run.state).toBe("playing");
  });

  it("ends the run when every hero is down", () => {
    const run = players(2);
    fell(run, 0);
    fell(run, 1);
    run.step(idle(2));
    expect(run.state).toBe("lost");
    expect(run.result).toBe("hero");
  });

  it("revives a fallen hero after the teammate stood by him for 5 s, at half his hp", () => {
    const run = players(2);
    fell(run, 1);
    standBy(run, 0, 1);
    const needed = reviveTicks(run);
    for (let i = 0; i < needed - 1; i++) run.step(idle(2));
    expect(run.players[1]!.hero.hp).toBe(0);
    expect(reviveShare(run, 1)).toBeCloseTo((needed - 1) / needed);
    run.step(idle(2));
    const hero = run.players[1]!.hero;
    expect(hero.hp).toBeGreaterThan(0);
    expect(hero.hp / hero.stats.maxHp).toBeCloseTo(run.data.rules.coop.revive.hpShare, 1);
    expect(run.players[1]!.reviveTicks).toBe(0);
    let revived = -1;
    let by = -1;
    for (let e = 0; e < run.events.count; e++) {
      if (run.events.kind[e] !== EventKind.Revive) continue;
      revived = run.events.a[e]!;
      by = run.events.u[e]!;
    }
    expect([revived, by]).toEqual([1, 0]);
  });

  it("resets the progress when the teammate walks away", () => {
    const run = players(2);
    fell(run, 1);
    standBy(run, 0, 1);
    for (let i = 0; i < 60; i++) run.step(idle(2));
    expect(run.players[1]!.reviveTicks).toBe(60);
    run.players[0]!.hero.x += 500;
    run.step(idle(2));
    expect(run.players[1]!.reviveTicks).toBe(0);
    expect(run.players[1]!.hero.hp).toBe(0);
  });

  it("does not let a fallen hero walk or revive another fallen hero", () => {
    const run = players(3);
    fell(run, 1);
    fell(run, 2);
    standBy(run, 2, 1);
    run.players[0]!.hero.x -= 1000; // the living hero stands far away
    const hero = run.players[1]!.hero;
    const x = hero.x;
    const walk: TickInput = { ...NO_INPUT, moveX: 1 };
    for (let i = 0; i < 30; i++) run.step([NO_INPUT, walk, NO_INPUT]);
    expect(hero.x).toBe(x);
    expect(run.players[1]!.reviveTicks).toBe(0);
  });
});

describe("co-op difficulty and chests per player", () => {
  it("leaves one player at x 1", () => {
    const { rules } = gameData();
    expect(difficultyMods(rules, 1, "normal", 1)).toEqual(difficultyMods(rules, 1, "normal"));
    expect(difficultyMods(rules, 1, "normal")).toMatchObject({ hp: 1, damage: 1, packSize: rules.difficulty.levels.normal!.packSize, eliteHp: 1 });
  });

  it("adds rules.coop.perPlayer for every player after the first", () => {
    const { rules } = gameData();
    const per = rules.coop.perPlayer;
    const one = difficultyMods(rules, 3, "insane", 1);
    const three = difficultyMods(rules, 3, "insane", 3);
    expect(three.hp).toBeCloseTo(one.hp * (1 + 2 * per.hp));
    expect(three.damage).toBeCloseTo(one.damage * (1 + 2 * per.damage));
    expect(three.packSize).toBeCloseTo(one.packSize * (1 + 2 * per.packSize));
    expect(three.eliteHp).toBeCloseTo(one.eliteHp * (1 + 2 * per.eliteHp));
    expect(three.gold).toBe(one.gold);
    expect(three.magicFind).toBe(one.magicFind);
    expect(players(2).mods.hp).toBeCloseTo(1 + per.hp);
  });

  it("lays more chests for more players", () => {
    const { rules } = gameData();
    expect(players(1).chests.x.length).toBe(rules.chests.count);
    expect(players(4).chests.x.length).toBe(rules.chests.count + 3 * rules.coop.perPlayer.chests);
  });

  it("gives each player his own chest price", () => {
    const run = players(2);
    const base = chestPrice(run);
    run.current = 0;
    run.gold = 100000;
    run.hero.x = run.chests.x[0]!;
    run.hero.y = run.chests.y[0]!;
    run.step(idle(2));
    run.current = 0;
    expect(run.chestOffer).not.toBeNull();
    expect(chestPrice(run)).toBeGreaterThan(base);
    run.current = 1;
    expect(chestPrice(run)).toBe(base);
    run.current = 0;
  });
});
