import type { Run } from "../run";
import { computeFlow, type FlowField } from "./flow";
import { cellOf } from "./grid";

/**
 * The hero field is recomputed when the hero changed cells, at most once in MIN_GAP steps (spec 4.6). The spec's
 * "every 8 steps" refresh is left out: the grid is static, so a field towards the same cell would come out the same.
 */
export const MIN_GAP = 2;

/**
 * The flow field towards the current player's hero (map.toHero for player 0, `run.heroFlows`), recomputed in place (no allocation) when it is due. Lazy: only an enemy that needs the field (behind the
 * wall from the hero) asks for it, so a step without one pays nothing.
 */
export function heroFlow(run: Run): FlowField {
  const field = run.heroFlows[run.current]!;
  const hero = run.hero;
  const age = run.tick - field.tick;
  if (age >= MIN_GAP && cellOf(hero.x, hero.y) !== field.targetCell) {
    computeFlow(run.map, field, hero.x, hero.y);
    field.tick = run.tick;
  }
  return field;
}
