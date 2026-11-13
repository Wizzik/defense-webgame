import type { SaveData } from "../../meta";

/** Where the gear is kept between visits. `read` gives what was stored (any shape) or null when nothing was. */
export interface SaveBackend {
  read(): Promise<unknown>;
  write(save: SaveData): Promise<void>;
}

const DB_NAME = "defense-webgame";
const STORE = "save";
const KEY = "gear";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

/**
 * The browser's IndexedDB as a backend; null when the browser has none or it cannot be opened (private windows
 * of some browsers, blocked storage). The caller then plays without saving.
 */
export async function indexedDbBackend(
  factory: IDBFactory | undefined = typeof indexedDB === "undefined" ? undefined : indexedDB,
): Promise<SaveBackend | null> {
  if (!factory) return null;
  try {
    const open = factory.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    const db = await request(open);
    return {
      read: async () => (await request(db.transaction(STORE, "readonly").objectStore(STORE).get(KEY))) ?? null,
      write: async (save) => {
        await request(db.transaction(STORE, "readwrite").objectStore(STORE).put(save, KEY));
      },
    };
  } catch {
    return null;
  }
}

/** A backend that lives as long as the page: for debugging sessions and tests. It keeps copies, like a real store. */
export function memoryBackend(initial: unknown = null): SaveBackend {
  let stored: unknown = initial === null ? null : structuredClone(initial);
  return {
    read: () => Promise.resolve(stored === null ? null : structuredClone(stored)),
    write: (save) => {
      stored = structuredClone(save);
      return Promise.resolve();
    },
  };
}
