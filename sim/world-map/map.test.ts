import { describe, expect, it } from "vitest";
import type { GameData } from "../../data/schema";
import { createRun } from "../run";
import { Rng } from "../rng";
import { gameData } from "../testing/game-data";
import { groundSpeedScale, inThicket, isFree } from "./geometry";
import { buildWorldMap, type WorldMap } from "./map";
import { blockedReachable, MAP_SIZE } from "./grid";

const data: GameData = gameData();
const world1 = data.worlds[0]!.map;

function distToPolyline(line: [number, number][], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) best = Math.min(best, distToSeg(x, y, ...line[i]!, ...line[i + 1]!));
  return best;
}

function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return len(x1 + t * dx - px, y1 + t * dy - py);
}

function forbidden(map: WorldMap, i: number): string | null {
  const x = map.islandX[i]!, y = map.islandY[i]!, r = map.islandR[i]!;
  const { clear, paths, feature, islands } = world1;
  const d = len(x, y);
  if (d < clear.castle + r) return "castle";
  if (d > clear.ringInner - r && d < clear.ringOuter + r) return "ring";
  for (const line of paths.lines) if (distToPolyline(line, x, y) < paths.width / 2 + clear.pathMargin + r) return "path";
  for (const s of feature.segments) if (distToSeg(x, y, ...s) < feature.thickness / 2 + clear.featureMargin + r) return "wall";
  for (let j = 0; j < map.islandCount; j++) {
    if (j === i) continue;
    if (len(map.islandX[j]! - x, map.islandY[j]! - y) < map.islandR[j]! + r + islands.gap) return "island";
  }
  if (Math.abs(x) + r > 3000 || Math.abs(y) + r > 3000) return "edge";
  return null;
}

describe("buildWorldMap", () => {
  it("places 30-40 islands outside every kept zone and keeps every free cell reachable on 200 seeds", () => {
    let inRange = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const map = buildWorldMap(data, 1, new Rng(seed));
      if (map.islandCount >= 30 && map.islandCount <= 40) inRange++;
      for (let i = 0; i < map.islandCount; i++) expect(forbidden(map, i), `seed ${seed} island ${i}`).toBeNull();
      const { free, reached } = blockedReachable(map);
      expect(reached, `seed ${seed}`).toBe(free);
      expect(isFree(map, data.rules.arena.heroStart.x, data.rules.arena.heroStart.y, 32)).toBe(true);
    }
    expect(inRange).toBeGreaterThanOrEqual(190);
  });

  it("the same seed and world give the same islands, another seed others", () => {
    const a = buildWorldMap(data, 1, new Rng(7));
    const b = buildWorldMap(data, 1, new Rng(7));
    expect(Array.from(a.islandX.subarray(0, a.islandCount))).toEqual(Array.from(b.islandX.subarray(0, b.islandCount)));
    const c = buildWorldMap(data, 1, new Rng(1));
    const d = buildWorldMap(data, 1, new Rng(2));
    expect(Array.from(c.islandX.subarray(0, 5))).not.toEqual(Array.from(d.islandX.subarray(0, 5)));
  });

  it("blocks the wall's cells and leaves the gates open", () => {
    const map = buildWorldMap(data, 1, new Rng(1));
    expect(map.blocked.length).toBe(MAP_SIZE * MAP_SIZE);
    expect(isFree(map, 0, 1500, 10)).toBe(false);
    expect(isFree(map, -625, 1500, 32)).toBe(true);
  });

  it("does not touch run.rng", () => {
    const empty = gameData();
    empty.worlds[0]!.map.islands.count = { min: 0, max: 0 };
    const a = createRun(gameData(), { seed: 3 });
    const b = createRun(empty, { seed: 3 });
    expect(a.map.islandCount).toBeGreaterThan(0);
    expect(b.map.islandCount).toBe(0);
    expect(a.rng.next()).toBe(b.rng.next());
  });

  it("a path speeds walking by its bonus on its axis only", () => {
    const map = buildWorldMap(data, 1, new Rng(1));
    expect(groundSpeedScale(map, 0, -1500)).toBeCloseTo(1.15, 9);
    expect(groundSpeedScale(map, 200, -1500)).toBe(1);
  });

  it("thicket slows walking inside a zone, a path wins over the thicket", () => {
    const map = buildWorldMap(data, 3, new Rng(1));
    expect(map.thicketSlow).toBeCloseTo(0.35, 9);
    expect(groundSpeedScale(map, 0, 900)).toBeCloseTo(0.65, 9);
    expect(groundSpeedScale(map, 1000, 1000)).toBeCloseTo(1.15, 9);
    expect(groundSpeedScale(map, 0, -600)).toBe(1);
    const one = buildWorldMap(data, 1, new Rng(1));
    expect(one.thicketSlow).toBe(0);
    for (const [x, y] of [[300, -1500], [1800, 0], [0, 900]] as const) expect(groundSpeedScale(one, x, y)).toBe(1);
  });

  it("inThicket", () => {
    const map = buildWorldMap(data, 3, new Rng(1));
    expect(inThicket(map, 1850, 0)).toBe(true);
    expect(inThicket(map, 1400, 0)).toBe(false);
    expect(inThicket(buildWorldMap(data, 1, new Rng(1)), 1850, 0)).toBe(false);
  });
});

function len(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}
