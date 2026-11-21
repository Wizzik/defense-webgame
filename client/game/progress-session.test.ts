import { describe, expect, it } from "vitest";
import { emptyProgress, emptySave, type ProgressData } from "../../meta";
import { gameData } from "../../sim/testing/game-data";
import { ProgressSession } from "./progress-session";
import { indexedDbBackend, memoryBackend, type SaveBackend } from "./save-store";

const data = gameData();
const win = { won: true, phase: 21 };

/** A small in-memory IndexedDB: one database with object stores of key-value pairs. */
function fakeIndexedDb(): IDBFactory {
  const stores = new Map<string, Map<IDBValidKey, unknown>>();
  const later = <T>(result: () => T) => {
    const req = { result: undefined as T | undefined, error: null, onsuccess: null as null | (() => void), onerror: null };
    queueMicrotask(() => {
      req.result = result();
      req.onsuccess?.();
    });
    return req;
  };
  const db = {
    createObjectStore: (name: string) => stores.set(name, new Map()),
    transaction: (name: string) => ({
      objectStore: () => ({
        get: (key: IDBValidKey) => later(() => structuredClone(stores.get(name)!.get(key))),
        put: (value: unknown, key: IDBValidKey) => later(() => stores.get(name)!.set(key, structuredClone(value))),
      }),
    }),
  };
  return {
    open: () => {
      const req = { result: db, onupgradeneeded: null as null | (() => void), onsuccess: null as null | (() => void), onerror: null };
      queueMicrotask(() => {
        if (stores.size === 0) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  } as unknown as IDBFactory;
}

describe("ProgressSession", () => {
  it("records a win and opens the next world after a new load", async () => {
    const backend = memoryBackend<ProgressData>();
    const first = await ProgressSession.load(data, backend, { persistent: true, unlockAll: false });
    expect(first.isUnlocked(2, "normal")).toBe(false);
    first.record(1, "normal", win);
    expect(first.isUnlocked(2, "normal")).toBe(true);
    await first.flushed();
    const second = await ProgressSession.load(data, backend, { persistent: true, unlockAll: false });
    expect(second.isUnlocked(2, "normal")).toBe(true);
    expect(second.progress.best["1-normal"]).toEqual(win);
    expect(second.persistent).toBe(true);
  });

  it("unlockAll opens everything; persistent false keeps results only in memory", async () => {
    const backend = memoryBackend<ProgressData>();
    const session = await ProgressSession.load(data, backend, { persistent: false, unlockAll: true });
    expect(session.isUnlocked(5, "hell")).toBe(true);
    expect(session.unlocked()).toHaveLength(15);
    session.record(1, "normal", win);
    await session.flushed();
    expect(session.progress.best["1-normal"]).toEqual(win);
    expect(await backend.read()).toBeNull();
  });

  it("lists the open courses", async () => {
    const session = await ProgressSession.load(data, null, { persistent: false, unlockAll: false });
    expect(session.unlocked()).toEqual(["1-normal"]);
    expect(session.persistent).toBe(false);
  });

  it("a write that fails turns saving off", async () => {
    const backend: SaveBackend<ProgressData> = { read: () => Promise.resolve(null), write: () => Promise.reject(new Error("full")) };
    const session = await ProgressSession.load(data, backend, { persistent: true, unlockAll: false });
    session.record(1, "normal", win);
    await session.flushed();
    expect(session.persistent).toBe(false);
    expect(session.isUnlocked(2, "normal")).toBe(true);
  });

  it("broken stored data loads as empty progress", async () => {
    const session = await ProgressSession.load(data, memoryBackend<ProgressData>({ version: 7 }), { persistent: true, unlockAll: false });
    expect(session.progress).toEqual(emptyProgress());
    expect(session.droppedOnLoad).toBe(1);
  });
});

describe("the progress key in IndexedDB", () => {
  it("does not overwrite the gear", async () => {
    const factory = fakeIndexedDb();
    const gear = (await indexedDbBackend(factory))!;
    await gear.write({ ...emptySave(), items: { "tin-ring": 2 } });
    const progress = (await indexedDbBackend<ProgressData>(factory, "progress"))!;
    expect(await progress.read()).toBeNull();
    await progress.write({ version: 1, best: { "1-normal": win } });
    expect(await gear.read()).toEqual({ ...emptySave(), items: { "tin-ring": 2 } });
    expect(await progress.read()).toEqual({ version: 1, best: { "1-normal": win } });
  });
});
