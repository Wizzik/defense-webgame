import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { validateGameData } from "./schema";

const FILES = ["heroes.json", "abilities.json", "enemies.json", "rules.json", "items.json", "loot.json", "constants.json", "worlds.json"] as const;
/** Keys that carry map texts (tooltips) or design-only lookups (mapName). */
const FORBIDDEN_KEYS = new Set(["tooltip", "ubertip", "tip", "mapName", "source", "review", "jassFunctions"]);

function read(file: (typeof FILES)[number]): string {
  return readFileSync(join(import.meta.dirname, "generated", file), "utf8");
}

/** The entry lists of every design/*.yaml that is a list (rules.yaml is a mapping and has none). */
function designLists(): Record<string, unknown>[][] {
  const dir = join(import.meta.dirname, "..", "design");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => parse(readFileSync(join(dir, f), "utf8")) as unknown)
    .filter((v): v is Record<string, unknown>[] => Array.isArray(v));
}

type Entry = { id: string; name: unknown; description?: unknown; role?: unknown };

function designEntries(file: string): Entry[] {
  return parse(readFileSync(join(import.meta.dirname, "..", "design", file), "utf8")) as Entry[];
}

function forbiddenKeyPaths(value: unknown, path: string): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => forbiddenKeyPaths(v, `${path}.${i}`));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, v]) => [
    ...(FORBIDDEN_KEYS.has(key) ? [`${path}.${key}`] : []),
    ...forbiddenKeyPaths(v, `${path}.${key}`),
  ]);
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("generated game data", () => {
  it("passes validateGameData", () => {
    expect(() =>
      validateGameData({
        heroes: JSON.parse(read("heroes.json")),
        abilities: JSON.parse(read("abilities.json")),
        enemies: JSON.parse(read("enemies.json")),
        rules: JSON.parse(read("rules.json")),
        items: JSON.parse(read("items.json")),
        loot: JSON.parse(read("loot.json")),
        constants: JSON.parse(read("constants.json")),
        worlds: JSON.parse(read("worlds.json")),
      }),
    ).not.toThrow();
  });

  it("carries no map identifiers", () => {
    const forbidden = new Set<string>();
    for (const entries of designLists()) {
      for (const e of entries) {
        for (const key of ["source", "mapName"]) if (typeof e[key] === "string") forbidden.add(e[key]);
      }
    }
    expect(forbidden.size).toBeGreaterThan(0);
    for (const file of FILES) {
      for (const text of strings(JSON.parse(read(file)))) {
        expect(text, file).not.toMatch(/\b(Init)?Trig_|war3map/);
        expect(forbidden.has(text), `${file}: ${text}`).toBe(false);
      }
    }
  });

  it("matches design ids and names", () => {
    // data-build cannot run in CI, so this catches a design change that was not regenerated.
    const pairs = [
      ["heroes.json", "heroes.yaml"],
      ["abilities.json", "abilities.yaml"],
      ["enemies.json", "enemies.yaml"],
      ["items.json", "items.yaml"],
      ["worlds.json", "worlds.yaml"],
    ] as const;
    for (const [json, yaml] of pairs) {
      const pick = ({ id, name, description, role }: Entry) => ({ id, name, description, role });
      const generated = (JSON.parse(read(json)) as Entry[]).map(pick);
      const design = designEntries(yaml).map(pick);
      expect(generated, `${json} differs from design/${yaml}: run npm run data:build`).toEqual(design);
    }
  });

  it("matches design rules and enemy xp", () => {
    const rules = parse(readFileSync(join(import.meta.dirname, "..", "design", "rules.yaml"), "utf8"));
    expect(JSON.parse(read("rules.json")), "rules.json differs from design/rules.yaml: run npm run data:build").toEqual(rules);
    type Loot = { id: string; xp?: number; gold?: number };
    const loot = (list: Loot[]) => list.map(({ id, xp, gold }) => ({ id, xp, gold: gold ?? 0 }));
    expect(loot(JSON.parse(read("enemies.json")))).toEqual(loot(designEntries("enemies.yaml") as Loot[]));
    type Row = { id: string; slotType: string; rarity: string; stats: unknown };
    const rows = (list: Row[]) => list.map(({ id, slotType, rarity, stats }) => ({ id, slotType, rarity, stats }));
    expect(rows(JSON.parse(read("items.json")))).toEqual(rows(designEntries("items.yaml") as unknown as Row[]));
  });

  it("melee heroes take a quarter less and enemies hit the hero twice as hard", () => {
    const heroes = JSON.parse(read("heroes.json")) as { id: string; damageTaken?: number }[];
    for (const hero of heroes) {
      if (hero.id === "stonehorn" || hero.id === "redcleaver" || hero.id === "serpent-shaman") expect(hero.damageTaken, hero.id).toBe(0.75);
      else expect(hero, hero.id).not.toHaveProperty("damageTaken");
    }
    expect(JSON.parse(read("rules.json")).threat).toEqual({ heroDamageTaken: 2 });
  });

  it("enemies have the human types, four bosses and the faction types with their attack kinds", () => {
    const enemies = JSON.parse(read("enemies.json")) as { id: string; attack: { kind: string }; heal?: unknown; boss?: true; faction?: string }[];
    expect(enemies.map((e) => e.id)).toEqual([
      "shieldbearer", "scout", "musketeer", "chaplain", "lancer", "captain",
      "iron-marshal", "pale-abbot", "gunmaster", "dread-regent",
      "brute", "spearthrower", "hornback", "bloodcaller", "warlord",
      "ghoul", "webcrawler", "rotgut", "gravebinder", "risen", "bone-tyrant",
      "huntress", "moon-archer", "stone-warden", "grove-druid", "grove-warden",
    ]);
    expect(enemies.filter((e) => e.faction === undefined).map((e) => e.id)).toEqual(enemies.filter((e) => e.boss).map((e) => e.id));
    expect(enemies.filter((e) => e.boss).map((e) => e.id)).toEqual(["iron-marshal", "pale-abbot", "gunmaster", "dread-regent"]);
    const ranged = enemies.filter((e) => e.attack.kind === "ranged").map((e) => e.id);
    expect(ranged).toEqual([
      "musketeer", "chaplain", "pale-abbot", "gunmaster", "spearthrower", "bloodcaller", "webcrawler", "gravebinder",
      "huntress", "moon-archer",
    ]);
    expect(enemies.filter((e) => e.attack.kind !== "ranged").every((e) => e.attack.kind === "melee")).toBe(true);
    expect(enemies.filter((e) => e.heal !== undefined).map((e) => e.id)).toEqual(["chaplain", "pale-abbot", "grove-druid"]);
  });

  it("five worlds, all ready, and the difficulty table", () => {
    const worlds = JSON.parse(read("worlds.json")) as { id: string; ready: boolean }[];
    expect(worlds.map((w) => w.id)).toEqual(["silver-march", "red-waste", "shadewood", "frostreach", "blightscar"]);
    expect(worlds.map((w) => w.ready)).toEqual([true, true, true, true, true]);
    type Level = { hp: number; damage: number; packSize: number; eliteHp: number; magicFind: number; extraRushes: { atSeconds: number }[] };
    const rules = JSON.parse(read("rules.json")) as { run: { durationSeconds: number }; difficulty: { levels: Record<string, Level> } };
    expect(rules.difficulty.levels.normal).toEqual({ hp: 1, damage: 1, packSize: 2, eliteHp: 1, magicFind: 0, extraRushes: [] });
    for (const id of ["insane", "hell"]) {
      const times = rules.difficulty.levels[id]!.extraRushes.map((r) => r.atSeconds);
      expect(times.length, id).toBeGreaterThan(0);
      expect(times, id).toEqual([...times].sort((a, b) => a - b));
      for (const t of times) expect(t, id).toBeLessThan(rules.run.durationSeconds);
    }
  });

  it("there are 20 phases and the final boss comes at 1000 s", () => {
    const rules = JSON.parse(read("rules.json")) as { phases: unknown[]; run: { durationSeconds: number; phaseSeconds: number; finale: { boss: string } }; events: { atSeconds: number }[] };
    expect(rules.phases).toHaveLength(20);
    expect(rules.run.durationSeconds).toBe(1000);
    expect(rules.run.phaseSeconds).toBe(50);
    expect(rules.run.finale.boss).toBe("dread-regent");
    expect(rules.events.map((e) => e.atSeconds)).toEqual([180, 250, 360, 500, 540, 720, 750, 900]);
  });

  it("boss hp matches the design targets", () => {
    const enemies = JSON.parse(read("enemies.json")) as { id: string; hp: number; boss?: true }[];
    // Petr 2026-11-27 (batch 2): x3 of 12 000, 20 000, 30 000 and 257 000
    const targets: Record<string, number> = { "iron-marshal": 36000, "pale-abbot": 60000, gunmaster: 90000, "dread-regent": 771000 };
    for (const boss of enemies.filter((e) => e.boss)) {
      const target = targets[boss.id]!;
      expect(Math.abs(boss.hp - target) / target, boss.id).toBeLessThanOrEqual(0.01);
    }
  });

  it("bosses have collision 80, 80, 80, 96", () => {
    const enemies = JSON.parse(read("enemies.json")) as { collision: number; boss?: true }[];
    expect(enemies.filter((e) => e.boss).map((e) => e.collision)).toEqual([80, 80, 80, 96]);
  });

  it("there are eight heroes, each with three signature abilities and an ultimate that exist", () => {
    const heroes = JSON.parse(read("heroes.json")) as { id: string; signatureAbilities: string[]; ultimate: string }[];
    const abilities = new Set((JSON.parse(read("abilities.json")) as { id: string }[]).map((a) => a.id));
    expect(heroes.map((h) => h.id)).toEqual([
      "stonehorn", "nightglaive", "gravecaller", "serpent-shaman", "mistwarden", "sparkshot", "redcleaver", "tidecaller",
    ]);
    for (const hero of heroes) {
      expect(hero.signatureAbilities, hero.id).toHaveLength(3);
      for (const id of [...hero.signatureAbilities, hero.ultimate]) expect(abilities.has(id), `${hero.id}: ${id}`).toBe(true);
    }
  });

  it("the pools hold 10 shared spells and 6 passives with 2 and 4 slots", () => {
    const rules = JSON.parse(read("rules.json")) as {
      progression: { sharedSpells: string[]; passives: string[]; sharedSpellSlots: number; passiveSlots: number };
    };
    const abilities = new Map((JSON.parse(read("abilities.json")) as { id: string; kind: string; levels: number }[])
      .map((a) => [a.id, a]));
    const p = rules.progression;
    expect(p.sharedSpells).toHaveLength(10);
    expect(p.passives).toHaveLength(6);
    expect([p.sharedSpellSlots, p.passiveSlots]).toEqual([2, 4]);
    for (const id of p.sharedSpells) {
      expect(abilities.get(id)?.kind, id).not.toBe("passive");
      expect(abilities.get(id)?.levels, id).toBe(10); // design/scaling.yaml abilities.levels
    }
    for (const id of p.passives) {
      expect(abilities.get(id)?.kind, id).toBe("passive");
      expect(abilities.get(id)?.levels, id).toBe(10); // design/scaling.yaml abilities.levels
    }
    expect(new Set(p.sharedSpells.map((id) => abilities.get(id)?.kind))).toContain("chain");
    expect(new Set(p.sharedSpells.map((id) => abilities.get(id)?.kind))).toContain("instant");
  });

  it("the new on_hit abilities carry a bonus, and the chance is a share of 1", () => {
    const abilities = JSON.parse(read("abilities.json")) as { id: string; params: Record<string, number[]> }[];
    const of = (id: string) => abilities.find((a) => a.id === id)!.params;
    expect(of("stunning-tide").chance).toEqual(Array(10).fill(0.175));
    expect(of("stunning-tide").bonusDamage!.every((v) => v > 0)).toBe(true);
    expect(of("searing-rounds").bonusDamage!.every((v) => v > 0)).toBe(true);
    // the map's 1.25, 2.5, 3.75, 5, 7.5 spread over 10 levels
    expect(of("grave-grasp").healPerHit).toEqual([1.25, 1.8056, 2.3611, 2.9167, 3.4722, 4.0278, 4.5833, 5.2778, 6.3889, 7.5]);
  });

  it("every enemy type has its behavior", () => {
    const enemies = JSON.parse(read("enemies.json")) as { id: string; behavior: string }[];
    expect(Object.fromEntries(enemies.map((e) => [e.id, e.behavior]))).toEqual({
      shieldbearer: "siege", scout: "flank", musketeer: "skirmish", chaplain: "support", lancer: "charge", captain: "charge",
      "iron-marshal": "charge", "pale-abbot": "siege", gunmaster: "skirmish", "dread-regent": "charge",
      brute: "siege", spearthrower: "skirmish", hornback: "charge", bloodcaller: "support", warlord: "charge",
      ghoul: "flank", webcrawler: "skirmish", rotgut: "siege", gravebinder: "support", risen: "siege", "bone-tyrant": "siege",
      huntress: "flank", "moon-archer": "skirmish", "stone-warden": "siege", "grove-druid": "support", "grove-warden": "charge",
    });
  });

  it("the lancer charges and the captain has an aura", () => {
    const enemies = JSON.parse(read("enemies.json")) as { id: string; charge?: unknown; aura?: unknown; hunter?: true; boss?: true; strike?: { leap: boolean } }[];
    expect(enemies.filter((e) => e.charge !== undefined).map((e) => e.id)).toEqual([
      "lancer", "captain", "iron-marshal", "dread-regent", "hornback", "warlord", "grove-warden",
    ]);
    expect(enemies.filter((e) => e.hunter).map((e) => e.id)).toEqual(["captain", "warlord", "bone-tyrant", "grove-warden"]);
    expect(enemies.filter((e) => e.strike !== undefined).map((e) => e.id)).toEqual([
      ...enemies.filter((e) => e.boss).map((e) => e.id), "grove-druid", "grove-warden",
    ]);
    expect(enemies.filter((e) => e.strike?.leap === false).map((e) => e.id)).toEqual(["gunmaster", "grove-druid", "grove-warden"]);
    expect(enemies.filter((e) => (e.strike as { effect?: string } | undefined)?.effect === "root").map((e) => e.id))
      .toEqual(["grove-druid", "grove-warden"]);
    expect(enemies.filter((e) => e.aura !== undefined).map((e) => e.id)).toEqual(["captain", "dread-regent", "warlord"]);
  });

  it("carries the phase 2a mechanics", () => {
    const abilities = JSON.parse(read("abilities.json")) as { id: string; kind: string; params: Record<string, number[]> }[];
    const heroes = JSON.parse(read("heroes.json")) as { id: string; signatureAbilities: string[] }[];
    const ability = (id: string) => abilities.find((a) => a.id === id)!;
    expect(ability("enhanced-totem").params.empower).toEqual([3, 4, 5, 6, 7, 7, 8, 9, 10, 10]);
    expect(ability("seismic-echo").kind).toBe("on_cast");
    expect(heroes.find((h) => h.id === "nightglaive")!.signatureAbilities[0]).toBe("falling-stars");
    expect(ability("serpent-totem").params.maxAlive).toBeDefined();
    // Petr 2026-11-27: a totem bites for 100 at level 1 and 25 % of that more every level
    expect(ability("serpent-totem").params.damage).toEqual([100, 125, 150, 175, 200, 225, 250, 275, 300, 325]);
  });

  it("carries no map texts", () => {
    for (const file of FILES) {
      const text = read(file);
      expect(text, file).not.toContain("TRIGSTR");
      expect(forbiddenKeyPaths(JSON.parse(text), file)).toEqual([]);
    }
  });

  describe("item catalogue", () => {
    type Row = { stat: string; value: number };
    type CatalogueItem = { id: string; slotType: string; rarity: string; stats: Row[]; effect?: { kind: string } };
    const items = JSON.parse(read("items.json")) as CatalogueItem[];
    const rules = JSON.parse(read("rules.json")) as { drops: { boss: string; weights: Record<string, number> }[] };
    /** What one point buys: 0.5 attribute, 0.5 % of an offensive share, 12 hp, 0.25 armor, 0.1 regen, 1 % move speed or gold, 10 magnet. */
    const UNIT: Record<string, number> = {
      str: 0.5, agi: 0.5, int: 0.5, hp: 12, armor: 0.25, regen: 0.1,
      damage: 0.005, attackSpeed: 0.005, spellPower: 0.005, moveSpeed: 0.01, goldFind: 0.01, magnet: 10, magicFind: 0.02,
      lifesteal: 0.0025,
    };
    const BUDGET: Record<string, number> = { common: 6, rare: 12, epic: 20, legendary: 30, mythic: 42 };
    const of = (rarity: string) => items.filter((item) => item.rarity === rarity);

    it("has 14 common, 24 rare, 24 epic, 5 legendary and 3 mythic items", () => {
      expect(["common", "rare", "epic", "legendary", "mythic"].map((r) => of(r).length)).toEqual([14, 24, 24, 5, 3]);
    });

    it("every slot type has a rare and an epic item", () => {
      for (const rarity of ["rare", "epic"]) {
        expect(new Set(of(rarity).map((item) => item.slotType)).size, rarity).toBe(14);
      }
    });

    it("legendary and mythic items carry an effect, the lower rarities none", () => {
      for (const item of items) {
        const special = item.rarity === "legendary" || item.rarity === "mythic";
        expect(item.effect !== undefined, item.id).toBe(special);
      }
      expect(of("legendary").map((item) => item.effect!.kind).sort()).toEqual(
        ["chain_on_attack", "haste_on_elite_kill", "low_hp_shield", "slow_aura", "splash_on_attack"],
      );
      expect(of("mythic").map((item) => item.effect!.kind).sort()).toEqual(["chain_on_attack", "gold_heals_castle", "low_hp_shield"]);
      for (const item of [...of("legendary"), ...of("mythic")]) {
        expect(["mainHand", "offHand", "trinket"], item.id).toContain(item.slotType);
      }
    });

    it("the stats of every item are within 10 % of the budget of its rarity", () => {
      for (const item of items) {
        const points = item.stats.reduce((sum, row) => sum + row.value / UNIT[row.stat]!, 0);
        const budget = BUDGET[item.rarity]!;
        expect(points, `${item.id}: ${points} points`).toBeGreaterThanOrEqual(budget * 0.9 - 1e-9);
        expect(points, `${item.id}: ${points} points`).toBeLessThanOrEqual(budget * 1.1 + 1e-9);
      }
    });

    it("ten items carry magic find", () => {
      const mf = items.filter((item) => item.stats.some((row) => row.stat === "magicFind")).map((item) => item.id).sort();
      expect(mf).toEqual([
        "band-of-resolve", "belt-of-many-knives", "compass-of-the-lost-scout", "falcon-charm", "hourglass-of-the-hunt",
        "hunters-whistle", "pendant-of-the-deep-well", "ring-of-the-keen-eye", "seal-of-the-archivist", "tin-ring",
      ]);
    });

    it("ten items carry lifesteal, each between 1 and 3 %", () => {
      const ls = items.filter((item) => item.stats.some((row) => row.stat === "lifesteal"));
      expect(ls.length).toBe(10);
      for (const item of ls) {
        const value = item.stats.find((row) => row.stat === "lifesteal")!.value;
        expect(value, item.id).toBeGreaterThanOrEqual(0.01);
        expect(value, item.id).toBeLessThanOrEqual(0.03);
        expect(item.rarity, item.id).not.toBe("common");
      }
      const types = ls.map((item) => item.slotType);
      for (const [type, min] of [["mainHand", 2], ["hands", 2], ["offHand", 1], ["ring", 2], ["trinket", 2]] as const) {
        expect(types.filter((t) => t === type).length, type).toBeGreaterThanOrEqual(min);
      }
      expect(ls.filter((item) => item.rarity === "rare").length).toBeGreaterThanOrEqual(3);
    });

    it("the best epic-or-better magic find build gives about 100 % at level 5", () => {
      const build = [
        "pendant-of-the-deep-well", "ring-of-the-keen-eye", "seal-of-the-archivist", "belt-of-many-knives",
        "compass-of-the-lost-scout", "hourglass-of-the-hunt",
      ];
      const sum = build.reduce((total, id) => {
        const row = items.find((item) => item.id === id)!.stats.find((r) => r.stat === "magicFind")!;
        return total + row.value;
      }, 0);
      const atFive = sum * (1 + 0.15 * 4);
      expect(atFive).toBeGreaterThan(0.95);
      expect(atFive).toBeLessThan(1.15);
    });

    it("an item names a stat once", () => {
      for (const item of items) expect(new Set(item.stats.map((row) => row.stat)).size, item.id).toBe(item.stats.length);
    });

    it("the main attributes are spread evenly over the rare and the epic items", () => {
      for (const rarity of ["rare", "epic"]) {
        const lean = (attr: string) => of(rarity).filter((item) => item.stats.some((row) => row.stat === attr)).length;
        expect([lean("str"), lean("agi"), lean("int")], rarity).toEqual([8, 8, 8]);
      }
    });

    it("every rarity a boss drops has an item", () => {
      for (const drop of rules.drops) {
        for (const rarity of Object.keys(drop.weights)) expect(of(rarity).length, `${drop.boss}: ${rarity}`).toBeGreaterThan(0);
      }
    });
  });
});

