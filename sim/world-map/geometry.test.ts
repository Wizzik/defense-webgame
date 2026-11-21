import { describe, expect, it } from "vitest";
import { gameData } from "../testing/game-data";
import { Rng } from "../rng";
import { isFree, nearestFree, pushOut, pushX, pushY } from "./geometry";
import { buildWorldMap, IslandKind, placeIsland } from "./map";

/** World 1's wall without islands. */
function wallOnly() {
  const data = gameData();
  data.worlds[0]!.map.islands.count = { min: 0, max: 0 };
  return buildWorldMap(data, 1, new Rng(1));
}

describe("pushOut", () => {
  it("moves a circle that reaches into a thick segment straight out to segHalf + r", () => {
    const map = wallOnly();
    // The middle wall segment runs along y = 1500 from x = -500 to 500, half thickness 45.
    pushOut(map, 0, 1480, 32);
    expect(pushX).toBeCloseTo(0, 9);
    expect(pushY).toBeCloseTo(1500 - 45 - 32, 9);
    pushOut(map, 100, 1530, 32);
    expect(pushX).toBeCloseTo(100, 9);
    expect(pushY).toBeCloseTo(1500 + 45 + 32, 9);
  });

  it("moves a circle at an island's centre out along +x", () => {
    const map = wallOnly();
    placeIsland(map, -1000, -1000, 150, IslandKind.Rock);
    pushOut(map, -1000, -1000, 20);
    expect(pushX).toBeCloseTo(-1000 + 170, 9);
    expect(pushY).toBeCloseTo(-1000, 9);
  });

  it("leaves a free circle where it is", () => {
    const map = wallOnly();
    pushOut(map, 0, 500, 32);
    expect(pushX).toBe(0);
    expect(pushY).toBe(500);
    expect(isFree(map, 0, 500, 32)).toBe(true);
    expect(isFree(map, 0, 1490, 32)).toBe(false);
  });

  it("nearestFree finds a free place for a point inside an island", () => {
    const map = wallOnly();
    placeIsland(map, 1000, -1000, 200, IslandKind.Ruin);
    nearestFree(map, 1000, -1000, 80);
    expect(isFree(map, pushX, pushY, 80)).toBe(true);
  });
});
