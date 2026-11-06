import type { TickInput } from "./input";
import type { Run } from "./run";

const HOME_OFFSET = 700;
const HOME_TOLERANCE = 100;
const CHASE_DISTANCE = 450;
const RETREAT_DISTANCE = 180;
const AXIS_DEADZONE = 30;

/** The fixed autopilot rules. Writes the input into `out` and returns it; allocates nothing. */
export function botInput(run: Run, out: TickInput): TickInput {
  out.moveX = 0;
  out.moveY = 0;
  out.card = -1;
  if (run.state === "levelUp") {
    out.card = 0;
    return out;
  }
  const { hero, castle, enemies } = run;

  let best = -1;
  let bestSq = Infinity;
  for (let i = 0; i < enemies.capacity; i++) {
    if (enemies.alive[i] === 0) continue;
    const dx = enemies.x[i] - hero.x;
    const dy = enemies.y[i] - hero.y;
    const sq = dx * dx + dy * dy;
    if (sq < bestSq) {
      bestSq = sq;
      best = i;
    }
  }

  let dx = 0;
  let dy = 0;
  if (best < 0) {
    dx = castle.x - hero.x;
    dy = castle.y + HOME_OFFSET - hero.y;
    if (Math.sqrt(dx * dx + dy * dy) <= HOME_TOLERANCE) {
      dx = 0;
      dy = 0;
    }
  } else {
    const d = Math.sqrt(bestSq);
    const tx = enemies.x[best] - hero.x;
    const ty = enemies.y[best] - hero.y;
    if (d > CHASE_DISTANCE) {
      dx = tx;
      dy = ty;
    } else if (d < RETREAT_DISTANCE) {
      dx = -tx;
      dy = -ty;
    }
  }
  out.moveX = Math.abs(dx) > AXIS_DEADZONE ? Math.sign(dx) : 0;
  out.moveY = Math.abs(dy) > AXIS_DEADZONE ? Math.sign(dy) : 0;
  return out;
}
