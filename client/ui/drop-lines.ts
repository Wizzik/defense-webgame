import type { Item } from "../../data/schema";
import type { Drop } from "../../meta";
import { ChestAction } from "../../sim";
import { type Lang, t } from "./i18n";

/** The line that tells what a boss dropped, and the CSS class of its rarity ("" when nothing dropped); a rolled item reads as new. */
export function dropLine(lang: Lang, drop: Drop): { text: string; tone: string } {
  if (drop.kind === "none") return { text: t(lang, "drop.none"), tone: "" };
  const name = drop.item.name[lang];
  const text = drop.kind === "level" ? t(lang, "drop.level", { name, n: drop.level }) : t(lang, "drop.new", { name });
  return { text, tone: `rarity-${drop.item.rarity}` };
}

/** The news line of a chest pick that brings a legendary or mythic item (New or a taken Choice); null for any other pick. */
export function chestLootLine(
  lang: Lang, item: Item | null | undefined, action: number,
): { text: string; tone: string } | null {
  if (action !== ChestAction.New && action !== ChestAction.Choice) return null;
  if (!item || (item.rarity !== "legendary" && item.rarity !== "mythic")) return null;
  return { text: t(lang, "chest.loot", { name: item.name[lang] }), tone: `rarity-${item.rarity}` };
}
