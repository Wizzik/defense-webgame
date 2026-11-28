import { describe, expect, it } from "vitest";
import { type GameData, RARITIES } from "../data/schema";
import { Rng, rollItem } from "../sim";
import { gameData } from "../sim/testing/game-data";
import { namedRecord, parseRecord, recordItem, recordSlotType, rolledOf, rolledRecord } from "./item-record";

const data: GameData = gameData();

function rolled(seed: number, rarity = 4) {
  return rollItem(data, new Rng(seed), "chest", RARITIES[rarity]!, 8, "int");
}

describe("item records", () => {
  it("a rolled item survives the trip to a record, to JSON and back", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const item = rolled(seed, seed % 5);
      const record = rolledRecord(data, 7, item, 3);
      const stored = JSON.parse(JSON.stringify(record)) as unknown;
      const parsed = parseRecord(stored, data);
      expect(parsed).toEqual(record);
      expect(rolledOf(data, parsed!)).toEqual(item);
    }
  });

  it("a mythic record keeps its effect, a rare one its two-word name", () => {
    const mythic = rolledRecord(data, 1, rolled(3, 4), 1);
    expect(mythic.effect).toBeGreaterThanOrEqual(0);
    const rare = rolledRecord(data, 2, rolled(3, 2), 1);
    expect(rare.effect).toBeUndefined();
    expect(rare.name).toHaveLength(2);
  });

  it("a record reads as its item and slot type", () => {
    const record = rolledRecord(data, 1, rolled(5), 2);
    expect(recordSlotType(data, record)).toBe("chest");
    expect(recordItem(data, record)?.rarity).toBe("mythic");
    const item = data.items[0]!;
    const named = namedRecord(data, 2, item.id, 1)!;
    expect(recordItem(data, named)).toBe(item);
    expect(rolledOf(data, named)).toBeNull();
    expect(namedRecord(data, 3, "no-such-item", 1)).toBeNull();
  });

  it("a named record takes its rarity from the catalogue", () => {
    // a save of before 2026-11-28 stored "common" for what is now a legendary item
    const item = data.items.find((candidate) => candidate.rarity === "mythic")!;
    expect(parseRecord({ uid: 4, level: 2, named: item.id, rarity: "common" }, data))
      .toEqual({ uid: 4, rarity: "mythic", level: 2, named: item.id });
  });

  it("parseRecord refuses what does not fit the game data", () => {
    const good = JSON.parse(JSON.stringify(rolledRecord(data, 1, rolled(9), 1))) as Record<string, unknown>;
    const rows = good.rows as unknown[][];
    const bad: unknown[] = [
      null, 3, "x", [],
      { ...good, uid: 0 }, { ...good, uid: 1.5 }, { ...good, uid: "1" },
      { ...good, level: 0 }, { ...good, level: data.rules.gear.maxPermanentLevel + 1 },
      { ...good, base: "no-such-base" }, { ...good, base: undefined },
      { ...good, rarity: "golden" },
      { ...good, rows: [] }, { ...good, rows: "x" },
      { ...good, rows: [...rows, ...rows] },
      { ...good, rows: [["no-such-stat", 1, 0]] },
      { ...good, rows: [[rows[0]![0], -1, 0]] },
      { ...good, rows: [[rows[0]![0], Number.NaN, 0]] },
      { ...good, rows: [[rows[0]![0], 1, 4]] },
      { ...good, rows: [[rows[0]![0], 1]] },
      { ...good, rows: [rows[0], rows[0]] },
      { uid: 1, level: 1, named: 5 },
      { uid: 1, level: 1, named: "no-such-item" },
    ];
    for (const raw of bad) expect(parseRecord(raw, data)).toBeNull();
  });

  it("an effect or a name the game does not know is left out and the item kept", () => {
    const good = JSON.parse(JSON.stringify(rolledRecord(data, 1, rolled(9), 1))) as Record<string, unknown>;
    const parsed = parseRecord({ ...good, effect: 999, name: [999, 0] }, data);
    expect(parsed).not.toBeNull();
    expect(parsed!.effect).toBeUndefined();
    expect(parsed!.name).toBeUndefined();
    expect(parsed!.rows).toEqual(good.rows);
  });
});
