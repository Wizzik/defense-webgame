import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGameData } from "./build";
import { loadDesign, loadMapExport, loadScaling } from "./load";
import { mapAbility } from "./map-abilities";
import { mapEnemy } from "./map-enemies";
import { mapHero } from "./map-heroes";
import { parseScaling, scaleAbility, scaleEnemy, scaleHero } from "./scaling";

const fixtures = join(import.meta.dirname, "fixtures");
const mapExport = () => loadMapExport(join(fixtures, "export"));
const design = () => loadDesign(join(fixtures, "design"));

function errorMessage(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("expected an error");
}

describe("scaling", () => {
  it("applies uniform multipliers", () => {
    const d = design();
    const s = d.scaling;
    const rawHero = mapHero(mapExport().heroes[0], d.heroes[0]);
    const hero = scaleHero(rawHero, s);
    expect(hero.moveSpeed).toBe(Math.round(rawHero.moveSpeed * s.heroes.moveSpeed));
    expect(hero.baseAttack.cooldown).toBe(Math.round(rawHero.baseAttack.cooldown * s.heroes.attackCooldown * 100) / 100);
    expect(hero.hp).toBe(rawHero.hp);

    const rawEnemy = mapEnemy(mapExport().units[0], d.enemies[0]);
    const enemy = scaleEnemy(rawEnemy, s);
    expect(enemy.hp).toBe(Math.round(rawEnemy.hp * s.enemies.hp));
    expect(enemy.moveSpeed).toBe(Math.round(rawEnemy.moveSpeed * s.enemies.moveSpeed));
    expect(enemy.attack).toStrictEqual(rawEnemy.attack);

    const rawAbility = mapAbility(mapExport().abilities.find((a) => a.id === "A001")!, d.abilities[0]);
    const ability = scaleAbility(rawAbility, s);
    expect(ability.cooldown).toEqual(rawAbility.cooldown.map((c) => Math.round(c * s.abilities.cooldown * 100) / 100));
    const raw = rawAbility.params as Record<string, number[]>;
    const scaled = ability.params as Record<string, number[]>;
    expect(scaled.damage).toEqual(raw.damage.map((v) => Math.round(v * s.abilities.damage)));
    expect(scaled.radius).toEqual(raw.radius);
  });

  it("rounds speeds and hp to integers and cooldowns to 2 decimals", () => {
    const s = parseScaling({
      heroes: { moveSpeed: 1.4, attackCooldown: 0.5 },
      abilities: { cooldown: 0.33, damage: 0.5 },
      enemies: { hp: 0.3, moveSpeed: 1.22 },
    });
    const enemy = scaleEnemy({ hp: 421, moveSpeed: 270 } as never, s);
    expect(enemy.hp).toBe(126);
    expect(enemy.moveSpeed).toBe(329);
    const ability = scaleAbility({ cooldown: [10, 8, 0], params: {} } as never, s);
    expect(ability.cooldown).toEqual([3.3, 2.64, 0]);
    const hero = scaleHero({ moveSpeed: 305, baseAttack: { cooldown: 1.35 } } as never, s);
    expect(hero.moveSpeed).toBe(427);
    expect(hero.baseAttack.cooldown).toBe(0.68);
  });

  it("scales damage, tickDamage and amount but not other params", () => {
    const s = parseScaling({
      heroes: { moveSpeed: 1, attackCooldown: 1 },
      abilities: { cooldown: 1, damage: 0.5 },
      enemies: { hp: 1, moveSpeed: 1 },
    });
    const ability = scaleAbility(
      {
        cooldown: [1],
        params: { damage: [101, 500], tickDamage: [100, 500], amount: [500, 1001], empower: [3, 5], radius: [350, 400], damageBonus: [0.05, 0.1] },
      } as never,
      s,
    );
    expect(ability.params).toEqual({
      damage: [51, 250], tickDamage: [50, 250], amount: [250, 501], empower: [3, 5], radius: [350, 400], damageBonus: [0.05, 0.1],
    });
  });

  it("scales every hero, ability and enemy in buildGameData", () => {
    const data = buildGameData(mapExport(), design(), "test");
    expect(data.heroes[0].moveSpeed).toBe(465);
    expect(data.heroes[0].baseAttack.cooldown).toBe(0.7);
    expect(data.abilities[0].cooldown).toEqual([3.3, 3.3, 2.64]);
    expect(data.enemies[0].hp).toBe(126);
    expect(data.enemies[0].moveSpeed).toBe(329);
  });

  it("fails with readable error when scaling.yaml is missing", () => {
    const message = errorMessage(() => loadScaling(join(fixtures, "no-such-design")));
    expect(message).toContain("scaling.yaml");
    expect(message).toContain("missing");
  });

  it("rejects a missing key, an unknown key and a non-positive multiplier", () => {
    const ok = {
      heroes: { moveSpeed: 1, attackCooldown: 1 },
      abilities: { cooldown: 1, damage: 1 },
      enemies: { hp: 1, moveSpeed: 1 },
    };
    expect(() => parseScaling(ok)).not.toThrow();
    expect(errorMessage(() => parseScaling({ ...ok, enemies: { hp: 1 } }))).toContain("design/scaling.yaml");
    expect(errorMessage(() => parseScaling({ ...ok, enemies: { hp: 1 } }))).toContain("moveSpeed");
    expect(errorMessage(() => parseScaling({ ...ok, extra: {} }))).toContain("extra");
    expect(errorMessage(() => parseScaling({ ...ok, abilities: { cooldown: 0, damage: 1 } }))).toContain("cooldown");
    expect(errorMessage(() => parseScaling({ ...ok, abilities: { cooldown: 1, damage: 0 } }))).toContain("abilities.damage");
    expect(errorMessage(() => parseScaling({ ...ok, abilities: { cooldown: 1 } }))).toContain("damage");
    expect(errorMessage(() => parseScaling({ ...ok, abilities: { cooldown: 1, damage: -1 } }))).toContain("design/scaling.yaml");
    expect(errorMessage(() => parseScaling(null))).toContain("design/scaling.yaml");
  });
});
