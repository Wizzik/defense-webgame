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
      abilities: { cooldown: 0.33, damage: 0.5, levelGrowthExponent: 1, levels: 2, ultimateLevels: 2, passiveLevels: 2, areaScale: 1 },
      enemies: { hp: 0.3, moveSpeed: 1.22, bossHp: 1, bossDamage: 1 },
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
      abilities: { cooldown: 1, damage: 0.5, levelGrowthExponent: 1, levels: 2, ultimateLevels: 2, passiveLevels: 2, areaScale: 1 },
      enemies: { hp: 1, moveSpeed: 1, bossHp: 1, bossDamage: 1 },
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

  it("areaScale shrinks radius, hitRadius, width and endWidth, rounded, and keeps the reach", () => {
    const s = parseScaling({
      heroes: { moveSpeed: 1, attackCooldown: 1 },
      abilities: { cooldown: 1, damage: 1, levelGrowthExponent: 1, levels: 2, ultimateLevels: 2, passiveLevels: 2, areaScale: 0.5 },
      enemies: { hp: 1, moveSpeed: 1, bossHp: 1, bossDamage: 1 },
    });
    const ability = scaleAbility(
      {
        cooldown: [1, 1],
        params: {
          radius: [350, 401], hitRadius: [275, 350], width: [250, 250], endWidth: [99, 100],
          range: [800, 900], length: [1500, 1500], attackRange: [600, 600], damage: [100, 200],
        },
      } as never,
      s,
    );
    expect(ability.params).toEqual({
      radius: [175, 201], hitRadius: [138, 175], width: [125, 125], endWidth: [50, 50],
      range: [800, 900], length: [1500, 1500], attackRange: [600, 600], damage: [100, 200],
    });
  });

  it("a boss takes bossHp on its rounded hp and bossDamage on its attack, slam and strike", () => {
    const s = parseScaling({
      heroes: { moveSpeed: 1, attackCooldown: 1 },
      abilities: { cooldown: 1, damage: 1, levelGrowthExponent: 1, levels: 2, ultimateLevels: 2, passiveLevels: 2, areaScale: 1 },
      enemies: { hp: 0.35, moveSpeed: 1, bossHp: 3, bossDamage: 2 },
    });
    const boss = {
      hp: 1001, moveSpeed: 300, boss: true, attack: { kind: "melee", damageMin: 42, damageMax: 50 },
      slam: { damage: 120 }, strike: { damage: 150 },
    };
    const scaled = scaleEnemy(boss as never, s);
    expect(scaled.hp).toBe(Math.round(1001 * 0.35) * 3);
    expect([scaled.attack.damageMin, scaled.attack.damageMax, scaled.slam!.damage, scaled.strike!.damage]).toEqual([84, 100, 240, 300]);
    const common = scaleEnemy({ ...boss, boss: undefined } as never, s);
    expect(common.hp).toBe(Math.round(1001 * 0.35));
    expect(common.attack.damageMin).toBe(42);
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
      abilities: { cooldown: 1, damage: 1, levelGrowthExponent: 1, levels: 2, ultimateLevels: 2, passiveLevels: 2, areaScale: 1 },
      enemies: { hp: 1, moveSpeed: 1, bossHp: 1, bossDamage: 1 },
    };
    expect(() => parseScaling(ok)).not.toThrow();
    expect(errorMessage(() => parseScaling({ ...ok, enemies: { hp: 1 } }))).toContain("design/scaling.yaml");
    expect(errorMessage(() => parseScaling({ ...ok, enemies: { hp: 1 } }))).toContain("moveSpeed");
    expect(errorMessage(() => parseScaling({ ...ok, extra: {} }))).toContain("extra");
    expect(errorMessage(() => parseScaling({ ...ok, abilities: { cooldown: 0, damage: 1, levelGrowthExponent: 1, levels: 2, ultimateLevels: 2, passiveLevels: 2, areaScale: 1 } }))).toContain("cooldown");
    expect(errorMessage(() => parseScaling({ ...ok, abilities: { cooldown: 1, damage: 0, levelGrowthExponent: 1, levels: 2, ultimateLevels: 2, passiveLevels: 2, areaScale: 1 } }))).toContain("abilities.damage");
    expect(errorMessage(() => parseScaling({ ...ok, abilities: { cooldown: 1, levelGrowthExponent: 1, levels: 2, ultimateLevels: 2, passiveLevels: 2, areaScale: 1 } }))).toContain("damage");
    expect(errorMessage(() => parseScaling({ ...ok, abilities: { cooldown: 1, damage: -1, levelGrowthExponent: 1, levels: 2, ultimateLevels: 2, passiveLevels: 2, areaScale: 1 } }))).toContain("design/scaling.yaml");
    expect(errorMessage(() => parseScaling(null))).toContain("design/scaling.yaml");
  });
  describe("level growth", () => {
    const withGrowth = (damage: number, levelGrowthExponent: unknown) =>
      parseScaling({
        heroes: { moveSpeed: 1, attackCooldown: 1 },
        abilities: { cooldown: 1, damage, levelGrowthExponent, levels: 2, ultimateLevels: 2, passiveLevels: 2, areaScale: 1 },
        enemies: { hp: 1, moveSpeed: 1, bossHp: 1, bossDamage: 1 },
      });

    it("flattens the growth of damage and heal rows from level 1", () => {
      const s = withGrowth(1, 0.5);
      const ability = scaleAbility(
        {
          cooldown: [1],
          params: {
            damage: [90, 180, 360, 750, 1500], amount: [150, 300, 600, 1500, 3000], bonusDamage: [300, 600, 900, 1200, 1500],
            tickDamage: [18, 18, 18, 18, 18], radius: [350, 400, 450, 500, 550], extraTargets: [1, 1, 2, 2, 3],
          },
        } as never,
        s,
      );
      expect(ability.params).toEqual({
        damage: [90, 127, 180, 260, 367], amount: [150, 212, 300, 474, 671], bonusDamage: [300, 424, 520, 600, 671],
        tickDamage: [18, 18, 18, 18, 18], radius: [350, 400, 450, 500, 550], extraTargets: [1, 1, 2, 2, 3],
      });
    });

    it("leaves a row with zero at level 1 and a one-level row alone", () => {
      const s = withGrowth(1, 0.5);
      const ability = scaleAbility({ cooldown: [1], params: { damage: [0, 50, 100], amount: [120], tickDamage: [10, 0, 40] } } as never, s);
      expect(ability.params).toEqual({ damage: [0, 50, 100], amount: [120], tickDamage: [10, 0, 20] });
      for (const row of Object.values(ability.params as Record<string, number[]>)) {
        for (const v of row) expect(Number.isFinite(v)).toBe(true);
      }
    });

    it("growth applies after the damage multiplier", () => {
      const s = withGrowth(0.5, 0.5);
      const ability = scaleAbility({ cooldown: [1], params: { damage: [180, 3000] } } as never, s);
      expect(ability.params).toEqual({ damage: [90, 367] });
    });

    it("rejects a missing or out-of-range levelGrowthExponent", () => {
      const missing = {
        heroes: { moveSpeed: 1, attackCooldown: 1 },
        abilities: { cooldown: 1, damage: 1, levels: 2, ultimateLevels: 2, passiveLevels: 2, areaScale: 1 },
        enemies: { hp: 1, moveSpeed: 1, bossHp: 1, bossDamage: 1 },
      };
      expect(errorMessage(() => parseScaling(missing))).toContain("abilities.levelGrowthExponent");
      expect(errorMessage(() => withGrowth(1, 0))).toContain("abilities.levelGrowthExponent");
      expect(errorMessage(() => withGrowth(1, 1.5))).toContain("abilities.levelGrowthExponent");
      expect(() => withGrowth(1, 1)).not.toThrow();
    });
  });
});
