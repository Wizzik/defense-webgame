import type { GameData } from "../../data/schema";
import type { Rng } from "../rng";
import { isFree, PATH_CELL, PATH_SIZE, segmentDistance } from "./geometry";
import { cellCenterX, cellCenterY, cellCol, cellRow, MAP_ORIGIN, MAP_SIZE, PASS_MARGIN } from "./grid";
import { placeIslands } from "./islands";

export { MAP_CELL, MAP_SIZE } from "./grid";

export const IslandKind = { Rock: 0, Trees: 1, Ruin: 2 } as const;
export type IslandKind = (typeof IslandKind)[keyof typeof IslandKind];

const CELLS = MAP_SIZE * MAP_SIZE;

/**
 * The obstacles of one run (spec 2026-11-21 difficulties 4.5, 4.6): the world's fixed wall segments (thick lines) and
 * the islands placed from the run seed (circles), with the static grid the collisions and flow fields read. Built once
 * when the run is created (allocates); the step only reads it.
 */
export class WorldMap {
  readonly segX1: Float64Array;
  readonly segY1: Float64Array;
  readonly segX2: Float64Array;
  readonly segY2: Float64Array;
  /** Half the wall thickness. */
  readonly segHalf: number;
  readonly segCount: number;
  readonly islandX: Float64Array;
  readonly islandY: Float64Array;
  readonly islandR: Float64Array;
  readonly islandKind: Uint8Array;
  islandCount = 0;
  /** MAP_SIZE²; 1 = the cell's centre lies within an obstacle grown by PASS_MARGIN. */
  readonly blocked = new Uint8Array(CELLS);
  /** Obstacles touching each cell (CSR): items cellStart[c]..cellStart[c + 1] - 1; index < segCount = a segment. */
  readonly cellStart = new Int32Array(CELLS + 1);
  cellItems: Int32Array = new Int32Array(0);
  /** PATH_SIZE² (cells of PATH_CELL): 1 = the centre lies within half the path width of a path. */
  readonly onPath = new Uint8Array(PATH_SIZE * PATH_SIZE);
  readonly pathBonus: number;
  readonly castleX: number;
  readonly castleY: number;
  /** Half the arena's side: islands stay inside it. */
  readonly arenaHalf: number;
  /** The shared BFS queue and a scratch distance field (no allocation in the step). */
  readonly queue = new Int32Array(CELLS);
  readonly scratchDist = new Int32Array(CELLS);

  constructor(data: GameData, world: number) {
    const def = data.worlds[world - 1];
    if (def === undefined) throw new Error(`WorldMap: no world ${world}`);
    const { feature, paths, islands } = def.map;
    const n = feature.segments.length;
    this.segX1 = Float64Array.from(feature.segments, (s) => s[0]);
    this.segY1 = Float64Array.from(feature.segments, (s) => s[1]);
    this.segX2 = Float64Array.from(feature.segments, (s) => s[2]);
    this.segY2 = Float64Array.from(feature.segments, (s) => s[3]);
    this.segHalf = feature.thickness / 2;
    this.segCount = n;
    const capacity = Math.max(1, islands.count.max);
    this.islandX = new Float64Array(capacity);
    this.islandY = new Float64Array(capacity);
    this.islandR = new Float64Array(capacity);
    this.islandKind = new Uint8Array(capacity);
    this.pathBonus = paths.speedBonus;
    this.castleX = data.rules.arena.castle.x;
    this.castleY = data.rules.arena.castle.y;
    this.arenaHalf = Math.min(data.rules.arena.width, data.rules.arena.height) / 2;
    const half = paths.width / 2;
    for (const line of paths.lines) {
      for (let k = 0; k + 1 < line.length; k++) {
        const [ax, ay] = line[k]!;
        const [bx, by] = line[k + 1]!;
        const col0 = pathCell(Math.min(ax, bx) - half);
        const col1 = pathCell(Math.max(ax, bx) + half);
        const row0 = pathCell(Math.min(ay, by) - half);
        const row1 = pathCell(Math.max(ay, by) + half);
        for (let row = row0; row <= row1; row++) {
          for (let col = col0; col <= col1; col++) {
            const x = MAP_ORIGIN + (col + 0.5) * PATH_CELL;
            const y = MAP_ORIGIN + (row + 0.5) * PATH_CELL;
            if (segmentDistance(x, y, ax, ay, bx, by) <= half) this.onPath[row * PATH_SIZE + col] = 1;
          }
        }
      }
    }
    reindex(this);
    markBlocked(this, 0, MAP_SIZE - 1, 0, MAP_SIZE - 1);
  }
}

