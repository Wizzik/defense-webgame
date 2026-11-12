import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGameData } from "./build";
import { type AbilityEntry, type ExportAbility, loadDesign, loadMapExport, type ParamSpec } from "./load";
import { mapAbility } from "./map-abilities";
import { mapEnemy } from "./map-enemies";
import { mapHero } from "./map-heroes";
import { resolveParam } from "./resolve";

const fixtures = join(import.meta.dirname, "fixtures");
const mapExport = () => loadMapExport(join(fixtures, "export"));
const design = () => loadDesign(join(fixtures, "design"));
/** The fixture design with every multiplier 1, so the expectations show the export's numbers. */
const unscaledDesign = () => ({
  ...design(),
  scaling: {
    heroes: { moveSpeed: 1, attackCooldown: 1 },
    abilities: { cooldown: 1, damage: 1 },
    enemies: { hp: 1, moveSpeed: 1 },
  },
});

function exportAbility(id: string): ExportAbility {
  const found = mapExport().abilities.find((a) => a.id === id);
  if (!found) throw new Error(`fixture ability ${id} is missing`);
  return found;
}

function abilityEntry(id: string): AbilityEntry {
  const found = design().abilities.find((a) => a.id === id);
  if (!found) throw new Error(`fixture design entry ${id} is missing`);
  return found;
}

function errorMessage(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("expected an error");
}

