import { segmentDistance } from "./geometry";
import { bfs, cellCenterX, cellCenterY, cellOf, MAP_SIZE } from "./grid";
import type { WorldMap } from "./map";

const CELLS = MAP_SIZE * MAP_SIZE;

/** A breadth-first distance field over the map's grid towards one target cell (fixed size, filled in place). */
export class FlowField {
  readonly dist = new Int32Array(CELLS);
  /** The cell one step closer to the target; -1 at the target and in cells it does not reach. */
  readonly next = new Int32Array(CELLS);
  targetCell = -1;
  /** Step of the last recomputation (the run's tick), for the recompute limits of the callers. */
  tick = -1_000_000;
}

/** Fills `field` towards (targetX, targetY): 8 neighbours, no corner cutting, the map's shared queue; no allocation. */
export function computeFlow(map: WorldMap, field: FlowField, targetX: number, targetY: number): void {
  field.targetCell = cellOf(targetX, targetY);
  bfs(map, field.targetCell, field.dist, field.next);
}

/** Result of flowDir (module fields: no allocation). Zero when (x, y) is in the target cell or reaches nothing. */
export let flowX = 0;
export let flowY = 0;

const NEIGHBOR_DC = [1, -1, 0, 0, 1, 1, -1, -1];
const NEIGHBOR_DR = [0, 0, 1, -1, 1, -1, 1, -1];

/**
 * A unit direction from (x, y) to the centre of the cell two steps further along `next`. A point in a blocked or
 * unreached cell (an obstacle's margin) starts from its reached neighbour nearest to the target.
 */
export function flowDir(field: FlowField, x: number, y: number): void {
  flowX = 0;
  flowY = 0;
  let cell = cellOf(x, y);
  if (field.dist[cell] < 0) {
    const col = cell % MAP_SIZE;
    const row = (cell - col) / MAP_SIZE;
    let best = -1;
    for (let k = 0; k < 8; k++) {
      const nc = col + NEIGHBOR_DC[k];
      const nr = row + NEIGHBOR_DR[k];
      if (nc < 0 || nr < 0 || nc >= MAP_SIZE || nr >= MAP_SIZE) continue;
      const n = nr * MAP_SIZE + nc;
      if (field.dist[n] >= 0 && (best < 0 || field.dist[n] < field.dist[best])) best = n;
    }
    if (best < 0) return;
    cell = best;
  } else {
    if (field.next[cell] < 0) return;
    cell = field.next[cell];
  }
  if (field.next[cell] >= 0) cell = field.next[cell];
  const dx = cellCenterX(cell) - x;
  const dy = cellCenterY(cell) - y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-6) return;
  flowX = dx / d;
  flowY = dy / d;
}

/** Does the segment (ax, ay)-(bx, by) grown by r touch a wall segment? Islands do not count. */
export function crossesFeature(map: WorldMap, ax: number, ay: number, bx: number, by: number, r: number): boolean {
  const need = map.segHalf + r;
  // the wall's bounding box first: most lines are nowhere near it
  if ((ax < bx ? ax : bx) > map.featMaxX + need || (ax > bx ? ax : bx) < map.featMinX - need ||
    (ay < by ? ay : by) > map.featMaxY + need || (ay > by ? ay : by) < map.featMinY - need) return false;
  for (let s = 0; s < map.segCount; s++) {
    if (segmentsDistance(ax, ay, bx, by, map.segX1[s], map.segY1[s], map.segX2[s], map.segY2[s]) < need) return true;
  }
  return false;
}

/** Does the segment (ax, ay)-(bx, by) grown by r touch an island? */
export function crossesIsland(map: WorldMap, ax: number, ay: number, bx: number, by: number, r: number): boolean {
  for (let i = 0; i < map.islandCount; i++) {
    if (segmentDistance(map.islandX[i], map.islandY[i], ax, ay, bx, by) < map.islandR[i] + r) return true;
  }
  return false;
}

function segmentsDistance(
  ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number,
): number {
  if (intersect(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
  return Math.min(
    segmentDistance(ax, ay, cx, cy, dx, dy), segmentDistance(bx, by, cx, cy, dx, dy),
    segmentDistance(cx, cy, ax, ay, bx, by), segmentDistance(dx, dy, ax, ay, bx, by),
  );
}

function intersect(
  ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number,
): boolean {
  const d1 = cross(cx, cy, dx, dy, ax, ay);
  const d2 = cross(cx, cy, dx, dy, bx, by);
  const d3 = cross(ax, ay, bx, by, cx, cy);
  const d4 = cross(ax, ay, bx, by, dx, dy);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function cross(ox: number, oy: number, ax: number, ay: number, px: number, py: number): number {
  return (ax - ox) * (py - oy) - (ay - oy) * (px - ox);
}
