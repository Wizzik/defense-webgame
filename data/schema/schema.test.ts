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
        role: names("Role"),
        primary: "str",
        hp: 800,
        armor: 2,
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
      { ...base, id: "pulse", name: names("Pulse"), description: names("d"), kind: "nova", targeting: "around_self",
        params: { damage: [10, 20, 30], radius: [5, 6, 7] } },
      { ...base, id: "might", name: names("Might"), description: names("d"), kind: "aura", targeting: "self",
        params: { damageBonus: [0.1, 0.2, 0.3] } },
      { ...base, id: "rend", name: names("Rend"), description: names("d"), kind: "on_hit", targeting: "on_attack",
        params: { chance: [0.1, 0.2, 0.3] } },
      { ...base, id: "swarm", name: names("Swarm"), description: names("d"), kind: "summon", targeting: "self",
        params: { count: [1, 2, 3], duration: [10, 10, 10], range: [1, 1, 1], damageDealt: [1, 1, 1] } },
    ],
    enemies: [
      {
        id: "grunt", name: names("Grunt"), level: 1, hp: 400, hpRegen: 0.25, armor: 3, moveSpeed: 270,
        collision: 31, acquireRange: 500,
        attack: { kind: "melee", range: 90, cooldown: 1.35, damageMin: 14, damageMax: 15 }, xp: 1,
      },
    ],
    rules: {
      start: { hero: "hero-one" },
      run: { durationSeconds: 180, phaseSeconds: 50, timeScaling: { seconds: 1200, cap: 2 } },
      arena: {
        width: 6000, height: 5000, castle: { x: 0, y: -2000 }, heroStart: { x: 0, y: -1500 },
        gates: [{ x: -1800, y: 2200 }, { x: 1800, y: 2200 }], gateRadius: 150,
      },
      castle: { hp: 3000, radius: 180, regenPercentPerMinute: 2 },
      hero: { collision: 32, baseRegen: 0.25, regenPerStr: 0.05, spellPowerPerInt: 0.01, cooldownSpeedPerInt: 0.01,
        dash: { distance: 350, seconds: 0.15, cooldownSeconds: 4 } },
      autocast: { novaMinEnemies: 1, healBelow: 0.6, shieldBelow: 0.35 },
      enemies: { maxAlive: 150, siegerAggroRange: 250, leashRange: 900, knockback: { attack: 40, ability: 90, seconds: 0.15 } },
      phases: [
        { enemy: "grunt", spawnPerSecond: 0.45, hunterShare: 0.2 },
        { enemy: "grunt", spawnPerSecond: 0.55, hunterShare: 0.25 },
        { enemy: "grunt", spawnPerSecond: 0.65, hunterShare: 0.3 },
        { enemy: "grunt", spawnPerSecond: 0.75, hunterShare: 0.35 },
      ],
      progression: {
        xpFirst: 4, xpStep: 2, magnetRadius: 300, crystalSpeed: 900, pickupRadius: 56,
        attributeCardAmount: 10, cardsPerOffer: 3, ultimateFromLevel: 6, ultimateLevelStep: 6,
      },
    },
    constants: {
      strHitPointBonus: 19,
      agiAttackSpeedBonus: 0.02,
      defenseArmor: 1,
      agiDefenseBonus: 0.1,
      primaryAttackBonus: 1,
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
      levels: 3, cooldown: [5, 4, 3], id: "wave", name: { en: "W", cs: "W" }, description: { en: "W", cs: "W" }, kind: "line",
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
      levels: 3, cooldown: [5, 4, 3], id: "wave", name: { en: "W", cs: "W" }, description: { en: "W", cs: "W" }, kind: "line",
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

  it("rejects an enemy without an attack kind", () => {
    const d = fixture();
    delete d.enemies[0].attack.kind;
    expect(errorMessage(d)).toContain("enemies.0 (grunt).attack.kind");
  });

  it("rejects an enemy heal with a zero amount", () => {
    const d = fixture();
    d.enemies[0].heal = { amount: 0, range: 450, cooldown: 1 };
    expect(errorMessage(d)).toContain("enemies.0 (grunt).heal.amount");
  });

  it("rejects enemy attack cooldown 0", () => {
    const d = fixture();
    d.enemies[0].attack.cooldown = 0;
    expect(errorMessage(d)).toContain("enemies.0 (grunt).attack.cooldown");
  });

  it("rejects phase with unknown enemy", () => {
    const d = fixture();
    d.rules.phases[2].enemy = "ghost";
    const msg = errorMessage(d);
    expect(msg).toContain("rules.phases.2.enemy");
    expect(msg).toContain("ghost");
  });

  it("rejects an unknown start hero", () => {
    const d = fixture();
    d.rules.start.hero = "x";
    expect(errorMessage(d)).toContain('rules.start.hero: unknown hero "x"');
  });

  it("requires a description", () => {
    const d = fixture();
    delete d.abilities[0].description;
    expect(errorMessage(d)).toContain("abilities.0 (pulse).description");
  });

  it("accepts the on_cast kind", () => {
    const d = fixture();
    d.abilities.push({
      levels: 3, cooldown: [5, 4, 3], id: "echo", name: { en: "E", cs: "E" }, description: { en: "E", cs: "E" },
      kind: "on_cast", targeting: "on_cast",
      params: { damage: [1, 2, 3], radius: [1, 1, 1], stunSeconds: [1, 1, 1] },
    });
    expect(() => validateGameData(d)).not.toThrow();
  });

  it("accepts empower, healPerHit and speed", () => {
    const d = fixture();
    d.abilities[2].params = { empower: [3, 5, 7] };
    d.abilities.push({
      ...d.abilities[0], id: "grasp", kind: "area", targeting: "densest_cluster",
      params: { damage: [1, 2, 3], radius: [1, 1, 1], range: [1, 1, 1], healPerHit: [1, 2, 3] },
    }, {
      ...d.abilities[0], id: "bolt", kind: "projectile", targeting: "nearest",
      params: { damage: [1, 2, 3], range: [1, 1, 1], speed: [1200, 1200, 1200] },
    });
    expect(() => validateGameData(d)).not.toThrow();
  });

  it("summon needs images or wards params", () => {
    const base = { count: [1, 1, 1], duration: [5, 5, 5] };
    const images = { damageDealt: [1, 1, 1] };
    const wards = { damage: [1, 1, 1], attackRange: [1, 1, 1], attackInterval: [1, 1, 1], maxAlive: [1, 1, 1] };
    const msg = "summon needs damageDealt (images) or damage, attackRange, attackInterval and maxAlive (wards)";
    const withParams = (params: unknown) => {
      const d = fixture();
      d.abilities[3].params = params;
      return d;
    };
    expect(() => validateGameData(withParams({ ...base, ...images }))).not.toThrow();
    expect(() => validateGameData(withParams({ ...base, ...wards }))).not.toThrow();
    expect(errorMessage(withParams(base))).toContain(msg);
    expect(errorMessage(withParams({ ...base, ...images, ...wards }))).toContain(msg);
    const partial = { ...base, damage: [1, 1, 1] };
    expect(errorMessage(withParams(partial))).toContain(msg);
  });

  it("requires autocast, dash and ultimate levels", () => {
    for (const mutate of [
      (d: any) => delete d.rules.autocast,
      (d: any) => delete d.rules.hero.dash,
      (d: any) => delete d.rules.progression.ultimateFromLevel,
      (d: any) => delete d.rules.progression.ultimateLevelStep,
    ]) {
      const d = fixture();
      mutate(d);
      expect(errorMessage(d)).toContain("rules.");
    }
  });

  it("rejects phases shorter than the run", () => {
    const d = fixture();
    d.rules.phases.pop();
    expect(errorMessage(d)).toContain("phases cover 150 s, the run lasts 180 s");
  });

  it("rejects gate outside the arena", () => {
    const d = fixture();
    d.rules.arena.gates[1].x = 3001;
    expect(errorMessage(d)).toContain("rules.arena.gates.1");
  });

  it("rejects duplicate enemy id", () => {
    const d = fixture();
    d.enemies.push(structuredClone(d.enemies[0]));
    expect(errorMessage(d)).toContain("duplicate enemy id \"grunt\"");
  });

  it("rejects damageMax below damageMin", () => {
    const d = fixture();
    d.enemies[0].attack.damageMax = 13;
    expect(errorMessage(d)).toContain("enemies.0 (grunt).attack.damageMax");
  });

  it("renders root issues as (root)", () => {
    expect(errorMessage(42)).toMatch(/^\(root\): /);
  });
});
