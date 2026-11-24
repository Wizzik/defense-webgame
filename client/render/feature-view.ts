import type { WorldMap } from "../../sim";
import type { WorldInstance } from "./world-view";
import type { FeatureStyle } from "./world-look";

/** The wall is drawn in pieces of at most this many sim units. */
export const WALL_PIECE = 100;
/** Trees of the tree ring stand this far apart along a segment. */
export const TREE_STEP = 90;
/** Crystals of the ice ridge stand this far apart along a segment. */
export const RIDGE_STEP = 70;
/** Rubble stones lie at each free end of the broken wall. */
const RUBBLE = 3;
/** The golden angle: consecutive turns look unrelated without a random draw. */
const GOLDEN = 2.399963229728653;

/** Two free segment ends at most this far apart are the banks of a bridge. */
const BRIDGE_REACH = 450;

/**
 * The chokepoint feature of a map as instances (pure, deterministic), by the world's style:
 * - `wall`: the wall in pieces along its segments and a post at every segment end no other segment shares;
 * - `river`: a band of water per segment (`water`, scale = length / 100) and a `bridge` across every gap between two
 *   free ends at most BRIDGE_REACH apart (scale = gap + thickness, along the gap);
 * - `trees`: a tree every TREE_STEP along each segment (models `trees` in turn) and a low bank of roots per segment
 *   (`roots`, scale = length / 100);
 * - `ridge`: an ice `crystal` every RIDGE_STEP along each segment (scale 0.8-1.8 from its index, a little to either
 *   side) on a `ridge-base` per segment (scale = length / 100);
 * - `broken`: the wall's pieces, every third one `wall-low`, and RUBBLE stones (`rubble`) by every free segment end.
 */
export function featureInstances(map: WorldMap, style: FeatureStyle, trees: readonly string[]): WorldInstance[] {
  const out: WorldInstance[] = [];
  const thickness = map.segHalf * 2;
  let tree = 0;
  for (let s = 0; s < map.segCount; s++) {
    const x1 = map.segX1[s]!, y1 = map.segY1[s]!, x2 = map.segX2[s]!, y2 = map.segY2[s]!;
    const length = Math.hypot(x2 - x1, y2 - y1);
    const rotation = Math.atan2(y2 - y1, x2 - x1);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    if (style === "ridge") {
      out.push({ model: "ridge-base", x: mx, y: my, scale: length / 100, rotation });
      const n = Math.max(1, Math.ceil(length / RIDGE_STEP));
      const px = -(y2 - y1) / length, py = (x2 - x1) / length;
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const i = tree++;
        const side = (((i * 5) % 7) / 6 - 0.5) * map.segHalf * 0.6;
        out.push({
          model: "crystal", x: x1 + (x2 - x1) * t + px * side, y: y1 + (y2 - y1) * t + py * side,
          scale: 0.8 + ((i * 0.618034) % 1), rotation: (i * GOLDEN) % (2 * Math.PI),
        });
      }
    } else if (style === "broken") {
      const n = Math.ceil(length / WALL_PIECE);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const model = (tree++ % 3) === 2 ? "wall-low" : "wall";
        out.push({ model, x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, scale: length / n / WALL_PIECE, rotation });
      }
      const ux = (x2 - x1) / length, uy = (y2 - y1) / length;
      for (const [x, y, back] of [[x1, y1, 1], [x2, y2, -1]] as const) {
        if (sharedEnd(map, s, x, y)) continue;
        for (let k = 0; k < RUBBLE; k++) {
          const side = (k - 1) * map.segHalf * 1.4;
          const along = back * (20 + k * 25);
          out.push({ model: "rubble", x: x + ux * along - uy * side, y: y + uy * along + ux * side, scale: 40 + k * 12, rotation: rotation + k * GOLDEN });
        }
      }
    } else if (style === "wall") {
      const n = Math.ceil(length / WALL_PIECE);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        out.push({ model: "wall", x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, scale: length / n / WALL_PIECE, rotation });
      }
      for (const [x, y] of [[x1, y1], [x2, y2]] as const) {
        if (!sharedEnd(map, s, x, y)) out.push({ model: "gate-post", x, y, scale: 1, rotation });
      }
    } else if (style === "river") {
      out.push({ model: "water", x: mx, y: my, scale: length / 100, rotation });
    } else {
      out.push({ model: "roots", x: mx, y: my, scale: length / 100, rotation });
      const n = Math.max(1, Math.round(length / TREE_STEP));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const model = trees.length > 0 ? trees[tree % trees.length]! : "trees-a";
        tree++;
        out.push({ model, x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, scale: 1, rotation: (tree * 2.399963229728653) % (2 * Math.PI) });
      }
    }
  }
  if (style === "river") out.push(...bridges(map, thickness));
  return out;
}

/** A bridge over each gap: the pairs of free segment ends at most BRIDGE_REACH apart, each pair once. */
function bridges(map: WorldMap, thickness: number): WorldInstance[] {
  const ends: [number, number][] = [];
  for (let s = 0; s < map.segCount; s++) {
    const x1 = map.segX1[s]!, y1 = map.segY1[s]!, x2 = map.segX2[s]!, y2 = map.segY2[s]!;
    if (!sharedEnd(map, s, x1, y1)) ends.push([x1, y1]);
    if (!sharedEnd(map, s, x2, y2)) ends.push([x2, y2]);
  }
  const out: WorldInstance[] = [];
  const used = new Set<number>();
  for (let i = 0; i < ends.length; i++) {
    if (used.has(i)) continue;
    for (let j = i + 1; j < ends.length; j++) {
      if (used.has(j)) continue;
      const [ax, ay] = ends[i]!;
      const [bx, by] = ends[j]!;
      const gap = Math.hypot(bx - ax, by - ay);
      if (gap > BRIDGE_REACH) continue;
      used.add(i).add(j);
      out.push({ model: "bridge", x: (ax + bx) / 2, y: (ay + by) / 2, scale: gap + thickness, rotation: Math.atan2(by - ay, bx - ax) });
      break;
    }
  }
  return out;
}

function sharedEnd(map: WorldMap, own: number, x: number, y: number): boolean {
  for (let s = 0; s < map.segCount; s++) {
    if (s === own) continue;
    if ((map.segX1[s] === x && map.segY1[s] === y) || (map.segX2[s] === x && map.segY2[s] === y)) return true;
  }
  return false;
}
