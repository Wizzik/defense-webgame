import { describe, expect, it } from "vitest";
import { botInput } from "./bot";
import { applyChestCard, ChestAction, type ChestCard, chestPrice, chooseChestCard, rollChestOffer } from "./chests";
import { EventKind } from "./events";
import type { GameData, Rarity } from "../data/schema";
import { RARITIES, STAT_IDS } from "../data/schema";
import { type LoadoutEntry, MAX_ROWS, ROLLED_ITEM, SLOT_COUNT, SLOT_IDS, slotTypeOf } from "./gear";
import { stateHash } from "./hash";
import { InputAction, NO_INPUT } from "./input";
import type { TickInput } from "./input";
import { createRun } from "./run";
import type { Run } from "./run";
import { gameData } from "./testing/game-data";
import { silenceSpawns } from "./testing/silence";

const { basePrice: BASE, priceGrowth: GROWTH } = gameData().rules.chests;

/** Game data whose chest cards are always named items (the rules from before random items). */
function namedData(data: GameData = gameData()): GameData {
  for (const rarity of RARITIES) data.rules.loot.namedShare[rarity] = 1;
  return data;
}

function quietRun(seed = 3, data: GameData = namedData(), loadout: LoadoutEntry[] = []): Run {
  silenceSpawns(data);
  return createRun(data, { seed, durationSeconds: 100000, loadout });
}

/** Game data whose chests roll only these weights and offer `cards` cards. */
function chestData(weights: Partial<Record<Rarity, number>>, cards = 3, named = true): GameData {
  const data = named ? namedData() : gameData();
  data.rules.chests.rarityWeights = weights;
  data.rules.chests.slotsPerOffer = cards;
  return data;
}

const itemIndex = (run: Run, id: string) => run.data.items.findIndex((item) => item.id === id);
const slotOf = (id: (typeof SLOT_IDS)[number]) => SLOT_IDS.indexOf(id);
const rank = (rarity: Rarity) => RARITIES.indexOf(rarity);
/** Rarity and slot type of what a card offers, rolled or named. */
const cardRarity = (run: Run, card: ChestCard): Rarity =>
  card.rolled ? RARITIES[card.rolled.rarity]! : run.data.items[card.item]!.rarity;
const cardType = (run: Run, card: ChestCard) =>
  card.rolled ? run.data.loot.bases[card.rolled.base]!.slotType : run.data.items[card.item]!.slotType;

/** Rarity rank of what `slot` wears, -1 for an empty slot. */
function wornRank(run: Run, slot: number): number {
  const item = run.gear.item[slot]!;
  if (item === -1) return -1;
  if (item === ROLLED_ITEM) return run.gear.rolledRarity[slot]!;
  return rank(run.data.items[item]!.rarity);
}

