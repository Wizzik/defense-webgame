import { describe, expect, it } from "vitest";
import { emptySave } from "../../meta";
import { gameData } from "../../sim/testing/game-data";
import { GearSession } from "./gear-session";
import { indexedDbBackend, memoryBackend, type SaveBackend } from "./save-store";

const data = gameData();
const ring = (level: number) => ({ uid: 1, rarity: data.items.find((i) => i.id === "tin-ring")!.rarity, level, named: "tin-ring" });

describe("save backends", () => {
  it("the memory backend gives back what was written", async () => {
    const backend = memoryBackend();
    expect(await backend.read()).toBeNull();
    const save = { ...emptySave(), items: [ring(2)], nextUid: 2 };
    await backend.write(save);
    expect(await backend.read()).toEqual(save);
    save.items[0]!.level = 5;
    expect(await backend.read()).toEqual({ ...emptySave(), items: [ring(2)], nextUid: 2 });
  });

  it("without IndexedDB there is no backend", async () => {
    expect(await indexedDbBackend(undefined)).toBeNull();
    const failing = { open: () => { throw new Error("blocked"); } } as unknown as IDBFactory;
    expect(await indexedDbBackend(failing)).toBeNull();
  });

  it("a backend that cannot be read gives an empty collection that is not persistent", async () => {
    const broken: SaveBackend = {
      read: () => Promise.reject(new Error("no access")),
      write: () => Promise.reject(new Error("no access")),
    };
    const gear = await GearSession.load(data, broken);
    expect(gear.save).toEqual(emptySave());
    expect(gear.persistent).toBe(false);
    expect(gear.onBossDeath("iron-marshal", 1, 0, 0).kind).toBe("rolled");
  });

  it("no backend at all gives an empty collection that is not persistent", async () => {
    const gear = await GearSession.load(data, null);
    expect(gear.save).toEqual(emptySave());
    expect(gear.persistent).toBe(false);
  });

  it("a write that fails turns persistence off and keeps the game going", async () => {
    const backend: SaveBackend = { read: () => Promise.resolve(null), write: () => Promise.reject(new Error("full")) };
    const gear = await GearSession.load(data, backend);
    expect(gear.persistent).toBe(true);
    gear.onBossDeath("iron-marshal", 1, 0, 0);
    await gear.flushed();
    expect(gear.persistent).toBe(false);
    expect(gear.save.items).toHaveLength(1);
  });

  it("stored data that is broken gives the valid part and counts the rest", async () => {
    const gear = await GearSession.load(data, memoryBackend({ version: 1, items: { "tin-ring": 2, junk: 1 }, loadouts: {} }));
    expect(gear.save.items).toEqual([ring(2)]);
    expect(gear.droppedOnLoad).toBe(1);
    expect(gear.persistent).toBe(true);
  });
});
