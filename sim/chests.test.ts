import { describe, expect, it } from "vitest";
import { botInput } from "./bot";
import { applyChestCard, ChestAction, type ChestCard, chestPrice, rollChestOffer } from "./chests";
import { EventKind } from "./events";
import type { GameData, Rarity } from "../data/schema";
import { RARITIES } from "../data/schema";
import { type LoadoutEntry, SLOT_COUNT, SLOT_IDS, slotTypeOf } from "./gear";
import { stateHash } from "./hash";
import { NO_INPUT } from "./input";
import type { TickInput } from "./input";
import { createRun } from "./run";
import type { Run } from "./run";
import { gameData } from "./testing/game-data";
import { silenceSpawns } from "./testing/silence";

const { basePrice: BASE, priceGrowth: GROWTH } = gameData().rules.chests;

function quietRun(seed = 3, data: GameData = gameData(), loadout: LoadoutEntry[] = []): Run {
  silenceSpawns(data);
  return createRun(data, { seed, durationSeconds: 100000, loadout });
}

/** Game data whose chests roll only these weights and offer `cards` cards. */
function chestData(weights: Partial<Record<Rarity, number>>, cards = 3): GameData {
  const data = gameData();
  data.rules.chests.rarityWeights = weights;
  data.rules.chests.slotsPerOffer = cards;
  return data;
}