describe("data-build", () => {
  it("resolves DataX per level with null carry-forward", () => {
    const nova = exportAbility("A001");
    // DataA is [100, null, 300] in the fixture.
    expect(resolveParam(nova, "DataA", 3)).toEqual([100, 100, 300]);
    // The real export omits unknown values: cooldown has no key on level 2.
    expect(resolveParam(nova, "cooldown", 3)).toEqual([10, 10, 8]);
    // Nothing on level 1 gives 0.
    expect(resolveParam(exportAbility("A002"), "cooldown", 3)).toEqual([0, 0, 0]);
  });

  it("maps a nova ability", () => {
    const ability = mapAbility(exportAbility("A001"), abilityEntry("pulse"));
    expect(ability).toStrictEqual({
      id: "pulse",
      name: { en: "Pulse", cs: "Puls" },
      description: { en: "Pulse text", cs: "Puls text" },
      kind: "nova",
      targeting: "around_self",
      levels: 3,
      cooldown: [10, 10, 8],
      params: { damage: [100, 100, 300], radius: [200, 250, 300] },
    });
    expect(Object.keys(ability)).toEqual(["id", "name", "description", "kind", "targeting", "levels", "cooldown", "params"]);
  });

  it("takes the cooldown from the design entry when it gives one", () => {
    const entry = { ...abilityEntry("pulse"), cooldown: { design: [15, 15, 15] } };
    expect(mapAbility(exportAbility("A001"), entry).cooldown).toEqual([15, 15, 15]);
  });

  it("copies descriptions and roles", () => {
    const data = buildGameData(mapExport(), design(), "test");
    expect(data.abilities[0].description).toEqual({ en: "Pulse text", cs: "Puls text" });
    expect(data.heroes[0].role).toEqual({ en: "Fixture role", cs: "Testovací role" });
  });

  it("maps weapon_type mbounce to bounce", () => {
    const hero = mapHero(mapExport().heroes[0], design().heroes[0]);
    expect(hero.baseAttack).toStrictEqual({
      kind: "bounce", range: 500, cooldown: 1.4, damageMin: 3, damageMax: 9,
    });
  });

  it("fails with readable error when source id is missing", () => {
    const d = design();
    d.heroes[0].source = "H404";
    const message = errorMessage(() => buildGameData(mapExport(), d, "test"));
    expect(message).toContain("design/heroes.yaml");
    expect(message).toContain("fixture-hero");
    expect(message).toContain("H404");
  });

  it("rejects unknown param source", () => {
    const entry = abilityEntry("pulse");
    entry.params.damage = "DataZ" as unknown as ParamSpec;
    const message = errorMessage(() => mapAbility(exportAbility("A001"), entry));
    expect(message).toContain("pulse");
    expect(message).toContain("damage");
    expect(message).toContain("DataZ");
  });

  it("builds validated game data from the fixture files", () => {
    const data = buildGameData(mapExport(), unscaledDesign(), "test");
    expect(data.heroes).toStrictEqual([
      {
        id: "fixture-hero",
        name: { en: "Fixture Hero", cs: "Testovací hrdina" },
        role: { en: "Fixture role", cs: "Testovací role" },
        primary: "agi",
        hp: 500,
        armor: 2,
        moveSpeed: 310,
        attributes: {
          str: { base: 18, perLevel: 1.5 },
          agi: { base: 22, perLevel: 2.5 },
          int: { base: 15, perLevel: 1.25 },
        },
        baseAttack: { kind: "bounce", range: 500, cooldown: 1.4, damageMin: 3, damageMax: 9 },
        signatureAbilities: ["pulse", "focus", "spark"],
        ultimate: "echo",
      },
    ]);
    expect(data.abilities.map((a) => a.id)).toEqual(["pulse", "focus", "spark", "echo"]);
    expect(data.enemies.map((e) => e.id)).toEqual(["grunt"]);
    expect(data.abilities[2]).toStrictEqual({
      id: "spark",
      name: { en: "Spark", cs: "Jiskra" },
      description: { en: "Spark text", cs: "Jiskra text" },
      kind: "projectile",
      targeting: "nearest",
      levels: 3,
      cooldown: [6, 6, 6],
      params: { damage: [50, 75, 100], range: [600, 700, 800] },
    });
    expect(data.constants).toStrictEqual({
      strHitPointBonus: 20,
      agiAttackSpeedBonus: 0.01,
      defenseArmor: 0.05,
      agiDefenseBonus: 0.1,
      primaryAttackBonus: 1,
      attackSpeedCap: 6,
      mapVersion: "test",
    });
    expect(JSON.stringify(data)).not.toContain("Export text");
  });

  it("rejects a non-numeric misc constant with its name", () => {
    const src = mapExport();
    src.mapInfo.misc_constants.DefenseArmor = "n/a";
    expect(errorMessage(() => buildGameData(src, design(), "test"))).toContain("DefenseArmor");
  });

  it("rejects an unsupported weapon_type", () => {
    const hero = { ...mapExport().heroes[0], weapon_type: "artillery" };
    const message = errorMessage(() => mapHero(hero, design().heroes[0]));
    expect(message).toContain("fixture-hero");
    expect(message).toContain("artillery");
  });

  it("maps enemy stats from the units export", () => {
    const enemy = mapEnemy(mapExport().units[0], design().enemies[0]);
    expect(enemy).toStrictEqual({
      id: "grunt",
      name: { en: "Grunt", cs: "Pěšák" },
      level: 1,
      hp: 420,
      hpRegen: 0.25,
      armor: 3,
      moveSpeed: 270,
      collision: 31,
      acquireRange: 500,
      attack: { kind: "melee", range: 90, cooldown: 1.35, damageMin: 14, damageMax: 15 },
      behavior: "siege",
      xp: 1,
    });
  });

  it("copies the behavior of a design entry", () => {
    const entry = { ...design().enemies[0], behavior: "flank" as const };
    expect(mapEnemy(mapExport().units[0], entry).behavior).toBe("flank");
  });

  it("fails when a design entry has no behavior", () => {
    const entry = { ...design().enemies[0] } as Partial<ReturnType<typeof design>["enemies"][number]>;
    delete entry.behavior;
    expect(errorMessage(() => mapEnemy(mapExport().units[0], entry as never))).toBe(
      "design/enemies.yaml: grunt: missing behavior",
    );
  });

  it("maps a ranged weapon to a ranged attack", () => {
    for (const weapon_type of ["instant", "missile"]) {
      const enemy = mapEnemy({ ...mapExport().units[0], weapon_type }, design().enemies[0]);
      expect(enemy.attack.kind, weapon_type).toBe("ranged");
    }
  });

  it("fails on an unknown weapon type", () => {
    const unit = { ...mapExport().units[0], weapon_type: "artillery" };
    expect(errorMessage(() => mapEnemy(unit, design().enemies[0]))).toBe(
      'design/enemies.yaml: grunt: unsupported weapon_type "artillery" of U001 in units.json; '
        + "known: normal, instant, missile, msplash, mline, mbounce",
    );
  });

  it("applies enemy multipliers before scaling", () => {
    const d = unscaledDesign();
    d.scaling.enemies = { hp: 0.3, moveSpeed: 1.22 };
    d.enemies[0].multipliers = { hp: 0.5, moveSpeed: 1.5, collision: 0.8, damage: 0.6 };
    const enemy = buildGameData(mapExport(), d, "test").enemies[0];
    expect(enemy.hp).toBe(63);
    expect(enemy.moveSpeed).toBe(494);
    expect(enemy.collision).toBe(25);
    expect([enemy.attack.damageMin, enemy.attack.damageMax]).toEqual([8, 9]);
  });

  it("copies the heal of a design entry", () => {
    const d = design();
    expect("heal" in buildGameData(mapExport(), d, "test").enemies[0]).toBe(false);
    d.enemies[0].heal = { amount: 8, range: 450, cooldown: 1 };
    const enemy = buildGameData(mapExport(), d, "test").enemies[0];
    expect(enemy.heal).toStrictEqual({ amount: 8, range: 450, cooldown: 1 });
    expect(Object.keys(enemy).slice(-2)).toEqual(["xp", "heal"]);
    expect(Object.keys(enemy)).not.toContain("multipliers");
  });

  it("copies charge and aura of a design entry after heal", () => {
    const d = design();
    const charge = { minRange: 300, maxRange: 700, windupSeconds: 0.5, speedMultiplier: 2.5, damageMultiplier: 2, distance: 900, cooldownSeconds: 6 };
    d.enemies[0].heal = { amount: 8, range: 450, cooldown: 1 };
    d.enemies[0].charge = charge;
    d.enemies[0].aura = { radius: 400, moveSpeed: 0.25, damage: 0.25 };
    const enemy = buildGameData(mapExport(), d, "test").enemies[0];
    expect(enemy.charge).toStrictEqual(charge);
    expect(enemy.aura).toStrictEqual({ radius: 400, moveSpeed: 0.25, damage: 0.25 });
    expect(Object.keys(enemy).slice(-4)).toEqual(["xp", "heal", "charge", "aura"]);
  });

  it("fails with readable error when enemy source is missing", () => {
    const d = design();
    d.enemies[0].source = "U404";
    const message = errorMessage(() => buildGameData(mapExport(), d, "test"));
    expect(message).toContain("design/enemies.yaml");
    expect(message).toContain("grunt");
    expect(message).toContain("units.json");
  });

  it("fails when an enemy stat is missing in the export", () => {
    const unit = { ...mapExport().units[0], hp: undefined };
    expect(errorMessage(() => mapEnemy(unit, design().enemies[0]))).toBe(
      "design/enemies.yaml: grunt: units.json U001 has no hp",
    );
  });

  it("copies rules", () => {
    const data = buildGameData(mapExport(), design(), "test");
    expect(data.rules).toStrictEqual(design().rules);
    expect(data.rules.arena.spawn).toEqual({ radius: 2000, spread: 150 });
  });

  it("maps hero hp and armor", () => {
    const hero = mapHero(mapExport().heroes[0], design().heroes[0]);
    expect(hero.hp).toBe(500);
    expect(hero.armor).toBe(2);
  });

  it("maps new constants", () => {
    const { constants } = buildGameData(mapExport(), design(), "test");
    expect(constants.agiDefenseBonus).toBe(0.1);
    expect(constants.primaryAttackBonus).toBe(1);
  });

  it("reports the slug when a design array has the wrong length", () => {
    const d = design();
    const pulse = d.abilities.find((a) => a.id === "pulse");
    if (!pulse) throw new Error("fixture ability pulse is missing");
    pulse.params.damage = { design: [1, 2] };
    const message = errorMessage(() => buildGameData(mapExport(), d, "test"));
    expect(message).toContain("pulse");
    expect(message).toContain("params.damage");
  });

  it("keeps key order of heroes and enemies", () => {
    const data = buildGameData(mapExport(), design(), "test");
    expect(Object.keys(data.heroes[0])).toEqual([
      "id", "name", "role", "primary", "hp", "armor", "moveSpeed", "attributes", "baseAttack", "signatureAbilities", "ultimate",
    ]);
    expect(Object.keys(data.enemies[0])).toEqual([
      "id", "name", "level", "hp", "hpRegen", "armor", "moveSpeed", "collision", "acquireRange", "attack", "behavior", "xp",
    ]);
  });

  it("writes no source or review", () => {
    const data = buildGameData(mapExport(), design(), "test");
    for (const item of [...data.heroes, ...data.abilities, ...data.enemies]) {
      expect(Object.keys(item)).not.toContain("source");
      expect(Object.keys(item)).not.toContain("review");
    }
    expect(JSON.stringify(data)).not.toMatch(/Trig_|A00\d|H001|U001|Test Unit/);
  });

  it("rejects review notes on an ability that is not script-backed", () => {
    const entry = { ...abilityEntry("focus"), review: { notes: "x" } };
    const message = errorMessage(() => mapAbility(exportAbility("A002"), entry));
    expect(message).toContain("focus");
    expect(message).toContain("review");
  });

  it("rejects a non-numeric export value", () => {
    const message = errorMessage(() => resolveParam(exportAbility("A002"), "DataB", 3));
    expect(message).toContain("DataB");
    expect(message).toContain("level 1");
  });
});
