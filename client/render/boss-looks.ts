import type { GameData } from "../../data/schema";
import { enemyTint } from "./enemy-tints";
import { enemyModelId } from "./models";

/** Colour of the ring under a boss in a world that gives the boss no look of its own (world 1). */
export const DEFAULT_BOSS_AURA = 0xc8304a;

/** How a boss type is drawn and named in one world (design/worlds.yaml `bosses`, Petr's batch 2 task 5). */
export interface BossLookView {
  name: { en: string; cs: string };
  /** Id of the model file (assets/models/enemies). */
  model: string;
  tint: number;
  /** Scale of the drawn model on top of the collision size. */
  size: number;
  aura: number;
}

const hex = (value: string) => Number.parseInt(value.slice(1), 16);

/** The look of enemy type `type` in world `world` (1-based): the world's look of a boss, else the type's own. */
export function bossLook(data: GameData, world: number, type: number): BossLookView {
  const enemy = data.enemies[type]!;
  const look = data.worlds[world - 1]?.bosses?.[enemy.id];
  if (!look) {
    return { name: enemy.name, model: enemyModelId(enemy), tint: enemyTint(enemy.id), size: 1, aura: DEFAULT_BOSS_AURA };
  }
  const model = data.enemies.find((e) => e.id === look.model)!;
  return { name: look.name, model: enemyModelId(model), tint: hex(look.tint), size: look.size, aura: hex(look.aura) };
}

/**
 * The meshes of the enemy crowd: one per enemy type (index = type), then one per boss look of a world.
 * `meshOf[(world - 1) * types + type]` is the mesh an enemy of `type` is drawn with in `world`. Allocates: call once.
 */
export interface CrowdSkins {
  models: string[];
  tints: number[];
  sizes: number[];
  meshOf: Int16Array;
  types: number;
}

export function crowdSkins(data: GameData): CrowdSkins {
  const types = data.enemies.length;
  const models: string[] = [];
  const tints: number[] = [];
  const sizes: number[] = [];
  for (let type = 0; type < types; type++) {
    models.push(enemyModelId(data.enemies[type]!));
    tints.push(enemyTint(data.enemies[type]!.id));
    sizes.push(1);
  }
  const meshOf = new Int16Array(data.worlds.length * types);
  data.worlds.forEach((world, w) => {
    for (let type = 0; type < types; type++) {
      meshOf[w * types + type] = type;
      if (!world.bosses?.[data.enemies[type]!.id]) continue;
      const look = bossLook(data, w + 1, type);
      meshOf[w * types + type] = models.length;
      models.push(look.model);
      tints.push(look.tint);
      sizes.push(look.size);
    }
  });
  return { models, tints, sizes, meshOf, types };
}

/** The crowd mesh of `type` in `world` (1-based, clamped to the worlds there are). */
export function meshIndex(skins: CrowdSkins, world: number, type: number): number {
  const worlds = skins.meshOf.length / skins.types;
  const w = world < 1 ? 0 : world > worlds ? worlds - 1 : world - 1;
  return skins.meshOf[w * skins.types + type]!;
}
