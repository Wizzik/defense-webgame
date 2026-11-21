import { describe, expect, it } from "vitest";
import { buildWorldMap, Rng } from "../../sim";
import { gameData } from "../../sim/testing/game-data";
import { WALL_PIECE, worldInstances } from "./world-view";

describe("worldInstances", () => {
  const data = gameData();

  it("one instance per island, the wall in pieces and a post at every free segment end", () => {
    const map = buildWorldMap(data, 1, new Rng(5));
    const list = worldInstances(map);
    let pieces = 0;
    for (let s = 0; s < map.segCount; s++) {
      const dx = map.segX2[s]! - map.segX1[s]!;
      const dy = map.segY2[s]! - map.segY1[s]!;
      pieces += Math.ceil(Math.sqrt(dx * dx + dy * dy) / WALL_PIECE);
    }
    const islands = list.filter((i) => i.model !== "wall" && i.model !== "gate-post");
    expect(islands).toHaveLength(map.islandCount);
    expect(list.filter((i) => i.model === "wall")).toHaveLength(pieces);
    // world 1: two gates (four ends) and the two outer ends of the wall
    expect(list.filter((i) => i.model === "gate-post")).toHaveLength(6);
    for (const i of islands) expect(["rock-a", "rock-b", "rock-c", "tree-a", "tree-b", "trees-a", "trees-b", "trees-c", "ruin"]).toContain(i.model);
  });

  it("is the same for the same map", () => {
    expect(worldInstances(buildWorldMap(data, 1, new Rng(9)))).toEqual(worldInstances(buildWorldMap(data, 1, new Rng(9))));
  });
});