const itemIndex = (run: Run, id: string) => run.data.items.findIndex((item) => item.id === id);
const slotOf = (id: (typeof SLOT_IDS)[number]) => SLOT_IDS.indexOf(id);
const rank = (rarity: Rarity) => RARITIES.indexOf(rarity);

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

  it("a hero with the gold opens the chest: the price is paid and three cards in different slots are offered", () => {
    const run = quietRun();
    standOnChest(run);
    run.gold = BASE + 60;
    expect(chestPrice(run)).toBe(BASE);
    run.step(NO_INPUT);
    expect(run.state).toBe("chest");
    expect(run.gold).toBe(60);
    expect(run.chestsOpened).toBe(1);
    const slots = run.chestOffer!.cards.map((card) => card.slot);
    expect(slots.length).toBe(3);
    expect(new Set(slots).size).toBe(3);
    for (const slot of slots) expect(slot >= 0 && slot < SLOT_COUNT).toBe(true);
    expect(kinds(run)).toContain(EventKind.ChestOpen);
    const tick = run.tick;
    run.step(NO_INPUT);
    expect(run.tick).toBe(tick); // time stands still until a slot is chosen
    expect(run.state).toBe("chest");
  });

  it("an empty slot gets the rolled item at a chest level of 1", () => {
    const run = quietRun();
    standOnChest(run);
    run.gold = BASE + 60;
    const hpBefore = run.hero.stats.maxHp;
    const where = { x: run.chests.x[0]!, y: run.chests.y[0]! };
    run.step(NO_INPUT);
    const card = run.chestOffer!.cards[1]!;
    const slot = card.slot;
    expect(card.action).toBe(ChestAction.New);
    run.step(pick(1));
    expect(run.state).toBe("playing");
    expect(run.chestOffer).toBeNull();
    expect(run.gear.item[slot]).toBe(card.item);
    const item = run.data.items[run.gear.item[slot]!]!;
    expect(item.slotType).toBe(slotTypeOf(slot));
    expect(run.gear.base[slot]).toBe(0);
    expect(run.gear.temp[slot]).toBe(1);
    const bonus = run.hero.gear[item.stats[0]!.stat];
    expect(bonus).toBeGreaterThanOrEqual(item.stats[0]!.value - 1e-9);
    if (item.stats[0]!.stat === "hp") expect(run.hero.stats.maxHp).toBeGreaterThan(hpBefore);
    expect(kinds(run)).toEqual(expect.arrayContaining([EventKind.ChestPick, EventKind.ChestSpawn]));
    const dx = run.chests.x[0]! - where.x;
    const dy = run.chests.y[0]! - where.y;
    expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThanOrEqual(run.data.rules.chests.minSpacing);
    expect(chestPrice(run)).toBe(Math.round(BASE * GROWTH));
  });

  it("the same rarity adds a temporary level to the worn item and the stats follow", () => {
    const data = chestData({ common: 1 }, 16);
    silenceSpawns(data);
    const boots = data.items.find((i) => i.slotType === "feet")!;
    const run = createRun(data, { seed: 3, durationSeconds: 100000, loadout: [{ slot: "feet", item: boots.id, level: 2 }] });
    const speed = run.hero.stats.moveSpeed;
    standOnChest(run);
    run.gold = BASE + 60;
    run.step(NO_INPUT);
    const feet = 9;
    const index = run.chestOffer!.cards.findIndex((card) => card.slot === feet);
    expect(run.chestOffer!.cards[index]).toEqual({ slot: feet, item: itemIndex(run, boots.id), action: ChestAction.Level });
    run.step(pick(index));
    expect(run.gear.base[feet]).toBe(2);
    expect(run.gear.temp[feet]).toBe(1);
    const { levelStep, chestLevelStep } = data.rules.gear;
    expect(run.hero.gear.moveSpeed).toBeCloseTo(boots.stats[0]!.value * (1 + levelStep + chestLevelStep), 9);
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
    d.chestOffer!.cards[0]!.slot = (d.chestOffer!.cards[0]!.slot + 1) % SLOT_COUNT;
    expect(stateHash(c)).not.toBe(stateHash(d));
    const e = quietRun();
    const f = quietRun();
    for (const run of [e, f]) {
      standOnChest(run);
      run.gold = BASE + 60;
      run.step(NO_INPUT);
    }
    f.chestOffer!.cards[0]!.item += 1;
    expect(stateHash(e)).not.toBe(stateHash(f));
    e.chestOffer!.cards[0]!.item += 1;
    e.chestOffer!.cards[0]!.action = ((e.chestOffer!.cards[0]!.action + 1) % 3) as ChestCard["action"];
    expect(stateHash(e)).not.toBe(stateHash(f));
  });

  it("an offer has three cards in different slots, each with an item of its slot type", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const run = quietRun(seed);
      const offer = rollChestOffer(run);
      expect(offer.cards.length).toBe(3);
      expect(new Set(offer.cards.map((card) => card.slot)).size).toBe(3);
      for (const card of offer.cards) {
        expect(run.data.items[card.item]!.slotType).toBe(slotTypeOf(card.slot));
        expect(card.action).toBe(ChestAction.New);
      }
    }
  });

  it("every rarity comes out of chests", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 400; seed++) {
      for (const card of rollChestOffer(quietRun(seed)).cards) seen.add(quietRun(seed).data.items[card.item]!.rarity);
    }
    expect([...seen].sort()).toEqual([...RARITIES].sort());
  });

  it("a rolled rarity with no free slot falls one step", () => {
    const run = quietRun(3, chestData({ mythic: 1 }, 16));
    const cards = rollChestOffer(run).cards;
    expect(cards.length).toBe(16);
    const rarities = cards.map((card) => run.data.items[card.item]!.rarity);
    const mythicSlots = cards.filter((card) => run.data.items[card.item]!.rarity === "mythic").map((card) => SLOT_IDS[card.slot]);
    expect(mythicSlots.sort()).toEqual(["mainHand", "offHand", "trinket1", "trinket2"]);
    expect(rarities.filter((r) => r === "epic").length).toBe(12);
  });

  it("the item of a ring or trinket card is one the other slot does not wear", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const run = quietRun(seed, chestData({ epic: 1 }, 16), [{ slot: "ring1", item: "ring-of-the-keen-eye", level: 1 }]);
      const ring2 = rollChestOffer(run).cards.find((card) => card.slot === slotOf("ring2"))!;
      expect(run.data.items[ring2.item]!.id).toBe("seal-of-the-archivist");
    }
  });

  it("a higher rarity replaces the worn item and keeps the whole slot level plus one", () => {
    const run = quietRun(3, gameData(), [{ slot: "head", item: "wardens-helm", level: 2 }]);
    const head = slotOf("head");
    run.gear.temp[head] = 1;
    const epic = run.data.items.findIndex((item) => item.slotType === "head" && item.rarity === "epic");
    applyChestCard(run, { slot: head, item: epic, action: ChestAction.Replace });
    expect(run.gear.item[head]).toBe(epic);
    expect(run.gear.base[head]).toBe(0);
    expect(run.gear.temp[head]).toBe(4);
  });

  it("an offer with a higher rarity than the worn item replaces, a lower or equal one adds a level", () => {
    const worn = quietRun(3, chestData({ epic: 1 }, 16), [{ slot: "head", item: "wardens-helm", level: 2 }]);
    const up = rollChestOffer(worn).cards.find((card) => card.slot === slotOf("head"))!;
    expect(up.action).toBe(ChestAction.Replace);
    expect(worn.data.items[up.item]!.rarity).toBe("epic");
    const low = quietRun(3, chestData({ common: 1 }, 16), [{ slot: "head", item: "wardens-helm", level: 2 }]);
    const level = rollChestOffer(low).cards.find((card) => card.slot === slotOf("head"))!;
    expect(level).toEqual({ slot: slotOf("head"), item: itemIndex(low, "wardens-helm"), action: ChestAction.Level });
  });

  it("the same or a lower rarity adds a level to the worn item", () => {
    const run = quietRun(3, gameData(), [{ slot: "head", item: "wardens-helm", level: 2 }]);
    const head = slotOf("head");
    applyChestCard(run, { slot: head, item: itemIndex(run, "wardens-helm"), action: ChestAction.Level });
    expect(run.gear.item[head]).toBe(itemIndex(run, "wardens-helm"));
    expect(run.gear.base[head]).toBe(2);
    expect(run.gear.temp[head]).toBe(1);
  });

  it("a legendary from a chest brings its effect at once", () => {
    const run = quietRun();
    expect(run.gear.fx.chainEvery).toBe(0);
    applyChestCard(run, { slot: slotOf("mainHand"), item: itemIndex(run, "skysplitter"), action: ChestAction.New });
    expect(run.gear.fx.chainEvery).toBeGreaterThan(0);
  });

  it("ChestPick names the slot, the level, the item and the action", () => {
    const run = quietRun(3, gameData(), [{ slot: "head", item: "wardens-helm", level: 2 }]);
    const head = slotOf("head");
    const epic = run.data.items.findIndex((item) => item.slotType === "head" && item.rarity === "epic");
    run.events.clear();
    applyChestCard(run, { slot: head, item: epic, action: ChestAction.Replace });
    const i = kinds(run).indexOf(EventKind.ChestPick);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(run.events.a[i]).toBe(head);
    expect(run.events.value[i]).toBe(3);
    expect(run.events.u[i]).toBe(epic);
    expect(run.events.v[i]).toBe(ChestAction.Replace);
    expect(run.events.x[i]).toBe(run.hero.x);
  });

  it("magic find shifts the rarities of chest cards", () => {
    const high = (magicFind: number) => {
      let count = 0;
      for (let seed = 1; seed <= 300; seed++) {
        // fixed weights, so tuning rules.chests.rarityWeights does not move this test
        const run = quietRun(seed, chestData({ common: 55, rare: 30, epic: 12, legendary: 2.5, mythic: 0.5 }));
        run.hero.gear.magicFind = magicFind;
        for (const card of rollChestOffer(run).cards) if (rank(run.data.items[card.item]!.rarity) >= rank("epic")) count++;
      }
      return count;
    };
    expect(high(1)).toBeGreaterThan(high(0) * 1.3);
  });

  it("a replaced permanent item stays in the loadout given to the run", () => {
    const loadout: LoadoutEntry[] = [{ slot: "head", item: "wardens-helm", level: 3 }];
    const copy = JSON.parse(JSON.stringify(loadout)) as LoadoutEntry[];
    const run = quietRun(3, gameData(), loadout);
    const epic = run.data.items.findIndex((item) => item.slotType === "head" && item.rarity === "epic");
    applyChestCard(run, { slot: slotOf("head"), item: epic, action: ChestAction.Replace });
    expect(loadout).toEqual(copy);
  });

  it("the only mythic trinket in both trinket slots does not double its effect", () => {
    const run = quietRun(3, gameData(), [{ slot: "trinket1", item: "seal-of-the-royal-treasury", level: 1 }]);
    const one = run.gear.fx.goldHeal;
    expect(one).toBeGreaterThan(0);
    applyChestCard(run, { slot: slotOf("trinket2"), item: itemIndex(run, "seal-of-the-royal-treasury"), action: ChestAction.New });
    expect(run.gear.fx.goldHeal).toBe(one);
  });

  it("rolling an offer takes randomness only from the chest generator", () => {
    const run = quietRun();
    const state = run.rng.state;
    rollChestOffer(run);
    expect(run.rng.state).toBe(state);
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
