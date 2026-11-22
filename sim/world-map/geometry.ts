import { cellCenterX, cellCenterY, cellCol, cellOf, cellRow, MAP_CELL, MAP_ORIGIN, MAP_SIZE } from "./grid";
import type { WorldMap } from "./map";

/** The result of pushOut and nearestFree (module fields, so the step does not allocate). */
export let pushX = 0;
export let pushY = 0;
/** The closest point of the last segmentDistance call. */
let closeX = 0;
let closeY = 0;

/** Distance of (px, py) from the segment (x1, y1)-(x2, y2); the closest point goes to closeX/closeY. */
export function segmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  closeX = x1 + t * dx;
  closeY = y1 + t * dy;
  const ex = px - closeX;
  const ey = py - closeY;
  return Math.sqrt(ex * ex + ey * ey);
}

/** Distance of (px, py) from a polyline of [x, y] points. */
export function polylineDistance(line: readonly (readonly [number, number])[], px: number, py: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const d = segmentDistance(px, py, a[0], a[1], b[0], b[1]);
    if (d < best) best = d;
  }
  return best;
}

/** Cells around (x, y) that may hold an obstacle touching a circle of radius r. */
function reach(r: number): number {
  const k = Math.ceil(r / MAP_CELL);
  return k < 1 ? 1 : k;
}

/** Does the circle (x, y, r) overlap no obstacle? */
export function isFree(map: WorldMap, x: number, y: number, r: number): boolean {
  const k = reach(r);
  if (k === 1 && map.near[cellOf(x, y)] === 0) return true;
  const c0 = cellCol(x);
  const r0 = cellRow(y);
  for (let row = r0 - k; row <= r0 + k; row++) {
    if (row < 0 || row >= MAP_SIZE) continue;
    for (let col = c0 - k; col <= c0 + k; col++) {
      if (col < 0 || col >= MAP_SIZE) continue;
      const cell = row * MAP_SIZE + col;
      for (let j = map.cellStart[cell]!; j < map.cellStart[cell + 1]!; j++) {
        const item = map.cellItems[j]!;
        if (item < map.segCount) {
          const d = segmentDistance(x, y, map.segX1[item]!, map.segY1[item]!, map.segX2[item]!, map.segY2[item]!);
          if (d < map.segHalf + r) return false;
        } else {
          const i = item - map.segCount;
          const dx = x - map.islandX[i]!;
          const dy = y - map.islandY[i]!;
          const need = map.islandR[i]! + r;
          if (dx * dx + dy * dy < need * need) return false;
        }
      }
    }
  }
  return true;
}

/**
 * Moves the circle (x, y, r) out of every obstacle listed in the cells around it, one after another (two passes, so
 * a push into a neighbour is undone). Out of a segment perpendicular to it, out of an island away from its centre
 * (+x when exactly at the centre). The result goes to pushX/pushY.
 */
export function pushOut(map: WorldMap, x: number, y: number, r: number): void {
  pushX = x;
  pushY = y;
  const k = reach(r);
  if (k === 1 && map.near[cellOf(x, y)] === 0) return;
  for (let pass = 0; pass < 2; pass++) {
    const c0 = cellCol(pushX);
    const r0 = cellRow(pushY);
    let moved = false;
    for (let row = r0 - k; row <= r0 + k; row++) {
      if (row < 0 || row >= MAP_SIZE) continue;
      for (let col = c0 - k; col <= c0 + k; col++) {
        if (col < 0 || col >= MAP_SIZE) continue;
        const cell = row * MAP_SIZE + col;
        for (let j = map.cellStart[cell]!; j < map.cellStart[cell + 1]!; j++) {
          if (pushFrom(map, map.cellItems[j]!, r)) moved = true;
        }
      }
    }
    if (!moved) return;
  }
}

