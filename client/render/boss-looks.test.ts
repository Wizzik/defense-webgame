import { describe, expect, it } from "vitest";
import { gameData } from "../../sim/testing/game-data";
import { enemyName } from "../ui/boss-name";
import { bossLook, crowdSkins, DEFAULT_BOSS_AURA, meshIndex } from "./boss-looks";
import { enemyTint } from "./enemy-tints";

const data = gameData();
const typeOf = (id: string) => data.enemies.findIndex((e) => e.id === id);
/** The bosses a run brings: the timed boss events and the final boss. */
const runBosses = [
  ...data.rules.events.filter((e) => e.kind === "boss").map((e) => (e as { enemy: string }).enemy),
  data.rules.run.finale.boss,
];

describe("boss looks per world", () => {
  it("world 1 keeps today's bosses: their names, models and tints", () => {
    for (const id of runBosses) {
      const type = typeOf(id);
      const look = bossLook(data, 1, type);
      expect(look.name).toEqual(data.enemies[type]!.name);
      expect(look.model).toBe(data.enemies[type]!.model);
      expect(look.tint).toBe(enemyTint(id));
      expect(look.size).toBe(1);
      expect(look.aura).toBe(DEFAULT_BOSS_AURA);
    }
  });

  it("worlds 2-5 give every boss of the run its own name, model, tint and aura colour", () => {
    expect(runBosses).toHaveLength(4);
    const names = new Set(runBosses.map((id) => data.enemies[typeOf(id)]!.name.en));
    for (let world = 2; world <= data.worlds.length; world++) {
      const looks = runBosses.map((id) => bossLook(data, world, typeOf(id)));
      for (const [i, look] of looks.entries()) {
        expect(data.worlds[world - 1]!.bosses?.[runBosses[i]!], `world ${world} ${runBosses[i]}`).toBeDefined();
        expect(names.has(look.name.en), look.name.en).toBe(false);
        names.add(look.name.en);
        expect(look.name.cs.length).toBeGreaterThan(0);
      }
      expect(new Set(looks.map((l) => l.model)).size).toBe(4);
    }
  });

  it("the boss bar and the news name the boss of the run's world", () => {
    const type = typeOf("iron-marshal");
    expect(enemyName(data, 1, type, "en")).toBe("Iron Marshal");
    expect(enemyName(data, 2, type, "cs")).toBe(data.worlds[1]!.bosses!["iron-marshal"]!.name.cs);
    expect(enemyName(data, 3, typeOf("brute"), "en")).toBe(data.enemies[typeOf("brute")]!.name.en);
  });

  it("the crowd has one mesh per type and one per boss look; a world picks its boss meshes", () => {
    const skins = crowdSkins(data);
    const looks = data.worlds.reduce((n, w) => n + Object.keys(w.bosses ?? {}).length, 0);
    expect(skins.models).toHaveLength(data.enemies.length + looks);
    expect(skins.tints).toHaveLength(skins.models.length);
    const marshal = typeOf("iron-marshal");
    expect(meshIndex(skins, 1, marshal)).toBe(marshal);
    const second = meshIndex(skins, 2, marshal);
    expect(second).toBeGreaterThanOrEqual(data.enemies.length);
    expect(skins.models[second]).toBe(bossLook(data, 2, marshal).model);
    expect(skins.sizes[second]).toBe(bossLook(data, 2, marshal).size);
    expect(meshIndex(skins, 4, typeOf("brute"))).toBe(typeOf("brute"));
    // an out-of-range world is clamped
    expect(meshIndex(skins, 99, marshal)).toBe(meshIndex(skins, data.worlds.length, marshal));
  });
});