/** Builds the map of `world` for a run; the islands draw only from `rng` (the run's mapRng). */
export function buildWorldMap(data: GameData, world: number, rng: Rng): WorldMap {
  const map = new WorldMap(data, world);
  placeIslands(map, data.worlds[world - 1]!.map, rng);
  return map;
}

/** Adds an island, rebuilds the cell lists and the blocked mask around it (construction and tests only: allocates). */
export function placeIsland(map: WorldMap, x: number, y: number, r: number, kind: IslandKind): void {
  const i = map.islandCount;
  if (i >= map.islandX.length) throw new Error("placeIsland: island capacity full");
  map.islandX[i] = x;
  map.islandY[i] = y;
  map.islandR[i] = r;
  map.islandKind[i] = kind;
  map.islandCount = i + 1;
  reindex(map);
  markIslandCells(map, i);
}

/** Drops the last island again (a failed passability check). */
export function removeLastIsland(map: WorldMap): void {
  map.islandCount--;
  reindex(map);
  markIslandCells(map, map.islandCount);
}

/** Recomputes the blocked mask under island i's slot (its bounding box grown by PASS_MARGIN). */
function markIslandCells(map: WorldMap, i: number): void {
  const r = map.islandR[i]! + PASS_MARGIN;
  const x = map.islandX[i]!;
  const y = map.islandY[i]!;
  markBlocked(map, cellCol(x - r), cellCol(x + r), cellRow(y - r), cellRow(y + r));
}

function markBlocked(map: WorldMap, col0: number, col1: number, row0: number, row1: number): void {
  for (let row = row0; row <= row1; row++) {
    for (let col = col0; col <= col1; col++) {
      const c = row * MAP_SIZE + col;
      map.blocked[c] = isFree(map, cellCenterX(c), cellCenterY(c), PASS_MARGIN) ? 0 : 1;
    }
  }
}

/** Rebuilds the CSR cell lists: every cell an obstacle's bounding box touches. */
function reindex(map: WorldMap): void {
  const counts = map.cellStart;
  counts.fill(0);
  const total = map.segCount + map.islandCount;
  forEachCell(map, total, (cell) => {
    counts[cell + 1]!++;
  });
  for (let c = 0; c < CELLS; c++) counts[c + 1]! += counts[c]!;
  const items = new Int32Array(counts[CELLS]!);
  const fill = counts.slice(0, CELLS);
  forEachCell(map, total, (cell, item) => {
    items[fill[cell]!++] = item;
  });
  map.cellItems = items;
}

function forEachCell(map: WorldMap, total: number, visit: (cell: number, item: number) => void): void {
  for (let item = 0; item < total; item++) {
    let minX: number, maxX: number, minY: number, maxY: number;
    if (item < map.segCount) {
      const h = map.segHalf;
      minX = Math.min(map.segX1[item]!, map.segX2[item]!) - h;
      maxX = Math.max(map.segX1[item]!, map.segX2[item]!) + h;
      minY = Math.min(map.segY1[item]!, map.segY2[item]!) - h;
      maxY = Math.max(map.segY1[item]!, map.segY2[item]!) + h;
    } else {
      const i = item - map.segCount;
      const r = map.islandR[i]!;
      minX = map.islandX[i]! - r;
      maxX = map.islandX[i]! + r;
      minY = map.islandY[i]! - r;
      maxY = map.islandY[i]! + r;
    }
    const c1 = cellCol(maxX);
    const r1 = cellRow(maxY);
    for (let row = cellRow(minY); row <= r1; row++) {
      for (let col = cellCol(minX); col <= c1; col++) visit(row * MAP_SIZE + col, item);
    }
  }
}


function pathCell(v: number): number {
  const c = Math.floor((v - MAP_ORIGIN) / PATH_CELL);
  return c < 0 ? 0 : c >= PATH_SIZE ? PATH_SIZE - 1 : c;
}
