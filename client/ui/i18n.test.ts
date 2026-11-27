import { describe, expect, it } from "vitest";
import { pickLang, t } from "./i18n";
import { messagesCs } from "./messages-cs";
import { messagesEn } from "./messages-en";

describe("i18n", () => {
  it("cs has only en keys; a missing one shows the English text (English only for now)", () => {
    const en = new Set(Object.keys(messagesEn));
    for (const key of Object.keys(messagesCs)) expect(en.has(key)).toBe(true);
    const cs = messagesCs as Partial<Record<string, string>>;
    const kept = cs["menu.start"];
    delete cs["menu.start"];
    try {
      expect(t("cs", "menu.start")).toBe(messagesEn["menu.start"]);
    } finally {
      cs["menu.start"] = kept;
    }
  });

  it("pickLang prefers the URL, then storage, then English", () => {
    expect(pickLang("cs", "en", "en-US")).toBe("cs");
    expect(pickLang(undefined, "cs", "en-US")).toBe("cs");
    expect(pickLang(undefined, "junk", "cs-CZ")).toBe("en");
    expect(pickLang(undefined, null, "de-DE")).toBe("en");
  });

  it("t fills placeholders", () => {
    expect(t("en", "hud.phase", { n: 2, total: 4 })).toBe("Phase 2/4");
    expect(t("cs", "menu.chooseHero")).toBe("Vyber hrdinu");
    expect(t("en", "menu.start")).toBe("Start");
  });
});
