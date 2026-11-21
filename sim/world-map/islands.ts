import type { WorldMap as WorldMapDef } from "../../data/schema";
import type { Rng } from "../rng";
import { polylineDistance, segmentDistance } from "./geometry";
import { blockedReachable } from "./grid";
import { addIsland, IslandKind, removeLastIsland, type WorldMap } from "./map";

/** Tries per island before it is left out. */
const TRIES = 40;

/**
 * Scatters the world's islands from the run's mapRng (spec 4.5): count, centre, radius and kind uniformly / by
 * weight; a place in a kept zone (castle, arrival ring, paths, wall, another island, the arena edge) or one that cuts
 * a free cell off from the castle is a failed try.
 */
export function placeIslands(map: WorldMap, def: WorldMapDef, rng: Rng): void {
  const { count, radius, gap, kinds } = def.islands;
  const wanted = count.min + Math.floor(rng.next() * (count.max - count.min + 1));
  const weights = kinds.rock + kinds.trees + kinds.ruin;
  for (let n = 0; n < wanted; n++) {
    for (let t = 0; t < TRIES; t++) {
      const x = (rng.next() * 2 - 1) * map.arenaHalf;
      const y = (rng.next() * 2 - 1) * map.arenaHalf;
      const r = radius.min + rng.next() * (radius.max - radius.min);
      const w = rng.next() * weights;
      const kind = w < kinds.rock ? IslandKind.Rock : w < kinds.rock + kinds.trees ? IslandKind.Trees : IslandKind.Ruin;
      if (!allowed(map, def, x, y, r, gap)) continue;
      addIsland(map, x, y, r, kind);
      const { free, reached } = blockedReachable(map);
      if (reached === free) break;
      removeLastIsland(map);
    }
  }
}

function allowed(map: WorldMap, def: WorldMapDef, x: number, y: number, r: number, gap: number): boolean {
  const { clear, paths, feature } = def;
  if (Math.abs(x) + r > map.arenaHalf || Math.abs(y) + r > map.arenaHalf) return false;
  const dx = x - map.castleX;
  const dy = y - map.castleY;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < clear.castle + r) return false;
  if (d > clear.ringInner - r && d < clear.ringOuter + r) return false;
  for (const line of paths.lines) if (polylineDistance(line, x, y) < paths.width / 2 + clear.pathMargin + r) return false;
  for (const s of feature.segments) {
    if (segmentDistance(x, y, s[0], s[1], s[2], s[3]) < feature.thickness / 2 + clear.featureMargin + r) return false;
  }
  for (let j = 0; j < map.islandCount; j++) {
    const ex = map.islandX[j]! - x;
    const ey = map.islandY[j]! - y;
    const need = map.islandR[j]! + r + gap;
    if (ex * ex + ey * ey < need * need) return false;
  }
  return true;
}
