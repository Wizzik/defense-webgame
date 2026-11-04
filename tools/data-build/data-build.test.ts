import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGameData } from "./build";
import { type AbilityEntry, type ExportAbility, loadDesign, loadMapExport, type ParamSpec } from "./load";
import { mapAbility } from "./map-abilities";
import { mapHero } from "./map-heroes";
import { resolveParam } from "./resolve";

const fixtures = join(import.meta.dirname, "fixtures");
const mapExport = () => loadMapExport(join(fixtures, "export"));
const design = () => loadDesign(join(fixtures, "design"));

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
      source: "A001",
      name: { en: "Pulse", cs: "Puls" },
      kind: "nova",
      targeting: "around_self",
      levels: 3,
      cooldown: [10, 10, 8],
      params: { damage: [100, 100, 300], radius: [200, 250, 300] },
      review: { reason: "engine+script", jassFunctions: ["Trig_Test_Nova_Actions"], notes: "Fixture note." },
    });
    expect(Object.keys(ability)).toEqual([
      "id", "source", "name", "kind", "targeting", "levels", "cooldown", "params", "review",
    ]);
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
    const data = buildGameData(mapExport(), design(), "test");
    expect(data.heroes).toStrictEqual([
      {
        id: "fixture-hero",
        source: "H001",
        name: { en: "Fixture Hero", cs: "Testovací hrdina" },
        primary: "agi",
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
    expect(data.abilities[2]).toStrictEqual({
      id: "spark",
      source: "A003",
      name: { en: "Spark", cs: "Jiskra" },
      kind: "projectile",
      targeting: "nearest",
      levels: 3,
      cooldown: [6, 6, 6],
      params: { damage: [50, 75, 100], range: [600, 700, 800], slow: [0.1, 0.2, 0.3] },
      review: { reason: "script", jassFunctions: ["Trig_Test_Bolt_Actions"] },
    });
    expect(data.abilities.filter((a) => a.review).map((a) => a.id)).toEqual(["pulse", "spark"]);
    expect(data.constants).toStrictEqual({
      strHitPointBonus: 20,
      agiAttackSpeedBonus: 0.01,
      defenseArmor: 0.05,
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

  it("appends design jassFunctions after the export ones", () => {
    const entry = abilityEntry("pulse");
    entry.review = { ...entry.review, jassFunctions: ["Trig_Test_Nova_Func002A", "Trig_Test_Nova_Actions"] };
    expect(mapAbility(exportAbility("A001"), entry).review).toStrictEqual({
      reason: "engine+script",
      jassFunctions: ["Trig_Test_Nova_Actions", "Trig_Test_Nova_Func002A"],
      notes: "Fixture note.",
    });
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
