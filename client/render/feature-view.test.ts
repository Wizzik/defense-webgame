import { describe, expect, it } from "vitest";
import { buildWorldMap, Rng } from "../../sim";
import { gameData } from "../../sim/testing/game-data";
import { featureInstances, RIDGE_STEP, TREE_STEP } from "./feature-view";
import { lookOf } from "./world-look";
import { WALL_PIECE } from "./world-view";

const data = gameData();
const near = (a: { x: number; y: number }, x: number, y: number, d: number): boolean =>
  (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y) <= d * d;

describe("featureInstances", () => {
  it("the river of world 2 has water on every segment and exactly two bridges at the gaps", () => {
    const map = buildWorldMap(data, 2, new Rng(1));
    const list = featureInstances(map, "river", lookOf("red-waste").islands.trees);
    expect(list.filter((i) => i.model === "water")).toHaveLength(map.segCount);
    const bridges = list.filter((i) => i.model === "bridge");
    expect(bridges).toHaveLength(2);
    expect(bridges.some((b) => near(b, -900, 1205, 60))).toBe(true);
    expect(bridges.some((b) => near(b, 1150, 1100, 60))).toBe(true);
    expect(list.filter((i) => i.model !== "water" && i.model !== "bridge")).toHaveLength(0);
  });

  it("the tree ring of world 3 has trees along every segment and none in the passages", () => {
    const map = buildWorldMap(data, 3, new Rng(1));
    const trees = lookOf("shadewood").islands.trees;
    const list = featureInstances(map, "trees", trees);
    const standing = list.filter((i) => trees.includes(i.model));
    expect(standing.length).toBeGreaterThanOrEqual(16 * 4);
    for (const [x, y] of [[919, 919], [-919, 919], [-919, -919], [919, -919]] as const) {
      for (const t of standing) expect(near(t, x, y, 120), `${t.x},${t.y}`).toBe(false);
    }
    expect(list.filter((i) => i.model === "roots")).toHaveLength(map.segCount);
    expect(TREE_STEP).toBe(90);
  });

  it("world 1 keeps today's wall pieces and posts", () => {
    const map = buildWorldMap(data, 1, new Rng(5));
    const list = featureInstances(map, "wall", []);
    let pieces = 0;
    for (let s = 0; s < map.segCount; s++) {
      const dx = map.segX2[s]! - map.segX1[s]!;
      const dy = map.segY2[s]! - map.segY1[s]!;
      pieces += Math.ceil(Math.sqrt(dx * dx + dy * dy) / WALL_PIECE);
    }
    expect(list.filter((i) => i.model === "wall")).toHaveLength(pieces);
    expect(list.filter((i) => i.model === "gate-post")).toHaveLength(6);
    expect(list).toHaveLength(pieces + 6);
  });
});

describe("featureInstances of worlds 4 and 5", () => {
  it("the ice ridge has crystals along every segment and none in the pass", () => {
    const map = buildWorldMap(data, 4, new Rng(1));
    const items = featureInstances(map, "ridge", []);
    const crystals = items.filter((i) => i.model === "crystal");
    let length = 0;
    for (let s = 0; s < map.segCount; s++) length += Math.hypot(map.segX2[s]! - map.segX1[s]!, map.segY2[s]! - map.segY1[s]!);
    expect(crystals.length).toBeGreaterThanOrEqual(Math.floor(length / RIDGE_STEP));
    expect(crystals.filter((c) => near(c, 1061, 1061, 150))).toEqual([]);
    expect(items.filter((i) => i.model === "ridge-base")).toHaveLength(map.segCount);
    for (const c of crystals) {
      expect(c.scale).toBeGreaterThanOrEqual(0.8);
      expect(c.scale).toBeLessThanOrEqual(1.8);
    }
  });

  it("the broken wall has pieces, low pieces and rubble at every breach", () => {
    const map = buildWorldMap(data, 5, new Rng(1));
    const items = featureInstances(map, "broken", []);
    expect(items.filter((i) => i.model === "rubble")).toHaveLength(8 * 3);
    expect(items.filter((i) => i.model === "wall-low").length).toBeGreaterThan(0);
    expect(items.filter((i) => i.model === "gate-post")).toEqual([]);
    const pieces = items.filter((i) => i.model === "wall" || i.model === "wall-low");
    for (const [x, y] of [[679, 1319], [-1412, 452], [-679, -1319], [1412, -452]] as const) {
      expect(pieces.filter((p) => near(p, x, y, 150)), `${x},${y}`).toEqual([]);
    }
  });
});
