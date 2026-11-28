import { describe, expect, it } from "vitest";
import items from "../../data/generated/items.json";
import loot from "../../data/generated/loot.json";
import { itemIconHtml } from "./item-icons";
import { ITEM_TINTS, itemTint } from "./item-tints";

describe("item tints", () => {
  it("every base and named item has a colour of its own picture, and every colour belongs to one", () => {
    const ids = [...loot.bases.map((base) => base.id), ...items.map((item) => item.id)];
    for (const id of ids) expect(itemTint(id), id).toMatch(/^#[0-9a-f]{6}$/);
    expect(Object.keys(ITEM_TINTS).sort()).toEqual([...ids].sort());
  });

  it("a random item takes its base's colour, and the picture carries it", () => {
    expect(itemTint("rolled-jade-ring")).toBe(itemTint("jade-ring"));
    expect(itemIconHtml("rolled-jade-ring", "ring")).toContain(`--tint: ${itemTint("jade-ring")}`);
  });
});
