export interface Settings {
  master: number;
  music: number;
  sfx: number;
  shake: boolean;
  numbers: boolean;
}

export const SETTINGS_KEY = "defense-webgame.settings";
export const DEFAULT_SETTINGS: Readonly<Settings> = { master: 0.8, music: 0.3, sfx: 0.8, shake: true, numbers: true };

function volume(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
}

function flag(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/** Reads the settings; anything missing, broken or unreadable falls back to the defaults. */
export function loadSettings(storage: Pick<Storage, "getItem"> | null): Settings {
  let raw: unknown = null;
  try {
    const text = storage?.getItem(SETTINGS_KEY);
    if (text) raw = JSON.parse(text);
  } catch {
    raw = null;
  }
  const o = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_SETTINGS;
  return {
    master: volume(o.master, d.master),
    music: volume(o.music, d.music),
    sfx: volume(o.sfx, d.sfx),
    shake: flag(o.shake, d.shake),
    numbers: flag(o.numbers, d.numbers),
  };
}

export function saveSettings(storage: Pick<Storage, "setItem"> | null, s: Settings): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // storage full or denied: the settings last for this visit
  }
}
