import type { GameData, Rarity, SlotType } from "../../data/schema";
import { ChestAction, type ChestCard, type GearState, itemStatAt, slotTypeOf } from "../../sim";
import { type Lang, type MessageKey, t } from "./i18n";
import { itemLines, statLabel, statValue } from "./item-lines";
import { type LineTone, tooltipLines } from "./item-tooltip";

/** What a chest card shows. */
export interface ChestLines {
  /** Name of the card's item: the rolled one (New, Replace) or the worn one (Level). */
  title: string;
  /** Name of the slot's type. */
  slot: string;
  slotType: SlotType;
  rarity: Rarity;
  rarityName: string;
  /** What the pick does: "new for this run", "replaces X for this run", "level 3 → 4". */
  action: string;
  /** Stat rows: the item at level 1, the comparison with the worn item, or the worn item's "from → to". */
  lines: { text: string; tone: LineTone }[];
}

/** The text of a chest card for the hero's current gear. */
export function chestLines(lang: Lang, data: GameData, gear: GearState, card: ChestCard): ChestLines {
  const type = slotTypeOf(card.slot);
  const item = data.items[card.item]!;
  const step = data.rules.gear.levelStep;
  const worn = gear.item[card.slot]!;
  const from = gear.base[card.slot]! + gear.temp[card.slot]!;
  let action: string;
  let lines: ChestLines["lines"];
  if (card.action === ChestAction.New) {
    action = t(lang, "chest.new");
    lines = itemLines(lang, item, 1, step).map((text) => ({ text, tone: "plain" as LineTone }));
    if (item.effect) lines.push({ text: item.effect.text[lang], tone: "effect" });
  } else if (card.action === ChestAction.Replace) {
    const old = data.items[worn]!;
    action = t(lang, "chest.replace", { name: old.name[lang] });
    lines = tooltipLines(lang, data, item, 0, from + 1, { item: old, level: from }).lines;
  } else {
    action = t(lang, "chest.level", { from, to: from + 1 });
    lines = item.stats.map((row) => ({
      text: `${statValue(row.stat, itemStatAt(row.value, from, step))} → ` +
        `${statValue(row.stat, itemStatAt(row.value, from + 1, step))} ${statLabel(lang, row.stat)}`,
      tone: "better" as LineTone,
    }));
  }
  return {
    title: item.name[lang],
    slot: t(lang, `slot.${type}` as MessageKey),
    slotType: type,
    rarity: item.rarity,
    rarityName: t(lang, `rarity.${item.rarity}` as MessageKey),
    action,
    lines,
  };
}
