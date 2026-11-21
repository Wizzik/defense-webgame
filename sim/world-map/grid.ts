import type { WorldMap } from "./map";

/** The static grid of a world map: MAP_SIZE x MAP_SIZE cells of MAP_CELL, covering -3000..3000 on both axes. */
export const MAP_CELL = 100;
export const MAP_SIZE = 60;
export const MAP_ORIGIN = -(MAP_SIZE * MAP_CELL) / 2;
/** A cell is blocked when its centre lies within an obstacle grown by this (about a hero's collision plus a little). */
export const PASS_MARGIN = 36;

/** Index of the cell under (x, y), clamped to the grid. */
export function cellOf(x: number, y: number): number {
  return cellRow(y) * MAP_SIZE + cellCol(x);
}

export function cellCol(x: number): number {
  const c = Math.floor((x - MAP_ORIGIN) / MAP_CELL);
  return c < 0 ? 0 : c >= MAP_SIZE ? MAP_SIZE - 1 : c;
}

export function cellRow(y: number): number {
  const r = Math.floor((y - MAP_ORIGIN) / MAP_CELL);
  return r < 0 ? 0 : r >= MAP_SIZE ? MAP_SIZE - 1 : r;
}

export function cellCenterX(cell: number): number {
  return MAP_ORIGIN + ((cell % MAP_SIZE) + 0.5) * MAP_CELL;
}

export function cellCenterY(cell: number): number {
  return MAP_ORIGIN + (Math.floor(cell / MAP_SIZE) + 0.5) * MAP_CELL;
}

const NEIGHBOR_DC = [1, -1, 0, 0, 1, 1, -1, -1];
const NEIGHBOR_DR = [0, 0, 1, -1, 1, -1, 1, -1];

/**
 * Breadth-first walk over free cells from `start` with 8 neighbours and no corner cutting (a diagonal step needs
 * both orthogonal cells free). Writes the step count into `dist` (-1 = not reached) and, when `next` is given, the
 * cell one step closer to `start`. Uses the map's shared queue; does not allocate.
 */
export function bfs(map: WorldMap, start: number, dist: Int32Array, next: Int32Array | null): number {
  const { blocked, queue } = map;
  dist.fill(-1);
  if (next !== null) next.fill(-1);
  if (blocked[start] === 1) return 0;
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  dist[start] = 0;
  while (head < tail) {
    const cell = queue[head++]!;
    const col = cell % MAP_SIZE;
    const row = (cell - col) / MAP_SIZE;
    for (let k = 0; k < 8; k++) {
      const nc = col + NEIGHBOR_DC[k]!;
      const nr = row + NEIGHBOR_DR[k]!;
      if (nc < 0 || nr < 0 || nc >= MAP_SIZE || nr >= MAP_SIZE) continue;
      const n = nr * MAP_SIZE + nc;
      if (dist[n] !== -1 || blocked[n] === 1) continue;
      if (k >= 4 && (blocked[row * MAP_SIZE + nc] === 1 || blocked[nr * MAP_SIZE + col] === 1)) continue;
      dist[n] = dist[cell]! + 1;
      if (next !== null) next[n] = cell;
      queue[tail++] = n;
    }
  }
  return tail;
}

/** Free cells and the free cells reached from the castle's cell (spec 4.9: every free cell leads to the castle). */
export function blockedReachable(map: WorldMap): { free: number; reached: number } {
  let free = 0;
  for (let i = 0; i < map.blocked.length; i++) if (map.blocked[i] === 0) free++;
  const reached = bfs(map, cellOf(map.castleX, map.castleY), map.scratchDist, null);
  return { free, reached };
}