describe("random items", () => {
  type Gendered = { en: string; cs: { m: string; f: string; n: string; p: string } };
  type Base = { id: string; name: { en: string; cs: string }; gender: string; slotType: string; flavour: string; implicit: { stat: string; value: number } };
  type Affix = { stat: string; tags: string[]; unit: number; maxTier?: number; prefix: Gendered; suffix: { en: string; cs: string } };
  type Loot = { bases: Base[]; affixes: Affix[]; names: { first: Gendered[]; nouns: Record<string, { name: { en: string; cs: string }; gender: string }[]> } };
  type Tier = { weight: number; minPower: number };
  type LootRules = {
    implicitPoints: number; rowRoll: number; smartShare: number; collectionLimit: number;
    affixCount: Record<string, number>; namedShare: Record<string, number>; tiers: Tier[];
    power: { boss: number[]; chestBase: number; chestPerPhase: number; perWorld: number; difficulty: Record<string, number> };
    levelAtPower: number[]; mythicEffects: { kind: string }[];
  };
  const loot = JSON.parse(read("loot.json")) as Loot;
  const rules = (JSON.parse(read("rules.json")) as { loot: LootRules }).loot;
  const SLOTS = ["head", "neck", "shoulders", "back", "chest", "wrist", "hands", "waist", "legs", "feet", "ring", "trinket", "mainHand", "offHand"];
  const BUDGET: Record<string, number> = { common: 6, rare: 12, epic: 20, legendary: 30, mythic: 42 };
  it("rules.loot.budget is the budget of the items header", () => {
    expect((JSON.parse(read("rules.json")) as { loot: { budget: unknown } }).loot.budget).toEqual(BUDGET);
  });
  const unitOf = (stat: string) => loot.affixes.find((a) => a.stat === stat)!.unit;
  const designFile = (file: string) => parse(readFileSync(join(import.meta.dirname, "..", "design", file), "utf8"));

  it("loot.json is the copy of the three design files", () => {
    expect(loot, "loot.json differs from design: run npm run data:build").toEqual({
      bases: designFile("item-bases.yaml"), affixes: designFile("affixes.yaml"), names: designFile("item-names.yaml"),
    });
  });

  it("has 46 bases, 3-4 per slot type, each type with a str, an agi and an int base", () => {
    expect(loot.bases).toHaveLength(46);
    for (const slot of SLOTS) {
      const of = loot.bases.filter((b) => b.slotType === slot);
      expect(of.length, slot).toBeGreaterThanOrEqual(3);
      expect(of.length, slot).toBeLessThanOrEqual(4);
      expect(new Set(of.map((b) => b.flavour)), slot).toEqual(new Set([...["str", "agi", "int"], ...(of.length === 4 ? ["any"] : [])]));
    }
    expect(new Set(loot.bases.map((b) => b.name.en)).size).toBe(loot.bases.length);
  });

  it("an implicit row is worth implicitPoints", () => {
    for (const b of loot.bases) expect(b.implicit.value / unitOf(b.implicit.stat), b.id).toBeCloseTo(rules.implicitPoints, 9);
  });

  it("affixes price the stats of named items as the items header does", () => {
    const UNIT: Record<string, number> = {
      str: 0.5, agi: 0.5, int: 0.5, hp: 12, armor: 0.25, regen: 0.1, damage: 0.005, attackSpeed: 0.005, spellPower: 0.005,
      moveSpeed: 0.01, goldFind: 0.01, magnet: 10, magicFind: 0.02, lifesteal: 0.0025,
    };
    for (const [stat, unit] of Object.entries(UNIT)) expect(unitOf(stat), stat).toBe(unit);
    expect(loot.affixes).toHaveLength(22);
  });

  it("every role pool can fill a mythic on its own, and lifesteal is in all three", () => {
    for (const role of ["str", "agi", "int"]) {
      const pool = loot.affixes.filter((a) => a.tags.includes(role));
      expect(pool.length, role).toBeGreaterThanOrEqual(rules.affixCount.mythic!);
      expect(pool.map((a) => a.stat), role).toContain("lifesteal");
    }
  });

  it("every possible roll stays within 10 % of its rarity budget", () => {
    const q = rules.rowRoll;
    for (const [rarity, budget] of Object.entries(BUDGET)) {
      const n = rules.affixCount[rarity]!;
      const share = budget - rules.implicitPoints;
      // Every tier of every row, and every row at the low or the high end of its roll.
      for (let combo = 0; combo < 4 ** n; combo++) {
        const weights = Array.from({ length: n }, (_, i) => rules.tiers[Math.floor(combo / 4 ** i) % 4]!.weight);
        const sum = weights.reduce((a, b) => a + b, 0);
        for (let ends = 0; ends < 2 ** n; ends++) {
          const rows = weights.map((w, i) => (share * w / sum) * ((ends >> i) & 1 ? 1 + q : 1 - q));
          const total = rules.implicitPoints + rows.reduce((a, b) => a + b, 0);
          expect(total, `${rarity} ${combo} ${ends}`).toBeGreaterThanOrEqual(budget * 0.9 - 1e-9);
          expect(total, `${rarity} ${combo} ${ends}`).toBeLessThanOrEqual(budget * 1.1 + 1e-9);
          if (rarity === "mythic") expect(Math.min(...rows), "a mythic has no tiny rows").toBeGreaterThanOrEqual(5);
        }
      }
    }
  });

  it("T4 is about twice T1; the top source reaches T4 and level 5, world 1 normal's first boss stays below T2", () => {
    const t = rules.tiers;
    expect(t[3]!.weight / t[0]!.weight).toBeGreaterThanOrEqual(1.8);
    expect(t[3]!.weight / t[0]!.weight).toBeLessThanOrEqual(2.2);
    expect(t[0]!.minPower).toBe(0);
    const top = Math.max(...rules.power.boss) + 4 * rules.power.perWorld + rules.power.difficulty.hell!;
    expect(top).toBeGreaterThanOrEqual(t[3]!.minPower);
    expect(top).toBeGreaterThanOrEqual(rules.levelAtPower[rules.levelAtPower.length - 1]!);
    expect(rules.power.boss[0]!).toBeLessThan(t[1]!.minPower);
    expect(rules.power.chestBase + 20 * rules.power.chestPerPhase).toBeLessThan(t[3]!.minPower);
  });

  it("Petr's answers: smart loot 60 %, 200 items, named shares 10 / 25 / 40 %", () => {
    expect(rules.smartShare).toBe(0.6);
    expect(rules.collectionLimit).toBe(200);
    expect(rules.namedShare).toEqual({ common: 0, rare: 0, epic: 0.1, legendary: 0.25, mythic: 0.4 });
    expect(rules.affixCount).toEqual({ common: 1, rare: 2, epic: 3, legendary: 4, mythic: 4 });
    expect(rules.mythicEffects.map((e) => e.kind).sort()).toEqual([
      "chain_on_attack", "gold_heals_castle", "haste_on_elite_kill", "low_hp_shield", "slow_aura", "splash_on_attack",
    ]);
  });

  it("Czech adjectives have the forms of all genders (hard -ý/-á/-é/-é, soft -í in all)", () => {
    const words = [...loot.affixes.map((a) => a.prefix), ...loot.names.first];
    for (const { en, cs } of words) {
      if (cs.m.endsWith("í")) {
        expect([cs.f, cs.n, cs.p], en).toEqual([cs.m, cs.m, cs.m]);
      } else {
        const stem = cs.m.slice(0, -1);
        expect(cs.m.endsWith("ý"), en).toBe(true);
        expect([cs.f, cs.n, cs.p], en).toEqual([`${stem}á`, `${stem}é`, `${stem}é`]);
      }
    }
    for (const b of loot.bases) expect(["m", "f", "n", "p"], b.id).toContain(b.gender);
    expect(new Set(loot.affixes.map((a) => a.prefix.en)).size).toBe(loot.affixes.length);
    expect(new Set(loot.affixes.map((a) => a.suffix.en)).size).toBe(loot.affixes.length);
  });

  it("every slot type has at least two nouns for rare names", () => {
    for (const slot of SLOTS) expect(loot.names.nouns[slot]!.length, slot).toBeGreaterThanOrEqual(2);
  });
});

