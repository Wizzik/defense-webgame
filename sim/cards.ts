import { refreshHeroStats } from "./level-up";
import type { Run } from "./run";

export type Card =
  | { kind: "ability"; slot: number; fromLevel: number; toLevel: number }
  | { kind: "attribute"; attribute: "str" | "agi" | "int"; amount: number };

export interface CardOffer {
  cards: Card[];
}

/** Builds an offer of distinct cards (partial Fisher-Yates) and pauses the run. Rare, may allocate. */
export function openOffer(run: Run): void {
  const { progression } = run.data.rules;
  const candidates: Card[] = [];
  const slot = run.abilities[0];
  if (slot && slot.level < slot.def.levels) {
    candidates.push({ kind: "ability", slot: 0, fromLevel: slot.level, toLevel: slot.level + 1 });
  }
  const amount = progression.attributeCardAmount;
  candidates.push({ kind: "attribute", attribute: "str", amount });
  candidates.push({ kind: "attribute", attribute: "agi", amount });
  candidates.push({ kind: "attribute", attribute: "int", amount });

  const n = candidates.length;
  const k = Math.min(progression.cardsPerOffer, n);
  for (let i = 0; i < k; i++) {
    const j = i + run.rng.int(n - i);
    const t = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = t;
  }
  candidates.length = k;
  run.offer = { cards: candidates };
  run.state = "levelUp";
}

/** Applies the chosen card and resumes, or opens the next offer when level-ups remain. */
export function chooseCard(run: Run, index: number): void {
  const offer = run.offer;
  if (!offer || !Number.isInteger(index) || index < 0 || index >= offer.cards.length) return;
  const card = offer.cards[index];
  if (card.kind === "ability") {
    run.abilities[card.slot].level = card.toLevel;
  } else {
    run.hero[card.attribute] += card.amount;
  }
  refreshHeroStats(run);
  run.hero.pendingLevelUps--;
  if (run.hero.pendingLevelUps > 0) {
    openOffer(run);
  } else {
    run.offer = null;
    run.state = "playing";
  }
}
