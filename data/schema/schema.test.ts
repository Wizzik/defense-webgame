import { describe, expect, it } from "vitest";
import { GameDataError, validateGameData } from "./index";

function fixture(): any {
  const names = (n: string) => ({ en: n, cs: n });
  const base = { levels: 3, cooldown: [5, 4, 3] };
  return {
    heroes: [
      {
        id: "hero-one",
        name: names("Hero"),
        primary: "str",
        moveSpeed: 300,
        attributes: {
          str: { base: 20, perLevel: 2 },
          agi: { base: 15, perLevel: 1.5 },
          int: { base: 10, perLevel: 1 },
        },
        baseAttack: { kind: "melee", range: 1.5, cooldown: 1.2, damageMin: 10, damageMax: 14 },
        signatureAbilities: ["pulse", "might", "rend"],
        ultimate: "swarm",
      },
    ],
    abilities: [
      { ...base, id: "pulse", name: names("Pulse"), kind: "nova", targeting: "around_self",
        params: { damage: [10, 20, 30], radius: [5, 6, 7] } },
      { ...base, id: "might", name: names("Might"), kind: "aura", targeting: "self",
        params: { damageBonus: [0.1, 0.2, 0.3] } },
      { ...base, id: "rend", name: names("Rend"), kind: "on_hit", targeting: "on_attack",
        params: { chance: [0.1, 0.2, 0.3] } },
      { ...base, id: "swarm", name: names("Swarm"), kind: "summon", targeting: "self",
        params: { count: [1, 2, 3], duration: [10, 10, 10], range: [1, 1, 1] } },
    ],
    constants: {
      strHitPointBonus: 19,
      agiAttackSpeedBonus: 0.02,
      defenseArmor: 1,
      attackSpeedCap: 4,
      mapVersion: "test",
    },
  };
}

function errorMessage(data: unknown): string {
  try {
    validateGameData(data);
  } catch (e) {
    expect(e).toBeInstanceOf(GameDataError);
    return (e as Error).message;
  }
  throw new Error("expected validateGameData to throw");
}

describe("game data schemas", () => {
  it("accepts valid game data", () => {
    const data = validateGameData(fixture());
    expect(data.heroes).toHaveLength(1);
    expect(data.abilities).toHaveLength(4);
  });

  it("reports path of invalid kind", () => {
    const d = fixture();
    d.abilities[0].kind = "bogus";
    expect(errorMessage(d)).toContain("abilities.0 (pulse).kind");
  });

  it("rejects per-level length mismatch", () => {
    const d = fixture();
    d.abilities[0].levels = 5;
    d.abilities[0].params = { damage: [1, 2, 3, 4, 5], radius: [1, 2, 3, 4, 5] };
    d.abilities[0].cooldown = [1, 2, 3];
    const msg = errorMessage(d);
    expect(msg).toContain("abilities.0 (pulse).cooldown");
    expect(msg).not.toContain("abilities.0 (pulse).params");
  });

  it("rejects params length mismatch", () => {
    const d = fixture();
    d.abilities[0].params.radius = [1];
    expect(errorMessage(d)).toContain("abilities.0 (pulse).params.radius");
  });

  it("rejects missing required param", () => {
    const d = fixture();
    delete d.abilities[0].params.radius;
    expect(errorMessage(d)).toContain("abilities.0 (pulse).params.radius");
  });

  it("rejects aura without any bonus param", () => {
    const d = fixture();
    d.abilities[1].params = { other: [1, 1, 1] };
    expect(errorMessage(d)).toContain("abilities.1 (might).params");
  });

  it("rejects dangling ability reference", () => {
    const d = fixture();
    d.heroes[0].signatureAbilities[1] = "missing-slug";
    expect(errorMessage(d)).toContain("missing-slug");
  });

  it("rejects duplicate ability id", () => {
    const d = fixture();
    d.abilities[1].id = "pulse";
    expect(errorMessage(d)).toContain("pulse");
  });

  it("rejects unknown top-level key", () => {
    const d = fixture();
    d.heroes[0].source = "H000";
    expect(errorMessage(d)).toContain("heroes.0 (hero-one)");
  });

  it("rejects unknown param key for the kind", () => {
    const d = fixture();
    d.abilities.push({
      levels: 3, cooldown: [5, 4, 3], id: "wave", name: { en: "W", cs: "W" }, kind: "line",
      targeting: "move_direction",
      params: { damage: [1, 2, 3], length: [1, 2, 3], width: [1, 2, 3], stunSecond: [1, 1, 1] },
    });
    const msg = errorMessage(d);
    expect(msg).toContain("abilities.4 (wave).params");
    expect(msg).toContain("stunSecond");
  });

  it("accepts optional params of the kind", () => {
    const d = fixture();
    d.abilities.push({
      levels: 3, cooldown: [5, 4, 3], id: "wave", name: { en: "W", cs: "W" }, kind: "line",
      targeting: "move_direction",
      params: {
        damage: [1, 2, 3], length: [1, 2, 3], width: [1, 2, 3],
        stunSeconds: [1, 1, 1], waveSpeed: [1, 1, 1],
      },
    });
    expect(() => validateGameData(d)).not.toThrow();
  });

  it("rejects levels 0 and 6", () => {
    for (const levels of [0, 6]) {
      const d = fixture();
      d.abilities[0].levels = levels;
      expect(errorMessage(d)).toContain("abilities.0 (pulse).levels");
    }
  });

  it("rejects negative cooldown", () => {
    const d = fixture();
    d.abilities[0].cooldown = [5, -1, 3];
    expect(errorMessage(d)).toContain("abilities.0 (pulse).cooldown.1");
  });

  it("renders root issues as (root)", () => {
    expect(errorMessage(42)).toMatch(/^\(root\): /);
  });
});
