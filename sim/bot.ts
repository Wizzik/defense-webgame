import type { TickInput } from "./input";
import type { Run } from "./run";

const HOME_OFFSET = 700;
const HOME_TOLERANCE = 100;
const CHASE_DISTANCE = 450;
const RETREAT_DISTANCE = 180;
const AXIS_DEADZONE = 30;
/** A ranged hero walks up to an enemy nearer than this that its base attack does not reach. */
export const RANGED_CHASE_DISTANCE = 800;
/** The bot never stays farther than this from the castle post; beyond it, it walks back whatever the enemies do. */
export const LEASH_DISTANCE = 800;

/** The fixed autopilot rules. Writes the input into `out` and returns it; allocates nothing. */
export function botInput(run: Run, out: TickInput): TickInput {
  out.moveX = 0;
  out.moveY = 0;
  out.card = -1;
  out.actions = 0;
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

  const melee = run.data.heroes[run.heroIndex].baseAttack.kind === "melee";
  const homeX = castle.x - hero.x;
  const homeY = castle.y + HOME_OFFSET - hero.y;
  const homeDist = Math.sqrt(homeX * homeX + homeY * homeY);

  let dx = 0;
  let dy = 0;
  if (best < 0 || homeDist > LEASH_DISTANCE) {
    dx = homeX;
    dy = homeY;
    if (homeDist <= HOME_TOLERANCE) {
      dx = 0;
      dy = 0;
    }
  } else {
    const d = Math.sqrt(bestSq);
    const tx = enemies.x[best] - hero.x;
    const ty = enemies.y[best] - hero.y;
    if (d < RETREAT_DISTANCE) {
      dx = -tx;
      dy = -ty;
    } else if (melee) {
      if (d > CHASE_DISTANCE) {
        dx = tx;
        dy = ty;
      }
    } else if (d > run.data.heroes[run.heroIndex].baseAttack.range && d < RANGED_CHASE_DISTANCE) {
      // A ranged hero steps up to an enemy that stands just out of its reach (a shooter), within the leash.
      dx = tx;
      dy = ty;
    } else if (d >= RANGED_CHASE_DISTANCE && homeDist > HOME_TOLERANCE) {
      // Otherwise it holds the post.
      dx = homeX;
      dy = homeY;
    }
  }
  out.moveX = Math.abs(dx) > AXIS_DEADZONE ? Math.sign(dx) : 0;
  out.moveY = Math.abs(dy) > AXIS_DEADZONE ? Math.sign(dy) : 0;
  return out;
}
