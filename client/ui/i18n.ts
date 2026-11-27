import { messagesCs } from "./messages-cs";
import { messagesEn } from "./messages-en";

export type Lang = "en" | "cs";
export type MessageKey = keyof typeof messagesEn;

/**
 * English only for now (Petr, 2026-11-27): new texts need no Czech; a key missing from the Czech table shows the
 * English text.
 */
const tables: Record<Lang, Partial<Record<MessageKey, string>>> = { en: messagesEn, cs: messagesCs };

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "cs";
}

/** The URL wins, then the stored choice, then English (English only for now: a Czech browser no longer gets Czech). */
export function pickLang(param: Lang | undefined, stored: string | null, _browser: string): Lang {
  if (param) return param;
  if (isLang(stored)) return stored;
  return "en";
}

/** Replaces every `{name}` with the value of the same name in `vars`. */
export function t(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const text = tables[lang][key] ?? messagesEn[key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
