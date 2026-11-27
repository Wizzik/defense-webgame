import { describe, expect, it } from "vitest";
import { emptySave, namedLevels, type SaveData } from "../../meta";
import { gameData } from "../../sim/testing/game-data";
import { GearSession } from "./gear-session";
import { memoryBackend } from "./save-store";

const data = gameData();
const helm = data.items.find((i) => i.slotType === "head" && i.rarity === "rare")!.id;
const helmRecord = (level: number, uid = 1) => ({ uid, rarity: "rare" as const, level, named: helm });

describe("GearSession", () => {
  it("loads a save of version 1 as named records", async () => {
    const backend = memoryBackend({ version: 1, items: { [helm]: 2 }, loadouts: { stonehorn: { head: helm } } });
    const gear = await GearSession.load(data, backend);
    expect(gear.persistent).toBe(true);
    expect(gear.save).toEqual({ version: 2, items: [helmRecord(2)], nextUid: 2, loadouts: { stonehorn: { head: 1 } } });
    expect(gear.loadout("stonehorn")).toEqual([{ slot: "head", item: helm, level: 2 }]);
    expect(gear.droppedOnLoad).toBe(0);
  });

  it("passes the hero's magic find on to the drop", async () => {
    const high = async (magicFind: number) => {
      let count = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const gear = await GearSession.load(data, memoryBackend());
        const drop = gear.onBossDeath("dread-regent", seed, 0, magicFind);
        if (drop.kind !== "none" && (drop.item.rarity === "legendary" || drop.item.rarity === "mythic")) count++;
      }
      return count;
    };
    expect(await high(3)).toBeGreaterThan(await high(0));
  });

  it("passes the course on to the drop: a later world gives a higher level", async () => {
    const gear = await GearSession.load(data, memoryBackend());
    const easy = gear.onBossDeath("iron-marshal", 5, 0, 0, { world: 1, difficulty: "normal", primary: "int" });
    const hard = gear.onBossDeath("iron-marshal", 5, 0, 0, { world: 5, difficulty: "hell", primary: "int" });
    expect(easy.kind).toBe("rolled");
    expect(hard.kind).toBe("rolled");
    if (easy.kind !== "rolled" || hard.kind !== "rolled") return;
    expect(hard.level).toBeGreaterThan(easy.level);
  });

  it("a boss's drop is in the save and written to the backend at once", async () => {
    const backend = memoryBackend();
    const gear = await GearSession.load(data, backend);
    const drop = gear.onBossDeath("iron-marshal", 5, 0, 0);
    expect(drop.kind).toBe("rolled");
    if (drop.kind !== "rolled") return;
    expect(gear.save.items).toEqual([{ ...drop.record, uid: 1 }]);
    await gear.flushed();
    expect((await backend.read() as SaveData).items).toEqual([{ ...drop.record, uid: 1 }]);
  });

  it("keeps the drops of a run in order and forgets them when the next run starts", async () => {
    const gear = await GearSession.load(data, memoryBackend());
    const first = gear.onBossDeath("iron-marshal", 5, 0, 0);
    const second = gear.onBossDeath("pale-abbot", 5, 1, 0);
    expect(gear.drops).toEqual([first, second]);
    expect(gear.save.items).toHaveLength(2);
    gear.startRun();
    expect(gear.drops).toEqual([]);
    expect(gear.save.items).toHaveLength(2);
  });

  it("a session that is not persistent writes nothing", async () => {
    const backend = memoryBackend();
    const gear = await GearSession.load(data, backend, { persistent: false });
    expect(gear.persistent).toBe(false);
    gear.onBossDeath("iron-marshal", 5, 0, 0);
    gear.grant(helm, 3);
    await gear.flushed();
    expect(await backend.read()).toBeNull();
    expect(namedLevels(gear.save)[helm]).toBe(3);
  });

  it("grant adds a named item or sets its level, and ignores unknown items", async () => {
    const gear = await GearSession.load(data, memoryBackend());
    gear.grant(helm, 9);
    gear.grant(helm, 2);
    gear.grant("no-such-item", 1);
    expect(gear.save.items).toEqual([helmRecord(2)]);
  });

  it("equip and unequip change the doll by uid and are written", async () => {
    const backend = memoryBackend({ version: 1, items: { [helm]: 1 }, loadouts: {} });
    const gear = await GearSession.load(data, backend);
    gear.equip("stonehorn", 1);
    await gear.flushed();
    expect((await backend.read() as SaveData).loadouts).toEqual({ stonehorn: { head: 1 } });
    gear.unequip("stonehorn", "head");
    await gear.flushed();
    expect((await backend.read() as SaveData).loadouts).toEqual({ stonehorn: {} });
  });

  it("a rolled drop can be worn into a run at its level", async () => {
    const gear = await GearSession.load(data, memoryBackend());
    const drop = gear.onBossDeath("gunmaster", 3, 2, 0);
    if (drop.kind !== "rolled") throw new Error("expected a rolled drop");
    const uid = gear.save.items[0]!.uid;
    gear.equip("stonehorn", uid);
    const [entry] = gear.loadout("stonehorn");
    expect(entry).toMatchObject({ item: `rolled-${drop.record.base}`, level: drop.level });
    expect(entry!.rolled).toBeDefined();
  });

  it("an import that is not a save is refused and changes nothing", async () => {
    const stored = { version: 1 as const, items: { [helm]: 2 }, loadouts: {} };
    const backend = memoryBackend(stored);
    const gear = await GearSession.load(data, backend);
    const before = gear.save;
    const texts = [
      "", "not json", "{", "[]", "5", "null", JSON.stringify({ items: { [helm]: 5 } }),
      JSON.stringify({ version: 3, items: [] }), JSON.stringify({ version: 2, items: [], nextUid: 1, loadouts: {} }),
    ];
    for (const text of texts) {
      expect(gear.importText(text), text).toEqual({ ok: false, reason: "invalid" });
      expect(gear.save).toBe(before);
    }
    await gear.flushed();
    expect(await backend.read()).toEqual(stored);
  });

  it("a save file with nothing this game knows is refused and the gear stays", async () => {
    const stored = { version: 1 as const, items: { [helm]: 2 }, loadouts: { stonehorn: { head: helm } } };
    const backend = memoryBackend(stored);
    const gear = await GearSession.load(data, backend);
    const before = gear.save;
    const foreign = JSON.stringify({ version: 1, items: { "sword-of-another-game": 3, "other-ring": 1 }, loadouts: {} });
    const foreignV2 = JSON.stringify({ version: 2, items: [{ uid: 1, level: 1, named: "other-ring" }], nextUid: 2, loadouts: {} });
    for (const text of [JSON.stringify({ version: 1 }), JSON.stringify({ version: 1, items: {}, loadouts: {} }), foreign, foreignV2]) {
      expect(gear.importText(text), text).toEqual({ ok: false, reason: "invalid" });
      expect(gear.save).toBe(before);
    }
    await gear.flushed();
    expect(await backend.read()).toEqual(stored);
  });

  it("a valid export comes back through import and replaces the data; an old file of version 1 imports too", async () => {
    const source = await GearSession.load(data, memoryBackend({ version: 1, items: { [helm]: 4 }, loadouts: { stonehorn: { head: helm } } }));
    source.onBossDeath("pale-abbot", 8, 1, 0);
    const backend = memoryBackend({ version: 1, items: { "tin-ring": 1 }, loadouts: {} });
    const target = await GearSession.load(data, backend);
    expect(target.importText(source.exportText())).toEqual({ ok: true, dropped: 0 });
    expect(target.save).toEqual(source.save);
    await target.flushed();
    expect(await backend.read()).toEqual(source.save);
    const withJunk = JSON.stringify({ version: 1, items: { [helm]: 1, "no-such-item": 1 }, loadouts: {} });
    expect(target.importText(withJunk)).toEqual({ ok: true, dropped: 1 });
    expect(target.save.items).toEqual([helmRecord(1)]);
  });

  it("clear empties the collection", async () => {
    const gear = await GearSession.load(data, memoryBackend({ version: 1, items: { [helm]: 4 }, loadouts: {} }));
    gear.clear();
    expect(gear.save).toEqual(emptySave());
  });
});
