import { UPDATERS } from "./abilities/kinds";
import {
  firstEmptySlot, isEmptySlot, learnAbility, passiveSlotRange, sharedSlotRange, ULTIMATE_SLOT,
} from "./abilities/slots";
import { refreshHeroStats } from "./level-up";
import type { Run } from "./run";

export type Card =
  | { kind: "ability"; slot: number; fromLevel: number; toLevel: number }
  /** Learn ability `ability` (index into data.abilities) into the empty slot `slot`. */
  | { kind: "learn"; slot: number; ability: number }
  | { kind: "attribute"; attribute: "str" | "agi" | "int"; amount: number };

export interface CardOffer {
  cards: Card[];
}

const ATTRIBUTES = ["str", "agi", "int"] as const;

/** Upgrades of the kit (slots 0-3): signature spells, learning one from level 0, and the ultimate by its rule. */
function signatureCards(run: Run): Card[] {
  const { ultimateFromLevel, ultimateLevelStep } = run.data.rules.progression;
  const cards: Card[] = [];
  for (let i = 0; i <= ULTIMATE_SLOT; i++) {
    const slot = run.abilities[i];
    if (slot.level >= slot.def.levels || !UPDATERS[slot.def.kind]) continue;
    if (i === ULTIMATE_SLOT && run.hero.level < ultimateFromLevel + slot.level * ultimateLevelStep) continue;
    cards.push({ kind: "ability", slot: i, fromLevel: slot.level, toLevel: slot.level + 1 });
  }
  return cards;
}

/** Upgrades of the learned shared spells and passives. */
function sharedUpgradeCards(run: Run): Card[] {
  const cards: Card[] = [];
  for (let i = ULTIMATE_SLOT + 1; i < run.abilities.length; i++) {
    const slot = run.abilities[i];
    if (isEmptySlot(slot) || slot.level >= slot.def.levels || !UPDATERS[slot.def.kind]) continue;
    cards.push({ kind: "ability", slot: i, fromLevel: slot.level, toLevel: slot.level + 1 });
  }
  return cards;
}

/** A learn card for every ability of `pool` the hero does not have, while a slot of `range` is empty. */
function learnCards(run: Run, pool: readonly string[], range: [number, number]): Card[] {
  const slot = firstEmptySlot(run, range);
  if (slot < 0) return [];
  const cards: Card[] = [];
  for (const id of pool) {
    const ability = run.data.abilities.findIndex((a) => a.id === id);
    const def = run.data.abilities[ability];
    if (!def || !UPDATERS[def.kind] || run.abilities.some((s) => s.def === def)) continue;
    cards.push({ kind: "learn", slot, ability });
  }
  return cards;
}

/** The four card groups with their weights, in the order A signature, B shared upgrade, C new spell, D new passive. */
export function cardGroups(run: Run): { weight: number; cards: Card[] }[] {
  const { progression } = run.data.rules;
  const w = progression.cardWeights;
  return [
    { weight: w.signature, cards: signatureCards(run) },
    { weight: w.sharedUpgrade, cards: sharedUpgradeCards(run) },
    { weight: w.newSpell, cards: learnCards(run, progression.sharedSpells, sharedSlotRange(run)) },
    { weight: w.newPassive, cards: learnCards(run, progression.passives, passiveSlotRange(run)) },
  ];
}

/**
 * Builds an offer of distinct cards and pauses the run. Each card draws a group by weight (only groups with
 * cards left), then a card of that group uniformly; the card leaves its group. When every group is empty the
 * offer is filled with attribute cards (STR, AGI, INT without repeats). Rare, may allocate.
 */
export function openOffer(run: Run): void {
  const { progression } = run.data.rules;
  const groups = cardGroups(run);
  const cards: Card[] = [];
  while (cards.length < progression.cardsPerOffer) {
    let total = 0;
    for (const g of groups) if (g.cards.length > 0) total += g.weight;
    if (total <= 0) break;
    let pick = run.rng.next() * total;
    let group = groups[groups.length - 1];
    for (const g of groups) {
      if (g.cards.length === 0) continue;
      group = g;
      if (pick < g.weight) break;
      pick -= g.weight;
    }
    const [card] = group.cards.splice(run.rng.int(group.cards.length), 1);
    cards.push(card);
  }
  const attributes: Card[] = ATTRIBUTES.map((attribute) => ({
    kind: "attribute", attribute, amount: progression.attributeCardAmount,
  }));
  for (let i = 0; cards.length < progression.cardsPerOffer && i < attributes.length; i++) {
    const j = i + run.rng.int(attributes.length - i);
    const t = attributes[i];
    attributes[i] = attributes[j];
    attributes[j] = t;
    cards.push(attributes[i]);
  }
  run.offer = { cards };
  run.state = "levelUp";
}

/** Applies the chosen card and resumes, or opens the next offer when level-ups remain. */
export function chooseCard(run: Run, index: number): void {
  const offer = run.offer;
  if (!offer || !Number.isInteger(index) || index < 0 || index >= offer.cards.length) return;
  const card = offer.cards[index];
  if (card.kind === "ability") {
    const slot = run.abilities[card.slot];
    slot.level = card.toLevel;
    if (card.fromLevel === 0) slot.cooldown = 0;
  } else if (card.kind === "learn") {
    learnAbility(run, card.slot, card.ability);
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
