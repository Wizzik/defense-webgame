import { describe, expect, it } from "vitest";
import type { Item } from "../../data/schema";
import { gameData } from "../../sim/testing/game-data";
import { iconSvg } from "./item-icons";
import { tooltipLines } from "./item-tooltip";

const helm: Item = {
  id: "test-helm", name: { en: "Test Helm", cs: "Zkušební přilba" }, slotType: "head", rarity: "rare",
  stats: [{ stat: "str", value: 14 }, { stat: "hp", value: 120 }],
};
const hood: Item = {
  id: "test-hood", name: { en: "Test Hood", cs: "Zkušební kápě" }, slotType: "head", rarity: "rare",
  stats: [{ stat: "str", value: 10 }, { stat: "int", value: 8 }],
};

describe("item tooltip", () => {
  const data = gameData();

  it("gives the name, the rarity and the line of rarity, slot and level", () => {
    const en = tooltipLines("en", data, helm, 2, 0);
    expect(en.name).toBe("Test Helm");
    expect(en.rarity).toBe("rare");
    expect(en.sub).toBe("Rare · Head · level 2");
    expect(en.lines).toEqual([
      { text: "+16.1 Strength", tone: "plain" },
      { text: "+138 HP", tone: "plain" },
    ]);
    expect(tooltipLines("cs", data, helm, 2, 0).sub).toBe("Vzácný · Hlava · úroveň 2");
  });

  it("temporary levels raise the numbers and get their own line", () => {
    const tip = tooltipLines("en", data, helm, 1, 2);
    expect(tip.sub).toBe("Rare · Head · level 1");
    expect(tip.lines).toEqual([
      { text: "+18.2 Strength", tone: "plain" },
      { text: "+156 HP", tone: "plain" },
      { text: "+2 levels from chests in this run", tone: "temp" },
    ]);
    expect(tooltipLines("cs", data, helm, 1, 1).lines.at(-1)).toEqual({ text: "+1 úroveň z truhel v tomto běhu", tone: "temp" });
  });

  it("an item a chest gave has no permanent level", () => {
    const tip = tooltipLines("cs", data, helm, 0, 3);
    expect(tip.sub).toBe("Vzácný · Hlava · jen na tento běh");
    expect(tip.lines[0]).toEqual({ text: "+18.2 síla", tone: "plain" });
    expect(tooltipLines("en", data, helm, 0, 1).sub).toBe("Rare · Head · this run only");
  });

  it("compares with the worn item: better, worse and lost rows", () => {
    const tip = tooltipLines("en", data, helm, 1, 0, { item: hood, level: 1 });
    expect(tip.lines).toEqual([
      { text: "+14 Strength (+4)", tone: "better" },
      { text: "+120 HP (+120)", tone: "better" },
      { text: "+0 Intelligence (−8)", tone: "worse" },
    ]);
    const same = tooltipLines("en", data, helm, 1, 0, { item: helm, level: 1 });
    expect(same.lines.every((line) => line.tone === "plain")).toBe(true);
    const lower = tooltipLines("en", data, helm, 1, 0, { item: helm, level: 3 });
    expect(lower.lines[0]).toEqual({ text: "+14 Strength (−4.2)", tone: "worse" });
  });

  it("a special effect gets its own line after the stats", () => {
    const item = data.items.find((i) => i.id === "frostbound-lantern")!;
    const tip = tooltipLines("cs", data, item, 1, 1);
    expect(tip.lines.map((line) => line.tone)).toEqual(["plain", "plain", "plain", "plain", "effect", "temp"]);
    expect(tip.lines[4]!.text).toBe("Nepřátelé poblíž tebe chodí o 25 % pomaleji.");
    expect(tooltipLines("en", data, item, 1, 0).lines[4]!.text).toBe("Enemies near you walk 25 % slower.");
  });

  it("names the bosses whose drop table holds the rarity", () => {
    const names = (id: string, lang: "en" | "cs") => data.enemies.find((e) => e.id === id)!.name[lang];
    expect(tooltipLines("en", data, helm, 1, 0).source).toBe(`Drops from: ${names("iron-marshal", "en")}, ${names("pale-abbot", "en")}`);
    expect(tooltipLines("cs", data, helm, 1, 0).source).toBe(`Padá: ${names("iron-marshal", "cs")}, ${names("pale-abbot", "cs")}`);
    const mythic: Item = { ...helm, rarity: "mythic", stats: [1, 2, 3, 4, 5].map(() => ({ stat: "str" as const, value: 1 })) };
    expect(tooltipLines("en", data, mythic, 1, 0).source).toBe(`Drops from: ${names("dread-regent", "en")}`);
    data.rules.drops = [];
    expect(tooltipLines("en", data, helm, 1, 0).source).toBe("");
  });
});

describe("item icons", () => {
  it("has a different glyph for each of the 14 slot types", () => {
    const types = ["head", "neck", "shoulders", "back", "chest", "wrist", "hands", "waist", "legs", "feet", "ring", "trinket", "mainHand", "offHand"] as const;
    const glyphs = types.map((type) => iconSvg(type));
    for (const glyph of glyphs) {
      expect(glyph.startsWith("<svg")).toBe(true);
      expect(glyph).toContain("currentColor");
    }
    expect(new Set(glyphs).size).toBe(14);
  });
});
