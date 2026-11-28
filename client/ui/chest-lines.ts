import type { GameData, Rarity, SlotType } from "../../data/schema";
import { rowTier } from "../../meta";
import { ChestAction, type ChestCard, type GearState, itemStatAt, slotTypeOf } from "../../sim";
import { type Lang, type MessageKey, t } from "./i18n";
import { itemLines, statLabel, statValue } from "./item-lines";
import { type ItemLine, tooltipLines } from "./item-tooltip";
import { cardItem, wornItem } from "./rolled-item";

/** What a chest card shows. */
export interface ChestLines {
  /** Name of the card's item: the rolled one (New, Choice) or the worn one (Level). */
  title: string;
  /** Name of the slot's type. */
  slot: string;
  slotType: SlotType;
  /** Id of the shown item (`rolled-<base id>` for a random one), for its icon. */
  itemId: string;
  rarity: Rarity;
  rarityName: string;
  /** What the pick does: "new for this run", "compare with X", "level 3 → 4". */
  action: string;
  /** Stat rows: the item at level 1, the comparison with the worn item, or the worn item's "from → to". */
  lines: ItemLine[];
}

function withTier(line: ItemLine, tier: number): ItemLine {
  return tier > 0 ? { ...line, tier } : line;
}

/** The text of a chest card for the hero's current gear. */
export function chestLines(lang: Lang, data: GameData, gear: GearState, card: ChestCard): ChestLines {
  const type = slotTypeOf(card.slot);
  const item = cardItem(data, card);
  const rules = data.rules.gear;
  const base = gear.base[card.slot]!;
  const temp = gear.temp[card.slot]!;
  const from = base + temp;
  let action: string;
  let lines: ChestLines["lines"];
  if (card.action === ChestAction.New) {
    action = t(lang, "chest.new");
    lines = itemLines(lang, item, 0, 1, rules).map((text, r) => withTier({ text, tone: "plain", stat: item.stats[r]!.stat }, rowTier(item, r)));
    if (item.effect) lines.push({ text: item.effect.text[lang], tone: "effect" });
  } else if (card.action === ChestAction.Choice) {
    const old = wornItem(data, gear, card.slot)!;
    action = t(lang, "chest.choice", { name: old.name[lang] });
    lines = tooltipLines(lang, data, item, 0, from + 1, { item: old, level: base, temp }).lines;
  } else {
    action = t(lang, "chest.level", { from, to: from + 1 });
    lines = item.stats.map((row, r) => withTier({
      text: `${statValue(row.stat, itemStatAt(row.value, base, temp, rules))} → ` +
        `${statValue(row.stat, itemStatAt(row.value, base, temp + 1, rules))} ${statLabel(lang, row.stat)}`,
      tone: "better",
      stat: row.stat,
    }, rowTier(item, r)));
  }
  return {
    title: item.name[lang],
    slot: t(lang, `slot.${type}` as MessageKey),
    slotType: type,
    itemId: item.id,
    rarity: item.rarity,
    rarityName: item.id.startsWith("rolled-")
      ? t(lang, "tooltip.random", { rarity: t(lang, `rarity.${item.rarity}` as MessageKey) })
      : t(lang, `rarity.${item.rarity}` as MessageKey),
    action,
    lines,
  };
}
