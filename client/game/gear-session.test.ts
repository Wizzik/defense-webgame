import { describe, expect, it } from "vitest";
import { emptySave, type SaveData } from "../../meta";
import { gameData } from "../../sim/testing/game-data";
import { GearSession } from "./gear-session";
import { memoryBackend } from "./save-store";

const data = gameData();
const helm = data.items.find((i) => i.slotType === "head" && i.rarity === "rare")!.id;

describe("GearSession", () => {
  it("loads what the backend holds", async () => {
    const backend = memoryBackend({ version: 1, items: { [helm]: 2 }, loadouts: { stonehorn: { head: helm } } });
    const gear = await GearSession.load(data, backend);
    expect(gear.persistent).toBe(true);
    expect(gear.save.items).toEqual({ [helm]: 2 });
    expect(gear.loadout("stonehorn")).toEqual([{ slot: "head", item: helm, level: 2 }]);
    expect(gear.droppedOnLoad).toBe(0);
  });

  it("a boss's drop is in the save and written to the backend at once", async () => {
    const backend = memoryBackend();
    const gear = await GearSession.load(data, backend);
    const drop = gear.onBossDeath("iron-marshal", 5, 0);
    expect(drop.kind).toBe("new");
    if (drop.kind === "none") return;
    expect(gear.save.items).toEqual({ [drop.item.id]: 1 });
    await gear.flushed();
    expect((await backend.read() as SaveData).items).toEqual({ [drop.item.id]: 1 });
  });

  it("keeps the drops of a run in order and forgets them when the next run starts", async () => {
    const gear = await GearSession.load(data, memoryBackend());
    const first = gear.onBossDeath("iron-marshal", 5, 0);
    const second = gear.onBossDeath("pale-abbot", 5, 1);
    expect(gear.drops).toEqual([first, second]);
    expect(Object.keys(gear.save.items)).toHaveLength(2);
    gear.startRun();
    expect(gear.drops).toEqual([]);
    expect(Object.keys(gear.save.items)).toHaveLength(2);
  });

  it("a session that is not persistent writes nothing", async () => {
    const backend = memoryBackend();
    const gear = await GearSession.load(data, backend, { persistent: false });
    expect(gear.persistent).toBe(false);
    gear.onBossDeath("iron-marshal", 5, 0);
    gear.grant(helm, 3);
    await gear.flushed();
    expect(await backend.read()).toBeNull();
    expect(gear.save.items[helm]).toBe(3);
  });

  it("equip and unequip change the doll and are written", async () => {
    const backend = memoryBackend({ version: 1, items: { [helm]: 1 }, loadouts: {} });
    const gear = await GearSession.load(data, backend);
    gear.equip("stonehorn", helm);
    await gear.flushed();
    expect((await backend.read() as SaveData).loadouts).toEqual({ stonehorn: { head: helm } });
    gear.unequip("stonehorn", "head");
    await gear.flushed();
    expect((await backend.read() as SaveData).loadouts).toEqual({ stonehorn: {} });
  });

  it("an import that is not a save is refused and changes nothing", async () => {
    const stored = { version: 1 as const, items: { [helm]: 2 }, loadouts: {} };
    const backend = memoryBackend(stored);
    const gear = await GearSession.load(data, backend);
    for (const text of ["", "not json", "{", "[]", "5", "null", JSON.stringify({ items: { [helm]: 5 } }), JSON.stringify({ version: 2, items: {} })]) {
      expect(gear.importText(text), text).toEqual({ ok: false, reason: "invalid" });
      expect(gear.save.items).toEqual({ [helm]: 2 });
    }
    await gear.flushed();
    expect(await backend.read()).toEqual(stored);
  });

  it("a valid export comes back through import and replaces the data", async () => {
    const source = await GearSession.load(data, memoryBackend({ version: 1, items: { [helm]: 4 }, loadouts: { stonehorn: { head: helm } } }));
    const backend = memoryBackend({ version: 1, items: { "tin-ring": 1 }, loadouts: {} });
    const target = await GearSession.load(data, backend);
    expect(target.importText(source.exportText())).toEqual({ ok: true, dropped: 0 });
    expect(target.save).toEqual(source.save);
    await target.flushed();
    expect(await backend.read()).toEqual(source.save);
    const withJunk = JSON.stringify({ version: 1, items: { [helm]: 1, "no-such-item": 1 }, loadouts: {} });
    expect(target.importText(withJunk)).toEqual({ ok: true, dropped: 1 });
    expect(target.save.items).toEqual({ [helm]: 1 });
  });

  it("clear empties the collection", async () => {
    const gear = await GearSession.load(data, memoryBackend({ version: 1, items: { [helm]: 4 }, loadouts: {} }));
    gear.clear();
    expect(gear.save).toEqual(emptySave());
  });
});
