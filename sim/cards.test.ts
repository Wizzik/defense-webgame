import { afterEach, describe, expect, it } from "vitest";
import { stateHash } from "./hash";
import { NO_INPUT } from "./input";
import { chooseCard, openOffer } from "./cards";
import { UPDATERS } from "./abilities/kinds";
import { gainXp } from "./level-up";
import { progressionRun } from "./testing/progression-run";

function offered(run: ReturnType<typeof progressionRun>) {
  gainXp(run, 4);
  run.step(NO_INPUT);
  return run.offer!.cards;
}

describe("cards", () => {
  it("choosing a card applies it and resumes", () => {
    for (let index = 0; index < 3; index++) {
      const run = progressionRun();
      const cards = offered(run);
      const card = cards[index];
      const before = { str: run.hero.str, agi: run.hero.agi, int: run.hero.int, max: run.hero.stats.maxHp, hp: run.hero.hp };
      run.step({ moveX: 0, moveY: 0, card: index });
      expect(run.state).toBe("playing");
      expect(run.offer).toBeNull();
      expect(run.hero.pendingLevelUps).toBe(0);
      if (card.kind === "ability") {
        expect(run.abilities[card.slot].level).toBe(card.toLevel);
        expect(card.fromLevel).toBe(1);
        expect(card.toLevel).toBe(2);
      } else {
        expect(run.hero[card.attribute]).toBe(before[card.attribute] + 10);
        if (card.attribute === "str") {
          expect(run.hero.stats.maxHp).toBeGreaterThan(before.max);
          expect(run.hero.hp - before.hp).toBeCloseTo(run.hero.stats.maxHp - before.max, 9);
        }
      }
    }
  });

  it("invalid card index is ignored", () => {
    const run = progressionRun();
    offered(run);
    const hash = stateHash(run);
    for (const card of [-1, 3, 99, 1.5, NaN]) {
      run.step({ moveX: 0, moveY: 0, card });
      expect(run.state).toBe("levelUp");
      expect(stateHash(run)).toBe(hash);
    }
    const idle = progressionRun();
    chooseCard(idle, 0);
    expect(idle.state).toBe("playing");
    expect(idle.hero.pendingLevelUps).toBe(0);
  });

  it("ability card disappears at max level", () => {
    const run = progressionRun();
    run.abilities[0].level = run.abilities[0].def.levels;
    for (let n = 0; n < 20; n++) {
      run.hero.pendingLevelUps = 1;
      openOffer(run);
      const cards = run.offer!.cards;
      expect(cards.every((c) => c.kind === "attribute")).toBe(true);
      expect(cards.map((c) => (c.kind === "attribute" ? c.attribute : "")).sort()).toEqual(["agi", "int", "str"]);
      chooseCard(run, 0);
    }
  });

  it("offer has fewer cards when fewer candidates exist", () => {
    const run = progressionRun({ cardsPerOffer: 4 });
    run.abilities[0].level = run.abilities[0].def.levels;
    run.hero.pendingLevelUps = 1;
    openOffer(run);
    expect(run.offer!.cards).toHaveLength(3);
  });

  it("ability card can be offered", () => {
    let seen = false;
    for (let n = 0; n < 30 && !seen; n++) {
      const run = progressionRun();
      run.rng.next();
      for (let i = 0; i < n; i++) run.rng.next();
      run.hero.pendingLevelUps = 1;
      openOffer(run);
      seen = run.offer!.cards.some((c) => c.kind === "ability");
    }
    expect(seen).toBe(true);
  });

  describe("learn and ultimate cards", () => {
    const stubbed: string[] = [];
    function stub(...kinds: string[]): void {
      for (const kind of kinds) {
        const updaters = UPDATERS as Record<string, unknown>;
        if (updaters[kind]) continue;
        updaters[kind] = () => {};
        stubbed.push(kind);
      }
    }
    afterEach(() => {
      for (const kind of stubbed) delete (UPDATERS as Record<string, unknown>)[kind];
      stubbed.length = 0;
    });

    function offerAt(level: number, ultimateLevel = 0) {
      const run = progressionRun({ cardsPerOffer: 10 });
      run.hero.level = level;
      run.abilities[3].level = ultimateLevel;
      run.hero.pendingLevelUps = 1;
      openOffer(run);
      return run.offer!.cards.map((c) =>
        c.kind === "ability" ? `${c.slot}:${c.fromLevel}>${c.toLevel}` : c.attribute,
      ).sort();
    }

    it("offers learn cards for unlearned signatures", () => {
      stub("on_hit", "on_cast", "nova");
      expect(offerAt(2)).toEqual(["0:1>2", "1:0>1", "2:0>1", "agi", "int", "str"]);
    });

    it("does not offer kinds without an updater", () => {
      expect(offerAt(2)).toEqual(["0:1>2", "agi", "int", "str"]);
    });

    it("the ultimate appears from ultimateFromLevel", () => {
      stub("on_hit", "on_cast", "nova");
      expect(offerAt(5)).not.toContain("3:0>1");
      expect(offerAt(6)).toContain("3:0>1");
      expect(offerAt(11, 1)).not.toContain("3:1>2");
      expect(offerAt(12, 1)).toContain("3:1>2");
    });

    it("learning an ability makes it ready", () => {
      stub("on_hit", "on_cast", "nova");
      const run = progressionRun({ cardsPerOffer: 10 });
      run.hero.level = 2;
      run.hero.pendingLevelUps = 1;
      openOffer(run);
      const index = run.offer!.cards.findIndex((c) => c.kind === "ability" && c.slot === 1);
      run.abilities[1].cooldown = 99;
      chooseCard(run, index);
      expect(run.abilities[1].level).toBe(1);
      expect(run.abilities[1].cooldown).toBe(0);
    });
  });
});
