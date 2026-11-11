import { Charge } from "./enemy-charge";
import { InputAction } from "./input";
import type { TickInput } from "./input";
import type { Run } from "./run";

/** An enemy nearer to the castle than this is a threat: the bot goes for the threat nearest to the castle. */
export const DEFEND_RADIUS = 1400;
/** With no threat and nobody near, the bot stands at (castle.x, castle.y + HOME_OFFSET). */
export const HOME_OFFSET = 400;
const HOME_TOLERANCE = 100;
/** With no threat the bot fights the enemy nearest to the hero within this distance. */
export const CHASE_DISTANCE = 400;
/** Farther than this from its post the bot walks back, whatever the enemies do (a retreat must not end in the spawn ring). */
export const LEASH_DISTANCE = 2150;
/** A ranged hero backs off from an enemy nearer than this. */
const RETREAT_DISTANCE = 180;
/** A melee hero walks up to this distance from its target; a ranged hero up to its attack range minus this. */
const MELEE_STOP = 150;
const RANGED_MARGIN = 50;
/** A charge winding up nearer than this makes the bot step out of its line. */
const DODGE_DISTANCE = 700;
/** Below this share of its hp the hero keeps this far from every enemy, as a careful player would. */
const LOW_HP = 0.3;
const LOW_HP_DISTANCE = 350;
const AXIS_DEADZONE = 30;
/** Share of a unit vector under which an axis is not pressed (between sin 22.5° and cos 67.5°). */
const AXIS_SHARE = 0.38;

/** The fixed autopilot rules. Writes the input into `out` and returns it; allocates nothing. */
export function botInput(run: Run, out: TickInput): TickInput {
  out.moveX = 0;
  out.moveY = 0;
  out.card = -1;
  out.actions = 0;
  if (run.state === "levelUp") {
    // As a player would: a spell before an attribute. The first spell card of the offer, else the first card.
    out.card = 0;
    const cards = run.offer?.cards;
    if (cards) {
      for (let c = 0; c < cards.length; c++) {
        if (cards[c].kind === "ability") {
          out.card = c;
          break;
        }
      }
    }
    return out;
  }
  const { hero, castle, enemies } = run;

  // One pass: the threat nearest to the castle, the enemy nearest to the hero, the nearest charge winding up.
  let threat = -1;
  let threatSq = DEFEND_RADIUS * DEFEND_RADIUS;
  let near = -1;
  let nearSq = Infinity;
  let charger = -1;
  let chargerSq = DODGE_DISTANCE * DODGE_DISTANCE;
  for (let i = 0; i < enemies.capacity; i++) {
    if (enemies.alive[i] === 0) continue;
    const cx = enemies.x[i] - castle.x;
    const cy = enemies.y[i] - castle.y;
    const castleSq = cx * cx + cy * cy;
    if (castleSq < threatSq) {
      threatSq = castleSq;
      threat = i;
    }
    const hx = enemies.x[i] - hero.x;
    const hy = enemies.y[i] - hero.y;
    const heroSq = hx * hx + hy * hy;
    if (heroSq < nearSq) {
      nearSq = heroSq;
      near = i;
    }
    if (enemies.chargeState[i] === Charge.Windup && heroSq < chargerSq) {
      chargerSq = heroSq;
      charger = i;
    }
  }

  if (charger >= 0) {
    // Step out of the line of the charge: perpendicular to the direction from the charger to the hero.
    const d = Math.sqrt(chargerSq);
    const ux = d > 1e-6 ? (hero.x - enemies.x[charger]) / d : 1;
    const uy = d > 1e-6 ? (hero.y - enemies.y[charger]) / d : 0;
    out.moveX = axis(-uy);
    out.moveY = axis(ux);
    if (hero.dashCooldown === 0 && hero.dashTicks === 0) out.actions |= InputAction.Dash;
    return out;
  }

  const def = run.data.heroes[run.heroIndex];
  const melee = def.baseAttack.kind === "melee";
  let dx = 0;
  let dy = 0;
  const postX = castle.x - hero.x;
  const postY = castle.y + HOME_OFFSET - hero.y;
  if (postX * postX + postY * postY > LEASH_DISTANCE * LEASH_DISTANCE) {
    // Too far from the castle (a long retreat): walk back, whatever the enemies do.
    out.moveX = Math.abs(postX) > AXIS_DEADZONE ? Math.sign(postX) : 0;
    out.moveY = Math.abs(postY) > AXIS_DEADZONE ? Math.sign(postY) : 0;
    return out;
  }
  const nearDist = Math.sqrt(nearSq);
  const keep = hero.hp < hero.stats.maxHp * LOW_HP ? LOW_HP_DISTANCE : melee ? 0 : RETREAT_DISTANCE;
  if (near >= 0 && nearDist < keep) {
    dx = hero.x - enemies.x[near];
    dy = hero.y - enemies.y[near];
  } else {
    const target = threat >= 0 ? threat : near >= 0 && nearDist <= CHASE_DISTANCE ? near : -1;
    if (target >= 0) {
      const tx = enemies.x[target] - hero.x;
      const ty = enemies.y[target] - hero.y;
      const d = Math.sqrt(tx * tx + ty * ty);
      const stop = melee ? MELEE_STOP : def.baseAttack.range - RANGED_MARGIN;
      if (d > stop) {
        dx = tx;
        dy = ty;
      }
    } else {
      const homeX = castle.x - hero.x;
      const homeY = castle.y + HOME_OFFSET - hero.y;
      if (Math.sqrt(homeX * homeX + homeY * homeY) > HOME_TOLERANCE) {
        dx = homeX;
        dy = homeY;
      }
    }
  }
  if (near >= 0) {
    // A line spell flies where the hero walks, or at the nearest enemy when it stands: stand still to aim it.
    for (let s = 0; s < run.abilities.length; s++) {
      const slot = run.abilities[s];
      if (slot.level < 1 || slot.cooldown > 1 || slot.active || slot.def.kind !== "line") continue;
      if (nearDist <= slot.def.params.length[slot.level - 1]) return out;
    }
  }
  out.moveX = Math.abs(dx) > AXIS_DEADZONE ? Math.sign(dx) : 0;
  out.moveY = Math.abs(dy) > AXIS_DEADZONE ? Math.sign(dy) : 0;
  return out;
}

/** -1, 0 or 1 for a component of a unit vector. */
function axis(share: number): number {
  return share > AXIS_SHARE ? 1 : share < -AXIS_SHARE ? -1 : 0;
}
