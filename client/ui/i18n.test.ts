import { describe, expect, it } from "vitest";
import { pickLang, t } from "./i18n";
import { messagesCs } from "./messages-cs";
import { messagesEn } from "./messages-en";

describe("i18n", () => {
  it("cs has exactly the en keys", () => {
    expect(Object.keys(messagesCs).sort()).toEqual(Object.keys(messagesEn).sort());
  });

  it("pickLang prefers the URL, then storage, then the browser", () => {
    expect(pickLang("cs", "en", "en-US")).toBe("cs");
    expect(pickLang(undefined, "cs", "en-US")).toBe("cs");
    expect(pickLang(undefined, "junk", "cs-CZ")).toBe("cs");
    expect(pickLang(undefined, null, "de-DE")).toBe("en");
  });

  it("t fills placeholders", () => {
    expect(t("en", "hud.phase", { n: 2, total: 4 })).toBe("Phase 2/4");
    expect(t("cs", "menu.hero", { name: "Kamenorog" })).toBe("Hrdina: Kamenorog");
    expect(t("en", "menu.start")).toBe("Start");
  });
});
