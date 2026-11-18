import { describe, expect, it } from "vitest";
import { createRun, type Run } from "../run";
import { gameData } from "../testing/game-data";
import { silenceSpawns } from "../testing/silence";
import { gainGold } from "../crystals";
import { refreshHeroStats } from "../level-up";
import { learnAbility } from "./slots";

function run(): Run {
  const data = gameData();
  silenceSpawns(data);
  return createRun(data, { seed: 1, hero: "stonehorn" });
}

function learn(r: Run, slot: number, id: string, level: number): void {
  learnAbility(r, slot, r.data.abilities.findIndex((a) => a.id === id));
  r.abilities[slot].level = level;
  refreshHeroStats(r); // the same refresh a card choice runs
}

function param(r: Run, id: string, key: string, level: number): number {
  const def = r.data.abilities.find((a) => a.id === id)!;
  return (def.params as Record<string, number[]>)[key][level - 1];
}

describe("passives", () => {
  it("every passive changes exactly its stats by the value of its level", () => {
    const base = run();
    const s0 = { ...base.hero.stats };
    const checks: [string, (before: typeof s0, after: typeof s0, r: Run) => void][] = [
      ["might", (b, a, r) => {
        const k = param(r, "might", "attackBonus", 3);
        const dmg = 1 + r.hero.bonus.damage + r.hero.gear.damage;
        expect(a.damageMin / b.damageMin).toBeCloseTo((dmg + k) / dmg, 9);
      }],
      ["arcane-focus", (b, a, r) => {
        const k = param(r, "arcane-focus", "spellPowerBonus", 3);
        expect(a.spellPower / b.spellPower).toBeCloseTo((1 + r.hero.gear.spellPower + k) / (1 + r.hero.gear.spellPower), 9);
      }],
      ["haste", (b, a, r) => {
        const k = param(r, "haste", "cooldownBonus", 3);
        expect(1 / a.cooldownScale - 1 / b.cooldownScale).toBeCloseTo(k, 9);
      }],
      ["vigor", (b, a, r) => {
        expect(a.maxHp / b.maxHp).toBeCloseTo(1 + param(r, "vigor", "hpBonus", 3), 9);
        expect(a.regenPerSecond - b.regenPerSecond).toBeCloseTo(param(r, "vigor", "regenBonus", 3), 9);
      }],
      ["fleet-foot", (b, a, r) => {
        const ms = 1 + r.hero.bonus.moveSpeed + r.hero.gear.moveSpeed;
        expect(a.moveSpeed / b.moveSpeed).toBeCloseTo((ms + param(r, "fleet-foot", "moveSpeedBonus", 3)) / ms, 9);
        expect(a.attackIntervalSeconds).toBeLessThan(b.attackIntervalSeconds);
      }],
      ["fortune", (b, a, r) => {
        expect(r.hero.passive.gold).toBeCloseTo(param(r, "fortune", "goldBonus", 3), 9);
        expect(r.hero.passive.magnet).toBeCloseTo(param(r, "fortune", "magnetBonus", 3), 9);
        expect(a).toEqual(b);
      }],
    ];
    const keys = Object.keys(s0) as (keyof typeof s0)[];
    const touched: Record<string, (keyof typeof s0)[]> = {
      might: ["damageMin", "damageMax"],
      "arcane-focus": ["spellPower"],
      haste: ["cooldownScale"],
      vigor: ["maxHp", "regenPerSecond"],
      "fleet-foot": ["moveSpeed", "attackIntervalSeconds"],
      fortune: [],
    };
    for (const [id, check] of checks) {
      const r = run();
      learn(r, 6, id, 3);
      check(s0, r.hero.stats, r);
      for (const key of keys) {
        if (!touched[id].includes(key)) expect(r.hero.stats[key], `${id}: ${key}`).toBe(s0[key]);
      }
    }
  });

  it("passives stack with gear in the same sums", () => {
    const r = run();
    r.hero.gear.spellPower = 0.2;
    r.hero.gear.goldFind = 0.1;
    learn(r, 6, "arcane-focus", 5);
    learn(r, 7, "fortune", 5);
    const intPart = 1 + (r.hero.int + r.hero.gear.int) * r.data.rules.hero.spellPowerPerInt;
    expect(r.hero.stats.spellPower).toBeCloseTo(intPart * (1 + 0.2 + param(r, "arcane-focus", "spellPowerBonus", 5)), 9);
    expect(r.hero.passive.gold + r.hero.gear.goldFind).toBeCloseTo(0.1 + param(r, "fortune", "goldBonus", 5), 9);
  });

  it("vigor raises the hp of a living hero with its max hp", () => {
    const r = run();
    const before = r.hero.hp;
    learn(r, 6, "vigor", 1);
    expect(r.hero.hp - before).toBeCloseTo(r.hero.stats.maxHp / (1 + param(r, "vigor", "hpBonus", 1)) * param(r, "vigor", "hpBonus", 1), 6);
  });

  it("fortune scales collected gold", () => {
    const r = run();
    expect(gainGold(r, 100)).toBe(100);
    learn(r, 6, "fortune", 5);
    expect(gainGold(r, 100)).toBe(Math.round(100 * (1 + param(r, "fortune", "goldBonus", 5))));
  });
});