function pushFrom(map: WorldMap, item: number, r: number): boolean {
  if (item < map.segCount) {
    const x1 = map.segX1[item]!, y1 = map.segY1[item]!, x2 = map.segX2[item]!, y2 = map.segY2[item]!;
    const d = segmentDistance(pushX, pushY, x1, y1, x2, y2);
    const need = map.segHalf + r;
    if (d >= need) return false;
    if (d > 1e-9) {
      const s = need / d;
      pushX = closeX + (pushX - closeX) * s;
      pushY = closeY + (pushY - closeY) * s;
    } else {
      // On the segment's axis: out along its left normal.
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      pushX = closeX + (-dy / len) * need;
      pushY = closeY + (dx / len) * need;
    }
    return true;
  }
  const i = item - map.segCount;
  const cx = map.islandX[i]!;
  const cy = map.islandY[i]!;
  const need = map.islandR[i]! + r;
  const dx = pushX - cx;
  const dy = pushY - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= need * need) return false;
  if (d2 > 1e-18) {
    const s = need / Math.sqrt(d2);
    pushX = cx + dx * s;
    pushY = cy + dy * s;
  } else {
    pushX = cx + need;
    pushY = cy;
  }
  return true;
}

/**
 * The nearest free place for a circle of radius r: pushOut (clamped into the grid) when that frees it, otherwise the free cell centres in
 * growing square rings around (x, y), the closest of the first ring that has one. Kept inside the grid. Result in
 * pushX/pushY.
 */
export function nearestFree(map: WorldMap, x: number, y: number, r: number): void {
  const limit = -MAP_ORIGIN - r;
  pushOut(map, x, y, r);
  pushX = pushX < -limit ? -limit : pushX > limit ? limit : pushX;
  pushY = pushY < -limit ? -limit : pushY > limit ? limit : pushY;
  if (isFree(map, pushX, pushY, r)) return;
  const start = cellOf(x, y);
  const c0 = start % MAP_SIZE;
  const r0 = (start - c0) / MAP_SIZE;
  for (let ring = 0; ring < MAP_SIZE; ring++) {
    let best = -1;
    let bestD = Infinity;
    for (let row = r0 - ring; row <= r0 + ring; row++) {
      if (row < 0 || row >= MAP_SIZE) continue;
      for (let col = c0 - ring; col <= c0 + ring; col++) {
        if (col < 0 || col >= MAP_SIZE) continue;
        if (Math.abs(row - r0) !== ring && Math.abs(col - c0) !== ring) continue;
        const cell = row * MAP_SIZE + col;
        const cx = cellCenterX(cell);
        const cy = cellCenterY(cell);
        if (Math.abs(cx) > limit || Math.abs(cy) > limit || !isFree(map, cx, cy, r)) continue;
        const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
        if (d < bestD) {
          bestD = d;
          best = cell;
        }
      }
    }
    if (best >= 0) {
      pushX = cellCenterX(best);
      pushY = cellCenterY(best);
      return;
    }
  }
  pushX = x;
  pushY = y;
}

/** Index of the path-mask cell under (x, y), or -1 outside the grid. */
function pathIndex(x: number, y: number): number {
  const col = Math.floor((x - MAP_ORIGIN) / PATH_CELL);
  const row = Math.floor((y - MAP_ORIGIN) / PATH_CELL);
  if (col < 0 || row < 0 || col >= PATH_SIZE || row >= PATH_SIZE) return -1;
  return row * PATH_SIZE + col;
}

/** Walking speed of the ground at (x, y): 1 + pathBonus on a path (a path wins), 1 - thicketSlow in a thicket, else 1. */
export function groundSpeedScale(map: WorldMap, x: number, y: number): number {
  const i = pathIndex(x, y);
  if (i < 0) return 1;
  if (map.onPath[i] === 1) return 1 + map.pathBonus;
  return map.thicket[i] === 1 ? 1 - map.thicketSlow : 1;
}

/** Does (x, y) lie in a zone of the world's thicket? */
export function inThicket(map: WorldMap, x: number, y: number): boolean {
  const i = pathIndex(x, y);
  return i >= 0 && map.thicket[i] === 1;
}

/** The path mask is finer than the obstacle grid. */
export const PATH_CELL = 50;
export const PATH_SIZE = (MAP_SIZE * MAP_CELL) / PATH_CELL;
