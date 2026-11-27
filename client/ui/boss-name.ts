import type { GameData } from "../../data/schema";

/** Name of enemy type `type` in world `world` (1-based): a boss's own name in that world (design/worlds.yaml), else the type's. */
export function enemyName(data: GameData, world: number, type: number, lang: "en" | "cs"): string {
  const enemy = data.enemies[type]!;
  return (data.worlds[world - 1]?.bosses?.[enemy.id]?.name ?? enemy.name)[lang];
}
