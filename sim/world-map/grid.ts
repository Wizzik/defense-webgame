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
const NEIGHBOR_OFFSET = Int32Array.from(NEIGHBOR_DC, (dc, k) => NEIGHBOR_DR[k]! * MAP_SIZE + dc);

/**
 * Recomputes the move masks of the cells col0..col1 x row0..row1: bit k = the step to neighbour k (8 neighbours) is
 * allowed: inside the grid, onto a free cell, and a diagonal only when both orthogonal cells are free (no corner
 * cutting). A blocked cell may still step out, so a target in an obstacle's margin spreads to its free neighbours.
 */
export function updateMoves(map: WorldMap, col0: number, col1: number, row0: number, row1: number): void {
  const { blocked, moves } = map;
  for (let row = Math.max(0, row0); row <= Math.min(MAP_SIZE - 1, row1); row++) {
    for (let col = Math.max(0, col0); col <= Math.min(MAP_SIZE - 1, col1); col++) {
      let mask = 0;
      for (let k = 0; k < 8; k++) {
        const nc = col + NEIGHBOR_DC[k]!;
        const nr = row + NEIGHBOR_DR[k]!;
        if (nc < 0 || nr < 0 || nc >= MAP_SIZE || nr >= MAP_SIZE) continue;
        if (blocked[nr * MAP_SIZE + nc] === 1) continue;
        if (k >= 4 && (blocked[row * MAP_SIZE + nc] === 1 || blocked[nr * MAP_SIZE + col] === 1)) continue;
        mask |= 1 << k;
      }
      moves[row * MAP_SIZE + col] = mask;
    }
  }
}

/**
 * Breadth-first walk over free cells from `start` along the move masks (8 neighbours, no corner cutting). Writes the
 * step count into `dist` (-1 = not reached) and, when `next` is given, the cell one step closer to `start`. Returns
 * the cells reached. Uses the map's shared queue; does not allocate.
 */
export function bfs(map: WorldMap, start: number, dist: Int32Array, next: Int32Array | null): number {
  const { moves, queue } = map;
  dist.fill(-1);
  if (next !== null) next.fill(-1);
  // A blocked start (a target in an obstacle's margin) still spreads to its free neighbours.
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  dist[start] = 0;
  while (head < tail) {
    const cell = queue[head++]!;
    const mask = moves[cell]!;
    if (mask === 0) continue;
    const d = dist[cell]! + 1;
    for (let k = 0; k < 8; k++) {
      if ((mask & (1 << k)) === 0) continue;
      const n = cell + NEIGHBOR_OFFSET[k]!;
      if (dist[n] !== -1) continue;
      dist[n] = d;
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
  bfs(map, cellOf(map.castleX, map.castleY), map.scratchDist, null);
  let reached = 0;
  for (let i = 0; i < map.blocked.length; i++) if (map.blocked[i] === 0 && map.scratchDist[i] >= 0) reached++;
  return { free, reached };
}