/** A loadout with a named item of `rarity` in every slot (the first of its type, the second for the twin slot). */
function wornEverywhere(data: GameData, rarity: Rarity): LoadoutEntry[] {
  const used = new Map<string, number>();
  return SLOT_IDS.map((slot, index) => {
    const type = slotTypeOf(index);
    const pool = data.items.filter((item) => item.slotType === type && item.rarity === rarity);
    const n = used.get(type) ?? 0;
    used.set(type, n + 1);
    return { slot, item: pool[n % pool.length]!.id, level: 1 };
  });
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
    expect(run.chestOffer!.cards[index]).toEqual({ slot: feet, item: itemIndex(run, boots.id), action: ChestAction.Level, rolled: null });
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
        expect(cardType(run, card)).toBe(slotTypeOf(card.slot));
        expect(card.action).toBe(ChestAction.New);
      }
    }
  });

  it("every rarity comes out of chests", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 400; seed++) {
      // one run per seed: building a run (its world map) is the slow part
      const run = quietRun(seed);
      for (const card of rollChestOffer(run).cards) seen.add(cardRarity(run, card));
    }
    expect([...seen].sort()).toEqual([...RARITIES].sort());
  });

  it("a rarity without a named item for the slot is rolled even when named items are always wanted", () => {
    const run = quietRun(3, chestData({ mythic: 1 }, 16));
    const cards = rollChestOffer(run).cards;
    expect(cards.length).toBe(16);
    const namedSlots = cards.filter((card) => !card.rolled).map((card) => SLOT_IDS[card.slot]);
    expect(namedSlots.sort()).toEqual(["mainHand", "offHand", "trinket1", "trinket2"]);
    for (const card of cards.filter((c) => c.rolled)) {
      expect(card.item).toBe(ROLLED_ITEM);
      expect(card.rolled!.rarity).toBe(rank("mythic"));
      expect(run.data.loot.bases[card.rolled!.base]!.slotType).toBe(slotTypeOf(card.slot));
    }
  });

  it("the item of a ring or trinket card is one the other slot does not wear", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const run = quietRun(seed, chestData({ epic: 1 }, 16), [{ slot: "ring1", item: "ring-of-the-keen-eye", level: 1 }]);
      const ring2 = rollChestOffer(run).cards.find((card) => card.slot === slotOf("ring2"))!;
      expect(run.data.items[ring2.item]!.id).toBe("seal-of-the-archivist");
    }
  });

  it("taking a higher rarity replaces the worn item and keeps the whole slot level plus one", () => {
    const run = quietRun(3, gameData(), [{ slot: "head", item: "wardens-helm", level: 2 }]);
    const head = slotOf("head");
    run.gear.temp[head] = 1;
    const epic = run.data.items.findIndex((item) => item.slotType === "head" && item.rarity === "epic");
    applyChestCard(run, { slot: head, item: epic, action: ChestAction.Choice });
    expect(run.gear.item[head]).toBe(epic);
    expect(run.gear.base[head]).toBe(0);
    expect(run.gear.temp[head]).toBe(4);
  });

  it("a higher rarity than the worn item in a worn slot is a Choice with the rolled item", () => {
    const worn = quietRun(3, chestData({ epic: 1 }, 16), [{ slot: "head", item: "wardens-helm", level: 2 }]);
    const up = rollChestOffer(worn).cards.find((card) => card.slot === slotOf("head"))!;
    expect(up.action).toBe(ChestAction.Choice);
    expect(worn.data.items[up.item]!.rarity).toBe("epic");
  });

  it("a slot that wears the drawn rarity or a higher one gets a Level card of the worn item", () => {
    const low = quietRun(3, chestData({ common: 1 }, 16), [{ slot: "head", item: "wardens-helm", level: 2 }]);
    const down = rollChestOffer(low).cards.find((card) => card.slot === slotOf("head"))!;
    expect(down).toEqual({ slot: slotOf("head"), item: itemIndex(low, "wardens-helm"), action: ChestAction.Level, rolled: null });
    const epic = quietRun(3, chestData({ rare: 1 }, 16), [{ slot: "head", item: "helm-of-the-unbroken-line", level: 1 }]);
    const rare = rollChestOffer(epic).cards.find((card) => card.slot === slotOf("head"))!;
    expect(rare.action).toBe(ChestAction.Level);
    expect(rare.item).toBe(itemIndex(epic, "helm-of-the-unbroken-line"));
  });

  it("no Choice card offers a rarity at or below the worn one, named or rolled, over many offers", () => {
    for (const named of [true, false]) {
      const data = chestData({ common: 3, rare: 3, epic: 2, legendary: 1, mythic: 1 }, 3, named);
      const run = quietRun(11, data, wornEverywhere(data, "rare"));
      for (let offer = 0; offer < 200; offer++) {
        for (const card of rollChestOffer(run).cards) {
          if (card.action === ChestAction.Choice) {
            expect(rank(cardRarity(run, card))).toBeGreaterThan(wornRank(run, card.slot));
          }
          if (card.action === ChestAction.Level) expect(card.item).toBe(run.gear.item[card.slot]);
        }
      }
    }
  });

  it("a card for a worn slot is a Level card with upgradeShare, else it moves to a slot where it is an upgrade", () => {
    const always = chestData({ rare: 1 }, 1, false);
    always.rules.loot.upgradeShare = 1;
    const never = chestData({ rare: 1 }, 1, false);
    never.rules.loot.upgradeShare = 0;
    const head = slotOf("head");
    let levels = 0;
    for (let seed = 1; seed <= 40; seed++) {
      // every slot but the head is empty, so a card drawn for the head can always move
      const moved = rollChestOffer(quietRun(seed, never, [{ slot: "head", item: "wardens-helm", level: 1 }])).cards[0]!;
      expect(moved.slot).not.toBe(head);
      expect(moved.action).toBe(ChestAction.New);
      const kept = rollChestOffer(quietRun(seed, always, [{ slot: "head", item: "wardens-helm", level: 1 }])).cards[0]!;
      if (kept.slot === head) {
        levels++;
        expect(kept.action).toBe(ChestAction.Level);
      }
    }
    expect(levels).toBeGreaterThan(0);
  });

  it("with no slot where the rarity is an upgrade every card is a Level card", () => {
    const data = chestData({ common: 1, rare: 1 }, 3, false);
    data.rules.loot.upgradeShare = 0;
    const run = quietRun(4, data, wornEverywhere(data, "rare"));
    for (let offer = 0; offer < 50; offer++) {
      for (const card of rollChestOffer(run).cards) expect(card.action).toBe(ChestAction.Level);
    }
  });

  it("a mythic slot only ever gets Level cards", () => {
    const data = chestData({ legendary: 1, mythic: 1 }, 16, false);
    const mythic = data.items.find((item) => item.rarity === "mythic" && item.slotType === "mainHand")!;
    const mainHand = slotOf("mainHand");
    for (let seed = 1; seed <= 20; seed++) {
      const run = quietRun(seed, data, [{ slot: "mainHand", item: mythic.id, level: 1 }]);
      const card = rollChestOffer(run).cards.find((c) => c.slot === mainHand)!;
      expect(card.action).toBe(ChestAction.Level);
    }
  });

  it("a Level card of a worn random item carries a copy of it and only levels it", () => {
    const head = slotOf("head");
    const rolledRun = quietRun(6, chestData({ epic: 1 }, 16, false), []);
    const epicCard = rollChestOffer(rolledRun).cards.find((c) => c.slot === head && c.rolled)!;
    applyChestCard(rolledRun, epicCard);
    expect(rolledRun.gear.item[head]).toBe(ROLLED_ITEM);
    rolledRun.data.rules.chests.rarityWeights = { rare: 1 };
    const level = rollChestOffer(rolledRun).cards.find((c) => c.slot === head)!;
    expect(level.action).toBe(ChestAction.Level);
    expect(level.item).toBe(ROLLED_ITEM);
    expect(level.rolled).toEqual(epicCard.rolled);
    applyChestCard(rolledRun, level);
    expect(rolledRun.gear.temp[head]).toBe(2);
  });

  it("the same item as the worn one is a Level card", () => {
    const run = quietRun(3, chestData({ common: 1 }, 16), [{ slot: "head", item: "travelers-hood", level: 2 }]);
    const card = rollChestOffer(run).cards.find((c) => c.slot === slotOf("head"))!;
    expect(card).toEqual({ slot: slotOf("head"), item: itemIndex(run, "travelers-hood"), action: ChestAction.Level, rolled: null });
  });

  it("keep adds a level to the worn item; take puts the rolled item in with the slot's level + 1", () => {
    const loadout: LoadoutEntry[] = [{ slot: "head", item: "wardens-helm", level: 3 }];
    const copy = JSON.parse(JSON.stringify(loadout)) as LoadoutEntry[];
    const head = slotOf("head");
    const epic = gameData().items.findIndex((item) => item.slotType === "head" && item.rarity === "epic");
    const card: ChestCard = { slot: head, item: epic, action: ChestAction.Choice };
    const pickOf = (run: Run) => kinds(run).indexOf(EventKind.ChestPick);

    const keep = quietRun(3, gameData(), loadout);
    keep.gear.temp[head] = 1;
    keep.events.clear();
    applyChestCard(keep, card, true);
    expect([keep.gear.item[head], keep.gear.base[head], keep.gear.temp[head]]).toEqual([itemIndex(keep, "wardens-helm"), 3, 2]);
    expect(keep.events.v[pickOf(keep)]).toBe(ChestAction.Level);
    expect(keep.events.value[pickOf(keep)]).toBe(5);

    const take = quietRun(3, gameData(), loadout);
    take.gear.temp[head] = 1;
    take.events.clear();
    applyChestCard(take, card, false);
    expect([take.gear.item[head], take.gear.base[head], take.gear.temp[head]]).toEqual([epic, 0, 5]);
    expect(take.events.v[pickOf(take)]).toBe(ChestAction.Choice);
    expect(loadout).toEqual(copy);
  });

  it("the keep bit on a New or a Level card changes nothing; a bad index changes nothing", () => {
    const head = slotOf("head");
    const hood = gameData().items.findIndex((item) => item.id === "travelers-hood");
    const fresh = quietRun();
    applyChestCard(fresh, { slot: head, item: hood, action: ChestAction.New }, true);
    expect([fresh.gear.item[head], fresh.gear.base[head], fresh.gear.temp[head]]).toEqual([hood, 0, 1]);
    const worn = quietRun(3, gameData(), [{ slot: "head", item: "travelers-hood", level: 2 }]);
    applyChestCard(worn, { slot: head, item: hood, action: ChestAction.Level }, true);
    expect([worn.gear.item[head], worn.gear.base[head], worn.gear.temp[head]]).toEqual([hood, 2, 1]);

    const open = quietRun(3, gameData(), [{ slot: "head", item: "wardens-helm", level: 1 }]);
    open.chestOffer = { cards: [{ slot: head, item: hood, action: ChestAction.Choice }] };
    open.state = "chest";
    open.openChest = 0;
    const before = stateHash(open);
    for (const bad of [-1, 1, 7, 0.5, Number.NaN]) chooseChestCard(open, bad, true);
    expect(stateHash(open)).toBe(before);
    expect(open.state).toBe("chest");
  });

  it("the run reads the keep bit from the input", () => {
    const head = slotOf("head");
    const play = (actions: number) => {
      const run = quietRun(3, gameData(), [{ slot: "head", item: "wardens-helm", level: 1 }]);
      const hood = itemIndex(run, "travelers-hood");
      const fresh = itemIndex(run, "copper-pendant");
      run.chestOffer = {
        cards: [
          { slot: slotOf("neck"), item: fresh, action: ChestAction.New },
          { slot: head, item: hood, action: ChestAction.Choice },
        ],
      };
      run.state = "chest";
      run.openChest = 0;
      run.step({ ...NO_INPUT, card: 1, actions });
      return run;
    };
    const kept = play(InputAction.KeepWorn);
    expect(kept.state).toBe("playing");
    expect([kept.gear.item[head], kept.gear.base[head], kept.gear.temp[head]]).toEqual([itemIndex(kept, "wardens-helm"), 1, 1]);
    const taken = play(0);
    expect([taken.gear.item[head], taken.gear.base[head], taken.gear.temp[head]]).toEqual([itemIndex(taken, "travelers-hood"), 0, 2]);
  });

  it("a Level card adds a level to the worn item", () => {
    const run = quietRun(3, gameData(), [{ slot: "head", item: "wardens-helm", level: 2 }]);
    const head = slotOf("head");
    applyChestCard(run, { slot: head, item: itemIndex(run, "wardens-helm"), action: ChestAction.Level, rolled: null });
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
    applyChestCard(run, { slot: head, item: epic, action: ChestAction.Choice });
    const i = kinds(run).indexOf(EventKind.ChestPick);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(run.events.a[i]).toBe(head);
    expect(run.events.value[i]).toBe(3);
    expect(run.events.u[i]).toBe(epic);
    expect(run.events.v[i]).toBe(ChestAction.Choice);
    expect(run.events.x[i]).toBe(run.hero.x);
  });

  it("magic find shifts the rarities of chest cards", () => {
    const high = (magicFind: number) => {
      let count = 0;
      for (let seed = 1; seed <= 300; seed++) {
        // fixed weights, so tuning rules.chests.rarityWeights does not move this test
        const run = quietRun(seed, chestData({ common: 55, rare: 30, epic: 12, legendary: 2.5, mythic: 0.5 }));
        run.hero.gear.magicFind = magicFind;
        for (const card of rollChestOffer(run).cards) if (rank(cardRarity(run, card)) >= rank("epic")) count++;
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
    applyChestCard(run, { slot: slotOf("head"), item: epic, action: ChestAction.Choice });
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
      const run = createRun(gameData(), { seed: 1, durationSeconds: 150 });
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

describe("chests with random items", () => {
  it("most cards are rolled items; named ones come with the rarity's named share", () => {
    let rolled = 0;
    let named = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const run = quietRun(seed, chestData({ epic: 1 }, 16, false));
      for (const card of rollChestOffer(run).cards) {
        if (card.rolled) rolled++;
        else named++;
      }
    }
    const share = gameData().rules.loot.namedShare.epic;
    expect(named / (named + rolled)).toBeGreaterThan(share * 0.5);
    expect(named / (named + rolled)).toBeLessThan(share * 1.6);
  });

  it("a rolled card into an empty slot is New; the slot then wears its rows at chest level 1", () => {
    const run = quietRun(4, chestData({ legendary: 1 }, 16, false));
    const card = rollChestOffer(run).cards.find((c) => c.rolled)!;
    expect(card.action).toBe(ChestAction.New);
    applyChestCard(run, card);
    const slot = card.slot;
    expect(run.gear.item[slot]).toBe(ROLLED_ITEM);
    expect(run.gear.temp[slot]).toBe(1);
    expect(run.gear.rowCount[slot]).toBe(card.rolled!.stats.length);
    const stat = card.rolled!.stats[1]!;
    expect(run.gear.rowStat[slot * MAX_ROWS + 1]).toBe(stat);
    // the hero's sum of the row's stat holds the row at chest level 1 (other slots are empty)
    const { chestLevelStep } = run.data.rules.gear;
    const key = STAT_IDS[stat]!;
    const fromSlot = card.rolled!.stats.reduce((sum, s, r) => (s === stat ? sum + card.rolled!.values[r]! : sum), 0);
    expect(run.hero.gear[key]).toBeCloseTo(fromSlot * (1 + chestLevelStep), 9);
  });

  it("a rolled card over a worn item is a Choice; take wears the rolled item, keep levels the worn one", () => {
    const run = quietRun(5, chestData({ epic: 1 }, 16, false), [{ slot: "head", item: "wardens-helm", level: 2 }]);
    const head = slotOf("head");
    const card = rollChestOffer(run).cards.find((c) => c.slot === head && c.rolled);
    if (!card) return; // the named share took the head card for this seed
    expect(card.action).toBe(ChestAction.Choice);
    applyChestCard(run, card, true);
    expect(run.gear.item[head]).toBe(itemIndex(run, "wardens-helm"));
    expect(run.gear.temp[head]).toBe(1);
    applyChestCard(run, card, false);
    expect(run.gear.item[head]).toBe(ROLLED_ITEM);
    expect(run.gear.base[head]).toBe(0);
    expect(run.gear.temp[head]).toBe(2 + 1 + 1);
  });

  it("a rolled mythic brings its effect; the hash covers the rolled rows", () => {
    const run = quietRun(6, chestData({ mythic: 1 }, 16, false));
    const card = rollChestOffer(run).cards.find((c) => c.rolled && c.slot === slotOf("head"))!;
    const before = stateHash(run);
    applyChestCard(run, card);
    expect(stateHash(run)).not.toBe(before);
    const effect = run.data.rules.loot.mythicEffects[card.rolled!.effect]!;
    const fx = run.gear.fx;
    const on = { chain_on_attack: fx.chainEvery, splash_on_attack: fx.splashChance, low_hp_shield: fx.shieldThreshold,
      haste_on_elite_kill: fx.hasteSpeed, slow_aura: fx.auraRadius, gold_heals_castle: fx.goldHeal }[effect.kind];
    expect(on).toBeGreaterThan(0);
    const changed = quietRun(6, chestData({ mythic: 1 }, 16, false));
    applyChestCard(changed, card);
    changed.gear.rowValue[card.slot * MAX_ROWS + 1] += 0.001;
    expect(stateHash(changed)).not.toBe(stateHash(run));
  });

  it("the chest's item power gates the tiers: phase 1 of world 1 rolls only T1", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const run = quietRun(seed, chestData({ legendary: 1 }, 16, false));
      for (const card of rollChestOffer(run).cards) {
        if (card.rolled) expect(card.rolled.tiers.slice(1).every((t) => t === 0)).toBe(true);
      }
    }
  });
});
