import type { Rules } from "../../data/schema";
import { Rng } from "../../sim";

/** One tree or rock: sim coordinates, `turn` quarter turns (0-3) around the vertical axis. */
export interface PropPlacement {
  model: number;
  x: number;
  y: number;
  scale: number;
  turn: number;
}

const CELL = 230;
/** The grid covers the arena square plus this much on every side. */
const REACH = 900;
/** Props start this far outside the spawn ring, so none stands where enemies walk (the sim has no obstacles). */
const GAP = 250;
const FILL = 0.6;
const JITTER = 80;
const SCALE_MIN = 0.9;
const SCALE_MAX = 1.4;

/**
 * Scatters `models` kinds of props on a jittered grid around the arena, outside the spawn ring.
 * Deterministic for a seed; sim coordinates.
 */
export function layoutProps(rules: Rules, models: number, seed: number): PropPlacement[] {
  const { arena } = rules;
  const rng = new Rng(seed);
  const halfX = arena.width / 2 + REACH;
  const halfY = arena.height / 2 + REACH;
  const columns = Math.ceil((2 * halfX) / CELL);
  const rows = Math.ceil((2 * halfY) / CELL);
  const minDistance = arena.spawn.radius + GAP;
  const placements: PropPlacement[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const cellX = arena.castle.x - halfX + (column + 0.5) * CELL;
      const cellY = arena.castle.y - halfY + (row + 0.5) * CELL;
      const roll = rng.next();
      // the rolls below are drawn for every cell, so a change of the fill does not reshuffle the rest
      const model = rng.int(models);
      const angle = rng.next() * 2 * Math.PI;
      const radius = Math.sqrt(rng.next()) * JITTER;
      const scale = SCALE_MIN + rng.next() * (SCALE_MAX - SCALE_MIN);
      const turn = rng.int(4);
      if (Math.hypot(cellX - arena.castle.x, cellY - arena.castle.y) <= minDistance || roll >= FILL) continue;
      // the shift is a point of a disc, so it never moves a prop more than JITTER toward the castle
      placements.push({
        model,
        x: cellX + Math.cos(angle) * radius,
        y: cellY + Math.sin(angle) * radius,
        scale,
        turn,
      });
    }
  }
  return placements;
}
