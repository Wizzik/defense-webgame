import { describe, expect, it } from "vitest";
import { learnAbility } from "./abilities/slots";
import { botCard, idleCard } from "./bot";
import type { Card } from "./cards";
import { cardGroups, chooseCard, openOffer } from "./cards";
import { stateHash } from "./hash";
import type { Run } from "./run";
import { progressionRun } from "./testing/progression-run";

const indexOf = (run: Run, id: string) => run.data.abilities.findIndex((a) => a.id === id);
const key = (c: Card) => JSON.stringify(c);

function offer(run: Run): Card[] {
  run.hero.pendingLevelUps = 1;
  openOffer(run);
  return run.offer!.cards;
}

/** Group of a card: 0 signature, 1 shared upgrade, 2 new spell, 3 new passive, 4 attribute. */
function groupOf(card: Card): number {
  if (card.kind === "attribute") return 4;
  if (card.kind === "learn") return card.slot < 6 ? 2 : 3;
  return card.slot <= 3 ? 0 : 1;
}

describe("card groups", () => {
  it("an offer never holds two equal cards nor a learn card for an ability the hero has", () => {
    const run = progressionRun();
    run.hero.level = 30;
    for (let n = 0; n < 300; n++) {
      const cards = offer(run);
      expect(new Set(cards.map(key)).size).toBe(cards.length);
      for (const c of cards) {
        if (c.kind !== "learn") continue;
        expect(run.abilities.some((s) => s.def === run.data.abilities[c.ability])).toBe(false);
      }
      chooseCard(run, run.rng.int(cards.length));
    }
  });

  it("learn cards go to the first empty slot of their range and vanish when the range is full", () => {
    const run = progressionRun();
    const learns = () => cardGroups(run).flatMap((g) => g.cards).filter((c) => c.kind === "learn");
    expect(new Set(learns().map((c) => c.slot))).toEqual(new Set([4, 6]));
    expect(learns()).toHaveLength(10 + 6);
    learnAbility(run, 4, indexOf(run, "meteor"));
    learnAbility(run, 5, indexOf(run, "smite"));
    expect(learns().every((c) => c.slot === 6)).toBe(true);
    for (const [slot, id] of [[6, "might"], [7, "haste"], [8, "vigor"], [9, "fortune"]] as const) {
      learnAbility(run, slot, indexOf(run, id));
    }
    expect(learns()).toEqual([]);
  });

  it("with the whole kit at its top level an offer holds only the three attributes, as STR, AGI, INT", () => {
    const run = progressionRun();
    for (const [slot, id] of [[4, "meteor"], [5, "smite"], [6, "might"], [7, "haste"], [8, "vigor"], [9, "fortune"]] as const) {
      learnAbility(run, slot, indexOf(run, id));
    }
    for (const slot of run.abilities) slot.level = slot.def.levels;
    const cards = offer(run);
    expect(cards.map((c) => (c.kind === "attribute" ? c.attribute : "x"))).toEqual(["str", "agi", "int"]);
  });

  it("the first card of an offer follows the group weights", () => {
    const run = progressionRun();
    learnAbility(run, 4, indexOf(run, "meteor"));
    const w = run.data.rules.progression.cardWeights;
    const total = w.signature + w.sharedUpgrade + w.newSpell + w.newPassive;
    const counts = [0, 0, 0, 0, 0];
    const N = 2000;
    for (let n = 0; n < N; n++) counts[groupOf(offer(run)[0])]++;
    expect(counts[0] / N).toBeCloseTo(w.signature / total, 1);
    expect(counts[1] / N).toBeCloseTo(w.sharedUpgrade / total, 1);
    expect(counts[2] / N).toBeCloseTo(w.newSpell / total, 1);
    expect(counts[3] / N).toBeCloseTo(w.newPassive / total, 1);
    expect(counts[4]).toBe(0);
  });

  it("the same seed gives the same offer", () => {
    const a = progressionRun();
    const b = progressionRun();
    expect(offer(a)).toEqual(offer(b));
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it("a learn card learns the ability at level 1", () => {
    const run = progressionRun();
    run.hero.pendingLevelUps = 1;
    run.offer = { cards: [{ kind: "learn", slot: 6, ability: indexOf(run, "vigor") }] };
    run.state = "levelUp";
    const before = run.hero.stats.maxHp;
    chooseCard(run, 0);
    expect(run.abilities[6].def.id).toBe("vigor");
    expect(run.abilities[6].level).toBe(1);
    expect(run.hero.stats.maxHp).toBeGreaterThan(before);
    expect(run.state).toBe("playing");
  });
});

describe("autopilot card order", () => {
  const cards = (run: Run): Card[] => [
    { kind: "attribute", attribute: "str", amount: 10 },
    { kind: "ability", slot: 7, fromLevel: 1, toLevel: 2 },
    { kind: "learn", slot: 8, ability: indexOf(run, "fortune") },
    { kind: "ability", slot: 5, fromLevel: 1, toLevel: 2 },
    { kind: "learn", slot: 4, ability: indexOf(run, "meteor") },
    { kind: "ability", slot: 1, fromLevel: 0, toLevel: 1 },
    { kind: "ability", slot: 3, fromLevel: 0, toLevel: 1 },
  ];

  it("takes the ultimate, then the signature, new spell, shared upgrade, new passive, passive upgrade, attribute", () => {
    const run = progressionRun();
    const all = cards(run);
    const order: number[] = [];
    const left = [...all];
    while (left.length > 0) {
      const pick = botCard(run, { cards: left });
      order.push(all.indexOf(left[pick]));
      left.splice(pick, 1);
    }
    expect(order).toEqual([6, 5, 4, 3, 2, 1, 0]);
  });

  it("the earlier card wins a tie; the idle player takes the attribute, else the weakest", () => {
    const run = progressionRun();
    const up = (slot: number): Card => ({ kind: "ability", slot, fromLevel: 1, toLevel: 2 });
    expect(botCard(run, { cards: [up(2), up(1), up(0)] })).toBe(0);
    expect(idleCard(run, { cards: cards(run) })).toBe(0);
    expect(idleCard(run, { cards: [up(0), up(7), up(6)] })).toBe(1);
  });
});
