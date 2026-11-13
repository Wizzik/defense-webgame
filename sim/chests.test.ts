import { describe, expect, it } from "vitest";
import { botInput } from "./bot";
import { chestPrice } from "./chests";
import { EventKind } from "./events";
import { SLOT_COUNT, slotTypeOf } from "./gear";
import { stateHash } from "./hash";
import { NO_INPUT } from "./input";
import type { TickInput } from "./input";
import { createRun } from "./run";
import type { Run } from "./run";
import { gameData } from "./testing/game-data";
import { silenceSpawns } from "./testing/silence";

const { basePrice: BASE, priceGrowth: GROWTH } = gameData().rules.chests;

function quietRun(seed = 3): Run {
  const data = gameData();
  silenceSpawns(data);
  return createRun(data, { seed, durationSeconds: 100000 });
}

function pick(index: number): TickInput {
  return { moveX: 0, moveY: 0, card: index, actions: 0 };
}

function standOnChest(run: Run, chest = 0): void {
  run.hero.x = run.chests.x[chest]!;
  run.hero.y = run.chests.y[chest]!;
}

function kinds(run: Run): number[] {
  return Array.from(run.events.kind.subarray(0, run.events.count));
}

describe("chests", () => {
  it("three chests lie away from the castle, inside the arena and apart; the seed decides where", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const run = quietRun(seed);
      const { chests: rules, arena } = run.data.rules;
      expect(run.chests.x.length).toBe(3);
      for (let i = 0; i < 3; i++) {
        const dx = run.chests.x[i]! - run.castle.x;
        const dy = run.chests.y[i]! - run.castle.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        expect(d).toBeGreaterThanOrEqual(rules.minCastleDistance);
        expect(d).toBeLessThanOrEqual(rules.maxCastleDistance);
        expect(Math.abs(run.chests.x[i]!)).toBeLessThan(arena.width / 2);
        expect(Math.abs(run.chests.y[i]!)).toBeLessThan(arena.height / 2);
        for (let j = 0; j < i; j++) {
          const sx = run.chests.x[i]! - run.chests.x[j]!;
          const sy = run.chests.y[i]! - run.chests.y[j]!;
          expect(Math.sqrt(sx * sx + sy * sy)).toBeGreaterThanOrEqual(rules.minSpacing);
        }
      }
      const again = quietRun(seed);
      expect(Array.from(again.chests.x)).toEqual(Array.from(run.chests.x));
      expect(Array.from(again.chests.y)).toEqual(Array.from(run.chests.y));
    }
    expect(Array.from(quietRun(1).chests.x)).not.toEqual(Array.from(quietRun(2).chests.x));
  });

  it("chests do not change what the enemies of a seed do", () => {
    const withChests = createRun(gameData(), { seed: 5 });
    const data = gameData();
    data.rules.chests.maxCastleDistance = 900; // other places, the same enemies
    const moved = createRun(data, { seed: 5 });
    for (let i = 0; i < 300; i++) {
      withChests.step(NO_INPUT);
      moved.step(NO_INPUT);
    }
    expect(moved.rng.state).toBe(withChests.rng.state);
    expect(moved.stats.spawned).toBe(withChests.stats.spawned);
  });

  it("a hero without the gold stands on a chest and nothing happens", () => {
    const run = quietRun();
    standOnChest(run);
    const price = chestPrice(run);
    run.gold = price - 1;
    run.step(NO_INPUT);
    expect(run.state).toBe("playing");
    expect(run.gold).toBe(price - 1);
    expect(run.chestsOpened).toBe(0);
  });

  it("a hero with the gold opens the chest: the price is paid and three different slots are offered", () => {
    const run = quietRun();
    standOnChest(run);
    run.gold = BASE + 60;
    expect(chestPrice(run)).toBe(BASE);
    run.step(NO_INPUT);
    expect(run.state).toBe("chest");
    expect(run.gold).toBe(60);
    expect(run.chestsOpened).toBe(1);
    const slots = run.chestOffer!.slots;
    expect(slots.length).toBe(3);
    expect(new Set(slots).size).toBe(3);
    for (const slot of slots) expect(slot >= 0 && slot < SLOT_COUNT).toBe(true);
    expect(kinds(run)).toContain(EventKind.ChestOpen);
    const tick = run.tick;
    run.step(NO_INPUT);
    expect(run.tick).toBe(tick); // time stands still until a slot is chosen
    expect(run.state).toBe("chest");
  });

  it("an empty slot gets the common item of its type as a temporary level 1", () => {
    const run = quietRun();
    standOnChest(run);
    run.gold = BASE + 60;
    const hpBefore = run.hero.stats.maxHp;
    const where = { x: run.chests.x[0]!, y: run.chests.y[0]! };
    run.step(NO_INPUT);
    const slot = run.chestOffer!.slots[1]!;
    run.step(pick(1));
    expect(run.state).toBe("playing");
    expect(run.chestOffer).toBeNull();
    const item = run.data.items[run.gear.item[slot]!]!;
    expect(item.rarity).toBe("common");
    expect(item.slotType).toBe(slotTypeOf(slot));
    expect(run.gear.base[slot]).toBe(0);
    expect(run.gear.temp[slot]).toBe(1);
    const bonus = run.hero.gear[item.stats[0]!.stat];
    expect(bonus).toBeCloseTo(item.stats[0]!.value, 9);
    if (item.stats[0]!.stat === "hp") expect(run.hero.stats.maxHp).toBeGreaterThan(hpBefore);
    expect(kinds(run)).toEqual(expect.arrayContaining([EventKind.ChestPick, EventKind.ChestSpawn]));
    const dx = run.chests.x[0]! - where.x;
    const dy = run.chests.y[0]! - where.y;
    expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThanOrEqual(run.data.rules.chests.minSpacing);
    expect(chestPrice(run)).toBe(Math.round(BASE * GROWTH));
  });

  it("a worn slot gains a temporary level and the stats follow", () => {
    const data = gameData();
    silenceSpawns(data);
    data.rules.chests.slotsPerOffer = 16;
    const boots = data.items.find((i) => i.slotType === "feet")!;
    const run = createRun(data, { seed: 3, durationSeconds: 100000, loadout: [{ slot: "feet", item: boots.id, level: 2 }] });
    const speed = run.hero.stats.moveSpeed;
    standOnChest(run);
    run.gold = BASE + 60;
    run.step(NO_INPUT);
    const feet = 9;
    run.step(pick(run.chestOffer!.slots.indexOf(feet)));
    expect(run.gear.base[feet]).toBe(2);
    expect(run.gear.temp[feet]).toBe(1);
    expect(run.hero.gear.moveSpeed).toBeCloseTo(boots.stats[0]!.value * (1 + 0.15 * 2), 9);
    expect(run.hero.stats.moveSpeed).toBeGreaterThan(speed);
  });

  it("the price grows with every chest opened", () => {
    const run = quietRun();
    run.gold = 100000;
    const prices: number[] = [];
    for (let n = 0; n < 4; n++) {
      prices.push(chestPrice(run));
      standOnChest(run, n % 3);
      run.step(NO_INPUT);
      run.step(pick(0));
    }
    expect(prices).toEqual([BASE, Math.round(BASE * GROWTH), Math.round(BASE * GROWTH * GROWTH), Math.round(BASE * GROWTH * GROWTH * GROWTH)]);
    expect(run.gold).toBe(100000 - prices.reduce((a, b) => a + b, 0));
  });

  it("a choice that is not an offered index changes nothing", () => {
    const run = quietRun();
    standOnChest(run);
    run.gold = BASE + 60;
    run.step(NO_INPUT);
    const hash = stateHash(run);
    for (const bad of [-1, 3, 1.5, Number.NaN]) {
      run.step(pick(bad));
      expect(run.state).toBe("chest");
      expect(stateHash(run)).toBe(hash);
    }
  });

  it("a level-up comes first: the chest opens after the cards are done", () => {
    const run = quietRun();
    standOnChest(run);
    run.gold = BASE + 60;
    run.hero.pendingLevelUps = 2;
    run.step(NO_INPUT);
    expect(run.state).toBe("levelUp");
    expect(run.gold).toBe(BASE + 60);
    run.step(pick(0));
    expect(run.state).toBe("levelUp");
    run.step(pick(0));
    expect(run.state).toBe("playing");
    expect(run.gold).toBe(BASE + 60);
    run.step(NO_INPUT);
    expect(run.state).toBe("chest");
    expect(run.gold).toBe(60);
  });

  it("a hero who dies on a chest loses the run and pays nothing", () => {
    const run = quietRun();
    standOnChest(run);
    run.gold = BASE + 60;
    run.hero.hp = 0;
    run.step(NO_INPUT);
    expect(run.state).toBe("lost");
    expect(run.result).toBe("hero");
    expect(run.chestOffer).toBeNull();
    expect(run.gold).toBe(BASE + 60);
  });

  it("a castle that falls in the step of a chest loses the run", () => {
    const run = quietRun();
    standOnChest(run);
    run.gold = BASE + 60;
    run.castle.hp = 0;
    run.step(NO_INPUT);
    expect(run.state).toBe("lost");
    expect(run.result).toBe("castle");
    expect(run.chestOffer).toBeNull();
  });

  it("the hash covers chests, the price and the offer", () => {
    const a = quietRun();
    const b = quietRun();
    expect(stateHash(a)).toBe(stateHash(b));
    b.chests.x[2] = b.chests.x[2]! + 1;
    expect(stateHash(a)).not.toBe(stateHash(b));
    const c = quietRun();
    const d = quietRun();
    for (const run of [c, d]) {
      standOnChest(run);
      run.gold = BASE + 60;
      run.step(NO_INPUT);
    }
    expect(stateHash(c)).toBe(stateHash(d));
    d.chestOffer!.slots[0] = (d.chestOffer!.slots[0]! + 1) % SLOT_COUNT;
    expect(stateHash(c)).not.toBe(stateHash(d));
  });

  it("the autopilot plays through chests and the run stays deterministic", () => {
    const play = () => {
      const run = createRun(gameData(), { seed: 4, durationSeconds: 150 });
      const input: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
      for (let i = 0; i < 150 * 30 && run.state !== "won" && run.state !== "lost"; i++) run.step(botInput(run, input));
      return run;
    };
    const first = play();
    expect(first.stats.goldGained).toBeGreaterThan(0);
    expect(first.chestsOpened).toBeGreaterThan(0);
    expect(stateHash(play())).toBe(stateHash(first));
  });
});
