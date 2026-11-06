import { messagesCs } from "./messages-cs";
import { messagesEn } from "./messages-en";

export type Lang = "en" | "cs";
export type MessageKey = keyof typeof messagesEn;

const tables: Record<Lang, Record<MessageKey, string>> = { en: messagesEn, cs: messagesCs };

let current: Lang = "en";

/** `?lang` wins; otherwise Czech browsers get Czech and everyone else English. */
export function pickLang(requested: Lang | undefined, browserLanguage: string): Lang {
  if (requested) return requested;
  return browserLanguage.toLowerCase().startsWith("cs") ? "cs" : "en";
}

export function setLang(lang: Lang): void {
  current = lang;
  document.documentElement.lang = lang;
}

export function t(key: MessageKey): string {
  return tables[current][key];
}
