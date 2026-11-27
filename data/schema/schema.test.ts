import { describe, expect, it } from "vitest";
import { GameDataError, stormOf, validateGameData } from "./index";

const SLOT_TYPES = [
  "head", "neck", "shoulders", "back", "chest", "wrist", "hands", "waist", "legs", "feet", "ring", "trinket", "mainHand", "offHand",
];

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
      { ...base, id: "zap", name: names("Zap"), description: names("d"), kind: "chain", targeting: "nearest",
        params: { damage: [10, 20, 30], range: [500, 500, 500], bounces: [2, 3, 4], bounceRange: [300, 300, 300] } },
      { levels: 3, cooldown: [0, 0, 0], id: "boon", name: names("Boon"), description: names("d"), kind: "passive",
        targeting: "self", params: { attackBonus: [0.1, 0.2, 0.3] } },
    ],
    enemies: [
      {
        id: "grunt", name: names("Grunt"), level: 1, hp: 400, hpRegen: 0.25, armor: 3, moveSpeed: 270,
        collision: 31, acquireRange: 500,
        attack: { kind: "melee", range: 90, cooldown: 1.35, damageMin: 14, damageMax: 15 }, behavior: "siege", xp: 1,
      },
      {
        id: "warlord", name: names("Warlord"), level: 5, hp: 9000, hpRegen: 0, armor: 3, moveSpeed: 200,
        collision: 80, acquireRange: 500,
        attack: { kind: "melee", range: 90, cooldown: 1.35, damageMin: 14, damageMax: 15 }, behavior: "siege", xp: 1,
        boss: true, model: "grunt", slam: { radius: 350, damage: 120, windupSeconds: 1, cooldownSeconds: [7, 15] },
      },
    ],
    rules: {
      start: { hero: "hero-one" },
      run: {
        durationSeconds: 180, phaseSeconds: 50, firstPackSeconds: 2, timeScaling: { seconds: 1200, cap: 2 },
        rushWarningSeconds: 7,
        finale: { boss: "warlord", packScale: 0.5, enrageAfterSeconds: 200, enrage: { damage: 2, moveSpeed: 1.3, slamCooldown: 0.5 } },
      },
      arena: {
        width: 6000, height: 5000, castle: { x: 0, y: -2000 }, heroStart: { x: 0, y: -1500 },
        spawn: { radius: 2000, spread: 150 },
      },
      castle: { hp: 3000, radius: 180, regenPercentPerMinute: 2 },
      hero: { collision: 32, baseRegen: 0.25, regenPerStr: 0.05, spellPowerPerInt: 0.01, cooldownSpeedPerInt: 0.01,
        dash: { distance: 350, seconds: 0.15, cooldownSeconds: 4, charges: { fromLevel: 20, count: 3 } },
        blink: { fromLevel: 40, cooldownSeconds: 10, aheadDistance: 900, radius: 300, damage: 300, stunSeconds: 0.5 } },
      autocast: { novaMinEnemies: 1, healBelow: 0.6, shieldBelow: 0.35 },
      enemies: { maxAlive: 150, siegerAggroRange: 250, leashRange: 900, heroDefendRange: 1000, levelScaling: { hp: 0.009, damage: 0.009 }, knockback: { attack: 40, ability: 90, seconds: 0.15 }, bossStunScale: 0.25 },
      events: [
        { atSeconds: 60, kind: "rush", elites: 1, heavies: 2 },
        { atSeconds: 100, kind: "boss", enemy: "warlord" },
      ],
      factions: [{ id: "human", name: names("Legion"), fromPhase: 1, elite: "grunt", heavy: "grunt" }],
      debug: { phaseXp: [0, 10, 20, 30] },
      phases: [
        { mix: { grunt: 1 }, pack: { min: 6, max: 10, everySeconds: 6 }, packs: 1, hunterShare: 0.2, elites: 0 },
        { mix: { grunt: 1 }, pack: { min: 6, max: 10, everySeconds: 6 }, packs: 1, hunterShare: 0.25, elites: 0 },
        { mix: { grunt: 1 }, pack: { min: 6, max: 10, everySeconds: 6 }, packs: 1, hunterShare: 0.3, elites: 0 },
        { mix: { grunt: 1 }, pack: { min: 6, max: 10, everySeconds: 6 }, packs: 1, hunterShare: 0.35, elites: 0 },
      ],
      threat: { heroDamageTaken: 2 },
      sustain: {
        buffSeconds: 15, lifesteal: { capPerSecond: 0.02 }, hearts: { chance: 0.04, healShare: 0.08 },
        orbs: { maxOnMap: 3, firstSeconds: [8, 20, 32], respawnSeconds: { min: 30, max: 45 }, minCastleDistance: 300,
          maxCastleDistance: 2000, minSpacing: 500, chestSpacing: 200, pickupRadius: 70 },
        boots: { moveSpeed: 2 }, berserk: { damage: 1.5 }, heal: { share: 1 },
      },
      magicFind: { limit: 1.5, rarityFactor: { rare: 1, epic: 1.5, legendary: 2, mythic: 2.5 } },
      gear: { levelStep: 0.15, chestLevelStep: 0.3, maxPermanentLevel: 5 },
      chests: { count: 3, basePrice: 40, priceGrowth: 1.18, minCastleDistance: 700, maxCastleDistance: 2000,
        minSpacing: 600, pickupRadius: 80, slotsPerOffer: 3, rarityWeights: { common: 55, rare: 30, epic: 12 } },
      drops: [{ boss: "warlord", weights: { common: 60, rare: 40 } }],
      progression: {
        xpFirst: 4, xpStep: 2, magnetRadius: 300, crystalSpeed: 900, pickupRadius: 56,
        attributeCardAmount: 10, cardsPerOffer: 3, ultimateFromLevel: 6, ultimateLevelStep: 6,
        sharedSpells: ["zap"], passives: ["boon"], sharedSpellSlots: 2, passiveSlots: 4,
        cardWeights: { signature: 4, sharedUpgrade: 3, newSpell: 2, newPassive: 2 },
      },
      difficulty: {
        worldStep: { hp: 0.25, damage: 0.25 },
        reward: { goldPerWorld: 0.1, magicFindPerWorld: 0.1 },
        levels: {
          normal: { hp: 1, damage: 1, packSize: 1, eliteHp: 1, magicFind: 0, extraRushes: [] },
          insane: { hp: 1.75, damage: 1.75, packSize: 1.2, eliteHp: 1, magicFind: 0.25,
            extraRushes: [{ atSeconds: 90, elites: 1, heavies: 2 }] },
          hell: { hp: 3, damage: 3, packSize: 1.4, eliteHp: 1.5, magicFind: 0.5,
            extraRushes: [{ atSeconds: 90, elites: 1, heavies: 2 }] },
        },
      },
      coop: {
        perPlayer: { hp: 0.6, damage: 0.15, packSize: 0.5, eliteHp: 0.4, castleHp: 0, chests: 1 },
        revive: { seconds: 5, radius: 120, hpShare: 0.5 },
      },
      loot: {
        smartShare: 0.6, collectionLimit: 200, implicitPoints: 2,
        budget: { common: 6, rare: 12, epic: 20, legendary: 30, mythic: 42 }, rowRoll: 0.08,
        affixCount: { common: 1, rare: 2, epic: 3, legendary: 4, mythic: 4 },
        namedShare: { common: 0, rare: 0, epic: 0.1, legendary: 0.25, mythic: 0.4 },
        upgradeShare: 0.5,
        salvageGold: { common: 10, rare: 25, epic: 50, legendary: 90, mythic: 150 },
        bankLimit: 500,
        tiers: [{ weight: 1, minPower: 0 }, { weight: 1.35, minPower: 3 }, { weight: 1.7, minPower: 6 }, { weight: 2, minPower: 9 }],
        power: { boss: [2], chestBase: 1, chestPerPhase: 0.3, perWorld: 0.5, difficulty: { normal: 0, insane: 1, hell: 2 } },
        levelAtPower: [0, 3, 6, 9, 12], critDamage: 0.5,
        caps: { critChance: 0.6, dodge: 0.4, damageTaken: 0.5 },
        mythicEffects: [{ kind: "slow_aura", params: { radius: 350, slow: 0.25 }, text: names("Slow") }],
      },
    },
    loot: {
      bases: SLOT_TYPES.flatMap((slotType) => (["str", "agi", "int"] as const).map((flavour) => ({
        id: `${flavour}-${slotType.toLowerCase()}`, name: names(slotType), gender: "f", slotType, flavour,
        implicit: { stat: "hp", value: 24 },
      }))),
      affixes: ["str", "agi", "int", "hp"].map((stat) => ({
        stat, tags: [stat === "hp" ? "str" : stat], unit: stat === "hp" ? 12 : 0.5,
        prefix: { en: "Big", cs: { m: "Velký", f: "Velká", n: "Velké", p: "Velké" } }, suffix: names("of it"),
      })),
      names: {
        first: [{ en: "Grim", cs: { m: "Ponurý", f: "Ponurá", n: "Ponuré", p: "Ponuré" } }],
        nouns: Object.fromEntries(SLOT_TYPES.map((t) => [t, [{ name: names(t), gender: "m" }]])),
      },
    },
    worlds: [
      { id: "first-world", name: names("First"), blurb: names("A plain."), color: "#1f3a44", ready: true,
        map: worldMap(), hazard: storm() },
      { id: "second-world", name: names("Second"), blurb: names("A waste."), color: "#3a2428", ready: false,
        map: worldMap(), hazard: storm() },
    ],
    items: SLOT_TYPES.map((slotType) => ({
      id: `plain-${slotType.toLowerCase()}`, name: names(slotType), slotType, rarity: "common",
      stats: [{ stat: "str", value: 6 }],
    })),
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
    expect(data.abilities).toHaveLength(6);
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
    expect(msg).toContain("abilities.6 (wave).params");
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

  it("rejects levels 0 and 11", () => {
    for (const levels of [0, 11]) {
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
    d.rules.phases[2].mix.ghost = 2;
    expect(errorMessage(d)).toContain('rules.phases.2.mix: unknown enemy "ghost"');
  });

  it("rejects an unknown or boss faction elite and heavy type", () => {
    const d = fixture();
    d.rules.factions[0].elite = "ghost";
    d.rules.factions[0].heavy = "warlord";
    expect(errorMessage(d)).toContain('rules.factions.0.elite: unknown enemy "ghost"');
    expect(errorMessage(d)).toContain('rules.factions.0.heavy: "warlord" is a boss');
  });

  it("factions start at phase 1 and ascend", () => {
    let d = fixture();
    d.rules.factions[0].fromPhase = 2;
    expect(errorMessage(d)).toContain("rules.factions.0.fromPhase: the first faction must start at phase 1");
    d = fixture();
    d.rules.factions.push({ ...d.rules.factions[0], id: "orc" });
    expect(errorMessage(d)).toContain("rules.factions.1.fromPhase: not above the faction before it");
    d = fixture();
    d.rules.factions[0].id = "dwarf";
    expect(errorMessage(d)).toContain("rules.factions.0.id");
  });

  it("a raise must name a known enemy", () => {
    const d = fixture();
    d.enemies[0].raise = { type: "nobody", cooldownSeconds: 5, count: 2, range: 500, maxAgeSeconds: 10 };
    expect(errorMessage(d)).toContain('enemies.0 (grunt).raise.type: unknown enemy "nobody"');
    d.enemies[0].raise.type = "grunt";
    expect(() => validateGameData(d)).not.toThrow();
  });

  it("an enemy with xp 0 is valid, a faction must be known", () => {
    const d = fixture();
    d.enemies[0].xp = 0;
    expect(() => validateGameData(d)).not.toThrow();
    d.enemies[0].faction = "dwarf";
    expect(errorMessage(d)).toContain("enemies.0 (grunt).faction");
  });

  it("rejects a pack whose min is above its max", () => {
    const d = fixture();
    d.rules.phases[1].pack = { min: 9, max: 8, everySeconds: 6 };
    expect(errorMessage(d)).toContain("rules.phases.1.pack");
  });

  it("rejects an empty mix", () => {
    const d = fixture();
    d.rules.phases[0].mix = {};
    expect(errorMessage(d)).toContain("rules.phases.0.mix");
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

  it("accepts charge and aura of an enemy, and rejects a charge whose minRange is not below maxRange", () => {
    const charge = { minRange: 300, maxRange: 700, windupSeconds: 0.5, speedMultiplier: 2.5, damageMultiplier: 2, distance: 900, cooldownSeconds: 6 };
    const d = fixture();
    d.enemies[0].charge = charge;
    d.enemies[0].aura = { radius: 400, moveSpeed: 0.25, damage: 0 };
    expect(validateGameData(d).enemies[0]!.charge).toEqual(charge);
    d.enemies[0].charge = { ...charge, minRange: 700 };
    expect(errorMessage(d)).toContain("charge");
    d.enemies[0].charge = { ...charge, distance: 0 };
    expect(errorMessage(d)).toContain("charge.distance");
  });

  it("rejects packs outside 1..6", () => {
    for (const packs of [0, 7, 1.5]) {
      const d = fixture();
      d.rules.phases[1].packs = packs;
      expect(errorMessage(d)).toContain("rules.phases.1.packs");
    }
  });

  it("rejects a spawn ring that does not fit the arena", () => {
    const d = fixture();
    d.rules.arena.spawn = { radius: 2400, spread: 150 };
    expect(errorMessage(d)).toContain("arena.spawn: the ring does not fit the arena");
  });

  it("rejects the old arena.gates key", () => {
    const d = fixture();
    d.rules.arena.gates = [{ x: 0, y: 0 }];
    expect(errorMessage(d)).toContain("gates");
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

  it("rules accept events and a finale", () => {
    const rules = validateGameData(fixture()).rules;
    expect(rules.events).toHaveLength(2);
    expect(rules.run.finale.boss).toBe("warlord");
    expect(rules.enemies.bossStunScale).toBe(0.25);
  });

  it("events must ascend by atSeconds", () => {
    const d = fixture();
    d.rules.events = [
      { atSeconds: 250, kind: "boss", enemy: "warlord" },
      { atSeconds: 180, kind: "rush", elites: 1, heavies: 2 },
    ];
    expect(errorMessage(d)).toContain("rules.events.1.atSeconds: below the event before it");
  });

  it("a rush needs at least one unit", () => {
    const d = fixture();
    d.rules.events[0].elites = 0;
    d.rules.events[0].heavies = 0;
    expect(errorMessage(d)).toContain("rules.events.0: needs at least one unit");
    d.rules.events[0].heavies = -1;
    expect(errorMessage(d)).toContain("rules.events.0.heavies");
  });

  it("slam cooldown min must not exceed max", () => {
    const d = fixture();
    d.enemies[1].slam.cooldownSeconds = [15, 7];
    expect(errorMessage(d)).toContain("enemies.1 (warlord).slam.cooldownSeconds");
  });

  it("debug.phaseXp has one value per phase", () => {
    const d = fixture();
    d.rules.debug.phaseXp = [0, 10, 20];
    expect(errorMessage(d)).toContain("rules.debug.phaseXp: 3 values for 4 phases");
    d.rules.debug.phaseXp = [0, 30, 20, 40];
    expect(errorMessage(d)).toContain("rules.debug.phaseXp.2: below the value before it");
  });

  it("event and finale enemies must exist and be bosses", () => {
    let d = fixture();
    d.rules.events[1].enemy = "grunt";
    expect(errorMessage(d)).toContain('rules.events.1.enemy: "grunt" is not a boss');
    d = fixture();
    d.rules.run.finale.boss = "nobody";
    expect(errorMessage(d)).toContain('rules.run.finale.boss: unknown enemy "nobody"');
  });

  it("a model must name another enemy that has no model of its own", () => {
    let d = fixture();
    d.enemies[1].model = "nobody";
    expect(errorMessage(d)).toContain('enemies.1 (warlord).model: unknown enemy "nobody"');
    d = fixture();
    d.enemies[1].model = "warlord";
    expect(errorMessage(d)).toContain("enemies.1 (warlord).model");
    d = fixture();
    d.enemies[0].model = "warlord";
    expect(errorMessage(d)).toContain("model");
  });

  it("renders root issues as (root)", () => {
    expect(errorMessage(42)).toMatch(/^\(root\): /);
  });
});

describe("shared spell and passive pools", () => {
  it("accepts a passive and a chain with bounceRange and the strongest targeting", () => {
    const data = fixture();
    data.abilities[4].targeting = "strongest";
    expect(() => validateGameData(data)).not.toThrow();
  });

  it("rejects a passive with a cooldown", () => {
    const data = fixture();
    data.abilities[5].cooldown = [0, 1, 0];
    expect(errorMessage(data)).toContain("a passive has no cooldown");
  });

  it("rejects a passive without a known bonus key", () => {
    const data = fixture();
    data.abilities[5].params = { damage: [1, 2, 3] };
    expect(errorMessage(data)).toContain("abilities.5 (boon).params");
  });

  it("rejects a chain without bounceRange or with too many bounces", () => {
    const data = fixture();
    delete data.abilities[4].params.bounceRange;
    expect(errorMessage(data)).toContain("abilities.4 (zap).params.bounceRange");
    const many = fixture();
    many.abilities[4].params.bounces = [2, 3, 9];
    expect(errorMessage(many)).toContain("bounces must be integers");
  });

  it("rejects a shared spell that is unknown, a passive or in a hero's kit", () => {
    const unknown = fixture();
    unknown.rules.progression.sharedSpells = ["nope"];
    expect(errorMessage(unknown)).toContain('rules.progression.sharedSpells.0: unknown ability "nope"');
    const passive = fixture();
    passive.rules.progression.sharedSpells = ["boon"];
    expect(errorMessage(passive)).toContain('"boon" is a passive');
    const kit = fixture();
    kit.rules.progression.sharedSpells = ["pulse"];
    expect(errorMessage(kit)).toContain("\"pulse\" is in a hero's kit");
  });

  it("rejects a duplicate in a pool", () => {
    const data = fixture();
    data.rules.progression.sharedSpells = ["zap", "zap"];
    expect(errorMessage(data)).toContain('sharedSpells.1: duplicate "zap"');
  });

  it("rejects a passive pool entry that is not a passive or unknown", () => {
    const spell = fixture();
    spell.rules.progression.passives = ["zap"];
    expect(errorMessage(spell)).toContain('"zap" is not a passive');
    const unknown = fixture();
    unknown.rules.progression.passives = ["nope"];
    expect(errorMessage(unknown)).toContain('passives.0: unknown ability "nope"');
  });

  it("rejects a passive in a hero's kit", () => {
    const data = fixture();
    data.heroes[0].signatureAbilities = ["pulse", "boon", "rend"];
    expect(errorMessage(data)).toContain('"boon" is a passive and cannot be in a hero\'s kit');
  });

  it("requires the pool fields and card weights", () => {
    for (const key of ["sharedSpells", "passives", "sharedSpellSlots", "passiveSlots", "cardWeights"]) {
      const data = fixture();
      delete data.rules.progression[key];
      expect(errorMessage(data)).toContain(`rules.progression.${key}`);
    }
    const data = fixture();
    data.rules.progression.cardWeights.newSpell = 0;
    expect(errorMessage(data)).toContain("rules.progression.cardWeights.newSpell");
  });
});

describe("item and gear schemas", () => {
  it("rejects an item whose stat rows do not match its rarity", () => {
    const rows = { common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
    for (const [rarity, count] of Object.entries(rows)) {
      const stats = Array.from({ length: count }, () => ({ stat: "str", value: 3 }));
      const good = fixture();
      good.items.push({ id: "extra", name: { en: "Extra", cs: "Navíc" }, slotType: "head", rarity, stats });
      if (rarity !== "common") expect(() => validateGameData(good)).not.toThrow();
      const bad = fixture();
      bad.items.push({ id: "extra", name: { en: "Extra", cs: "Navíc" }, slotType: "head", rarity, stats: [...stats, { stat: "agi", value: 1 }] });
      expect(errorMessage(bad)).toContain("items.14 (extra)");
    }
  });

  it("rejects duplicate item ids", () => {
    const data = fixture();
    data.items.push({ ...data.items[0], rarity: "rare", stats: [{ stat: "str", value: 6 }, { stat: "hp", value: 72 }] });
    expect(errorMessage(data)).toContain('duplicate item id "plain-head"');
  });

  it("rejects a drop table of an unknown boss or of a common enemy", () => {
    const data = fixture();
    data.rules.drops.push({ boss: "nobody", weights: { rare: 1 } });
    expect(errorMessage(data)).toContain('rules.drops.1.boss: unknown enemy "nobody"');
    const other = fixture();
    other.rules.drops[0].boss = "grunt";
    expect(errorMessage(other)).toContain('"grunt" is not a boss');
  });

  it("needs exactly one common item for every slot type", () => {
    const missing = fixture();
    missing.items.pop();
    expect(errorMessage(missing)).toContain("items: 0 common items of type offHand, expected 1");
    const twice = fixture();
    twice.items.push({ ...twice.items[0], id: "second-head" });
    expect(errorMessage(twice)).toContain("items: 2 common items of type head, expected 1");
  });

  it("enemy gold defaults to 0 and must not be negative", () => {
    const data = fixture();
    expect(validateGameData(data).enemies[0]!.gold).toBe(0);
    data.enemies[0].gold = -1;
    expect(errorMessage(data)).toContain("enemies.0 (grunt).gold");
  });
});

describe("sustain rules", () => {
  it("accepts the sustain block and an item with lifesteal", () => {
    const data = fixture();
    data.items.push({ id: "leech-ring", name: { en: "Leech", cs: "Pijavice" }, slotType: "ring", rarity: "rare",
      stats: [{ stat: "str", value: 6 }, { stat: "lifesteal", value: 0.015 }] });
    expect(validateGameData(data).rules.sustain.orbs.maxOnMap).toBe(3);
  });

  it("needs one first time per orb place", () => {
    const data = fixture();
    data.rules.sustain.orbs.firstSeconds = [8, 20];
    expect(errorMessage(data)).toContain("firstSeconds");
  });

  it("rejects a respawn min above its max", () => {
    const data = fixture();
    data.rules.sustain.orbs.respawnSeconds = { min: 50, max: 45 };
    expect(errorMessage(data)).toContain("respawnSeconds");
  });

  it("rejects minCastleDistance not below maxCastleDistance", () => {
    const data = fixture();
    data.rules.sustain.orbs.minCastleDistance = 2000;
    expect(errorMessage(data)).toContain("minCastleDistance");
  });

  it("rejects a heart chance of 0 or above 1", () => {
    for (const chance of [0, 1.2]) {
      const data = fixture();
      data.rules.sustain.hearts.chance = chance;
      expect(errorMessage(data)).toContain("sustain.hearts.chance");
    }
  });
});

describe("difficulty and worlds", () => {
  it("accepts a valid difficulty table and worlds", () => {
    const data = validateGameData(fixture());
    expect(data.rules.difficulty.levels.hell.eliteHp).toBe(1.5);
    expect(data.worlds.map((w) => w.id)).toEqual(["first-world", "second-world"]);
  });

  it("needs all three levels", () => {
    const data = fixture();
    delete data.rules.difficulty.levels.hell;
    expect(errorMessage(data)).toContain("difficulty.levels.hell");
  });

  it("rejects a pack size of 0", () => {
    const data = fixture();
    data.rules.difficulty.levels.insane.packSize = 0;
    expect(errorMessage(data)).toContain("difficulty.levels.insane.packSize");
  });

  it("rejects an extra rush with negative elites", () => {
    const data = fixture();
    data.rules.difficulty.levels.insane.extraRushes[0].elites = -1;
    expect(errorMessage(data)).toContain("extraRushes");
  });

  it("rejects a world colour that is not a dark hex", () => {
    for (const color of ["orange", "#12345", "#GGGGGG"]) {
      const data = fixture();
      data.worlds[0].color = color;
      expect(errorMessage(data)).toContain("worlds.0 (first-world).color");
    }
  });

  it("rejects a path with one point", () => {
    const data = fixture();
    data.worlds[0].map.paths.lines[0] = [[0, 0]];
    expect(errorMessage(data)).toContain("worlds.0 (first-world).map.paths.lines.0");
  });

  it("rejects an island count whose max is below its min", () => {
    const data = fixture();
    data.worlds[0].map.islands.count = { min: 5, max: 4 };
    expect(errorMessage(data)).toContain("map.islands.count");
  });

  it("rejects a clear ring whose outer edge is not beyond the inner", () => {
    const data = fixture();
    data.worlds[0].map.clear.ringOuter = data.worlds[0].map.clear.ringInner;
    expect(errorMessage(data)).toContain("map.clear.ringOuter");
  });

  it("rejects a storm with no bolts and an unknown hazard kind", () => {
    const none = fixture();
    none.worlds[0].hazard.bolts.min = 0;
    expect(errorMessage(none)).toContain("hazard");
    const odd = fixture();
    (odd.worlds[0].hazard as { kind: string }).kind = "flood";
    expect(errorMessage(odd)).toContain("hazard");
  });

  it("accepts the map and storm of a world", () => {
    const data = validateGameData(fixture());
    expect(data.worlds[0].map.feature.segments).toHaveLength(2);
    expect(data.worlds[0].hazard.kind).toBe("storm");
  });

  it("parses a weather hazard", () => {
    const ok = fixture();
    ok.worlds[0].hazard = weather();
    expect(validateGameData(ok).worlds[0].hazard.kind).toBe("weather");
    const strong = fixture();
    strong.worlds[0].hazard = { ...weather(), moveSlow: 1.2 };
    expect(errorMessage(strong)).toContain("hazard");
    const fog = fixture();
    fog.worlds[0].hazard = { ...weather(), effect: "fog" };
    expect(errorMessage(fog)).toContain("hazard");
  });

  it("parses a thicket hazard", () => {
    const ok = fixture();
    ok.worlds[0].hazard = thicket([[0, 900, 200]]);
    expect(validateGameData(ok).worlds[0].hazard.kind).toBe("thicket");
    const empty = fixture();
    empty.worlds[0].hazard = thicket([]);
    expect(errorMessage(empty)).toContain("hazard");
    const flat = fixture();
    flat.worlds[0].hazard = thicket([[0, 900, 0]]);
    expect(errorMessage(flat)).toContain("hazard");
  });

  it("parses a snow weather with chill", () => {
    const ok = fixture();
    ok.worlds[0].hazard = { ...weather(), effect: "snow", chill: { stillSeconds: 3, attackSlow: 0.2 } };
    expect(validateGameData(ok).worlds[0].hazard).toMatchObject({ effect: "snow", chill: { stillSeconds: 3 } });
    const strong = fixture();
    strong.worlds[0].hazard = { ...weather(), effect: "snow", chill: { stillSeconds: 3, attackSlow: 1.5 } };
    expect(errorMessage(strong)).toContain("hazard");
    const rain = fixture();
    rain.worlds[0].hazard = { ...weather(), effect: "rain" };
    expect(errorMessage(rain)).toContain("hazard");
  });

  it("parses a meteors hazard", () => {
    const ok = fixture();
    ok.worlds[0].hazard = meteors();
    expect(validateGameData(ok).worlds[0].hazard.kind).toBe("meteors");
    const noPool = fixture();
    const { pool: _pool, ...rest } = meteors();
    noPool.worlds[0].hazard = rest;
    expect(errorMessage(noPool)).toContain("hazard");
    const flat = fixture();
    flat.worlds[0].hazard = { ...meteors(), pool: { ...meteors().pool, radius: 0 } };
    expect(errorMessage(flat)).toContain("hazard");
  });

  it("stormOf narrows storms and meteors", () => {
    const data = fixture();
    data.worlds[0].hazard = storm();
    data.worlds[1].hazard = meteors();
    const v = validateGameData(data);
    expect(stormOf(v.worlds[0]!)?.kind).toBe("storm");
    expect(stormOf(v.worlds[1]!)?.kind).toBe("meteors");
    const w = fixture();
    w.worlds[0].hazard = weather();
    w.worlds[1].hazard = thicket([[0, 900, 200]]);
    const vw = validateGameData(w);
    expect(stormOf(vw.worlds[0]!)).toBeNull();
    expect(stormOf(vw.worlds[1]!)).toBeNull();
  });

  it("a world's strength is optional and positive", () => {
    const ok = fixture();
    ok.worlds[0].strength = 1.1;
    expect(validateGameData(ok).worlds[0]!.strength).toBe(1.1);
    expect(validateGameData(fixture()).worlds[0]!.strength).toBeUndefined();
    const zero = fixture();
    zero.worlds[0].strength = 0;
    expect(errorMessage(zero)).toContain("strength");
  });

  it("rejects an unknown hazard kind", () => {
    const odd = fixture();
    odd.worlds[0].hazard = { ...weather(), kind: "flood" };
    expect(errorMessage(odd)).toContain("hazard");
  });

  it("rejects duplicate world ids and an empty world list", () => {
    const dup = fixture();
    dup.worlds[1].id = "first-world";
    expect(errorMessage(dup)).toContain("duplicate world id");
    const none = fixture();
    none.worlds = [];
    expect(errorMessage(none)).toContain("worlds");
  });
});

function worldMap() {
  return {
    paths: { width: 160, speedBonus: 0.15, lines: [[[0, -200], [0, -2800]]] as [number, number][][] },
    feature: { thickness: 90, segments: [[-1400, 1500, -750, 1500], [500, 1500, 1400, 1500]] as [number, number, number, number][] },
    islands: { count: { min: 30, max: 40 }, radius: { min: 40, max: 220 }, gap: 120, kinds: { rock: 5, trees: 4, ruin: 2 } },
    clear: { castle: 600, ringInner: 2200, ringOuter: 2600, pathMargin: 60, featureMargin: 150 },
  };
}

function storm() {
  return {
    kind: "storm" as const, fromPhase: 3, everySeconds: { min: 35, max: 45 }, bolts: { min: 1, max: 3 }, spread: 300,
    warnSeconds: 1.2, radius: 120, heroShare: 0.08, enemyShare: 0.2, bossShare: 0.02, name: { en: "Storm", cs: "Bouře" },
  };
}

function weather() {
  return {
    kind: "weather" as const, effect: "sand", fromPhase: 2, everySeconds: { min: 100, max: 130 }, durationSeconds: 15,
    warnSeconds: 5, moveSlow: 0.2, name: { en: "Sandstorm", cs: "Písečná bouře" },
  };
}

function meteors() {
  return {
    ...storm(), kind: "meteors" as const, fromPhase: 1, bolts: { min: 3, max: 6 }, radius: 150,
    pool: { seconds: 6, radius: 130, heroSharePerSecond: 0.04, enemySharePerSecond: 0.06, bossSharePerSecond: 0.004 },
  };
}

function thicket(zones: number[][]) {
  return { kind: "thicket" as const, slow: 0.35, zones, name: { en: "Thornbrake", cs: "Trnité houští" } };
}

describe("random item data", () => {
  it("accepts the fixture's bases, affixes and names", () => {
    const data = validateGameData(fixture());
    expect(data.loot.bases).toHaveLength(42);
    expect(data.rules.loot.smartShare).toBe(0.6);
  });

  it("rejects a duplicate base, a slot type without an int base and an unpriced implicit", () => {
    const d = fixture();
    d.loot.bases[1].id = d.loot.bases[0].id;
    d.loot.bases = d.loot.bases.filter((b: { id: string }) => b.id !== "int-head");
    d.loot.bases[3].implicit = { stat: "armor", value: 0.5 };
    const message = errorMessage(d);
    expect(message).toContain('duplicate base id "str-head"');
    expect(message).toContain("no int base of type head");
    expect(message).toContain('no affix prices "armor"');
  });

  it("rejects a duplicate affix, too few affixes for a mythic and an unknown stat or gender", () => {
    const d = fixture();
    d.loot.affixes[1].stat = "str";
    d.loot.affixes.pop();
    expect(errorMessage(d)).toContain('duplicate affix "str"');
    expect(errorMessage(d)).toContain("3 affixes, an item rolls up to 4");
    const e = fixture();
    e.loot.affixes[0].stat = "luck";
    e.loot.bases[0].gender = "x";
    expect(errorMessage(e)).toContain("loot.affixes.0.stat");
    expect(errorMessage(e)).toContain("loot.bases.0.gender");
  });

  it("rejects a Czech adjective without a form, and a slot type without rare nouns", () => {
    const d = fixture();
    delete d.loot.affixes[0].prefix.cs.p;
    delete d.loot.names.nouns.offHand;
    const message = errorMessage(d);
    expect(message).toContain("loot.affixes.0.prefix.cs.p");
    expect(message).toContain("loot.names.nouns.offHand");
  });

  it("rejects falling tiers, levelAtPower of the wrong length and power.boss not matching the drops", () => {
    const d = fixture();
    d.rules.loot.tiers[2].weight = 1;
    expect(errorMessage(d)).toContain("tier weights and minPower must rise");
    const e = fixture();
    e.rules.loot.levelAtPower = [0, 3, 6];
    e.rules.loot.power.boss = [1, 2];
    expect(errorMessage(e)).toContain("rules.loot.levelAtPower: 3 values for 5 item levels");
    expect(errorMessage(e)).toContain("rules.loot.power.boss: 2 values for 1 boss drops");
  });
});
