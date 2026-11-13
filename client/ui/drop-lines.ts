import type { Drop } from "../../meta";
import { type Lang, t } from "./i18n";

/** The line that tells what a boss dropped, and the CSS class of its rarity ("" when nothing dropped). */
export function dropLine(lang: Lang, drop: Drop): { text: string; tone: string } {
  if (drop.kind === "none") return { text: t(lang, "drop.none"), tone: "" };
  const name = drop.item.name[lang];
  const text = drop.kind === "new" ? t(lang, "drop.new", { name }) : t(lang, "drop.level", { name, n: drop.level });
  return { text, tone: `rarity-${drop.item.rarity}` };
}
