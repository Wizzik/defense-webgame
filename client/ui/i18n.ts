import { messagesCs } from "./messages-cs";
import { messagesEn } from "./messages-en";

export type Lang = "en" | "cs";
export type MessageKey = keyof typeof messagesEn;

const tables: Record<Lang, Record<MessageKey, string>> = { en: messagesEn, cs: messagesCs };

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "cs";
}

/** The URL wins, then the stored choice, then the browser (Czech gets Czech), then English. */
export function pickLang(param: Lang | undefined, stored: string | null, browser: string): Lang {
  if (param) return param;
  if (isLang(stored)) return stored;
  return browser.toLowerCase().startsWith("cs") ? "cs" : "en";
}

/** Replaces every `{name}` with the value of the same name in `vars`. */
export function t(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const text = tables[lang][key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