describe("world maps", () => {
  type Pt = [number, number];
  type WorldJson = {
    id: string;
    map: {
      paths: { width: number; lines: Pt[][] };
      feature: { thickness: number; segments: [number, number, number, number][] };
      clear: { castle: number; ringInner: number; ringOuter: number };
    };
  };
  const worlds = JSON.parse(read("worlds.json")) as WorldJson[];
  const rules = JSON.parse(read("rules.json")) as { arena: { castle: { x: number; y: number }; heroStart: { x: number; y: number } } };
  const { x: cx, y: cy } = rules.arena.castle;
  const nearestToCastle = ([x1, y1, x2, y2]: [number, number, number, number]): number => {
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x1 + t * dx - cx, y1 + t * dy - cy);
  };

  // The river of Red Waste crosses the whole arena (and the arrival ring) on purpose: enemies north of it walk over
  // the bridges. Closed features (the wall, the tree ring) stay inside the ring.
  const crossesArena = new Set(["red-waste"]);

  it("every feature segment stays out of the castle circle; closed features stay inside the arrival ring", () => {
    for (const w of worlds) {
      const half = w.map.feature.thickness / 2;
      for (const s of w.map.feature.segments) {
        expect(nearestToCastle(s), w.id).toBeGreaterThan(w.map.clear.castle + half);
        if (crossesArena.has(w.id)) continue;
        const far = Math.max(Math.hypot(s[0] - cx, s[1] - cy), Math.hypot(s[2] - cx, s[3] - cy));
        expect(far, w.id).toBeLessThan(w.map.clear.ringInner - half);
      }
    }
  });

  it("the gaps between neighbouring feature segments that share no end are gates 200-410 wide", () => {
    for (const w of worlds) {
      const segs = w.map.feature.segments;
      for (let i = 0; i + 1 < segs.length; i++) {
        const a = segs[i]!, b = segs[i + 1]!;
        const gap = Math.hypot(b[0] - a[2], b[1] - a[3]);
        if (gap === 0) continue;
        expect(gap, `${w.id} gate ${i}`).toBeGreaterThanOrEqual(200);
        expect(gap, `${w.id} gate ${i}`).toBeLessThanOrEqual(410);
      }
    }
  });

  it("every path starts by the castle and ends beyond the arrival ring", () => {
    for (const w of worlds) {
      for (const line of w.map.paths.lines) {
        const [sx, sy] = line[0]!, [ex, ey] = line[line.length - 1]!;
        expect(Math.hypot(sx - cx, sy - cy), w.id).toBeLessThanOrEqual(250);
        expect(Math.hypot(ex - cx, ey - cy), w.id).toBeGreaterThan(w.map.clear.ringOuter);
      }
    }
  });

  it("the hero starts inside the clear castle circle", () => {
    const { x, y } = rules.arena.heroStart;
    for (const w of worlds) expect(Math.hypot(x - cx, y - cy), w.id).toBeLessThan(w.map.clear.castle);
  });
});
