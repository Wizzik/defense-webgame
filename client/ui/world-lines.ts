import type { DifficultyId, GameData } from "../../data/schema";
import type { CourseResult } from "../../meta";
import { difficultyMods } from "../../sim";
import { type Lang, type MessageKey, t } from "./i18n";

const FINALE_PHASE = 21;

export interface WorldCardLines {
  name: string;
  /** "★ win", "phase N", "finale" or empty. */
  status: string;
  locked: boolean;
  /** The world is playable but still has the look of world 1 ("coming soon"). */
  preparing: boolean;
}

/** Up to two decimals without trailing zeros; Czech with a decimal comma. */
function factor(value: number, lang: Lang): string {
  const text = String(Number(value.toFixed(2)));
  return lang === "cs" ? text.replace(".", ",") : text;
}

export function difficultyName(id: DifficultyId, lang: Lang): string {
  return t(lang, `difficulty.${id}` as MessageKey);
}

export function worldCard(
  data: GameData, world: number, best: CourseResult | undefined, unlocked: boolean, lang: Lang,
): WorldCardLines {
  const def = data.worlds[world - 1]!;
  let status = "";
  if (best?.won) status = t(lang, "world.won");
  else if (best?.phase === FINALE_PHASE) status = t(lang, "world.finale");
  else if (best) status = t(lang, "world.phase", { n: best.phase });
  return { name: def.name[lang], status, locked: !unlocked, preparing: !def.ready };
}

/** The lines under the chosen card: the blurb, the enemy strength (hp multiplier), the reward and the natural event. */
export function worldDetail(data: GameData, world: number, difficulty: DifficultyId, lang: Lang): string[] {
  const def = data.worlds[world - 1]!;
  const mods = difficultyMods(data.rules, world, difficulty);
  const parts: string[] = [];
  if (mods.gold > 1) parts.push(t(lang, "world.rewardGold", { x: factor(mods.gold, lang) }));
  const mf = Math.round(mods.magicFind * 100);
  if (mf > 0) parts.push(t(lang, "world.rewardMagicFind", { n: mf }));
  return [
    def.blurb[lang],
    t(lang, "world.strength", { x: factor(mods.hp, lang) }),
    parts.length > 0 ? t(lang, "world.reward", { parts: parts.join(", ") }) : t(lang, "world.noReward"),
    t(lang, "world.hazard", { name: def.hazard.name[lang] }),
  ];
}
