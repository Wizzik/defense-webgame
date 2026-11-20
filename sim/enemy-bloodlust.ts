import { TICKS_PER_SECOND } from "./constants";
import { EventKind } from "./events";
import type { Run } from "./run";

let candidates = new Int32Array(0);

/**
 * Bloodlust (spec 2026-11-20, 4.2). Runs the timers of every lusted enemy, then lets every caster whose cooldown is
 * over (and that is not stunned) lust up to `targets` living enemies of its faction within `range`: no boss, not
 * itself, none that is lusted already, the nearest first. Without a target the cooldown does not start.
 * Called in updateEnemies after the auras (the grid holds the positions from the start of the step). Does not allocate.
 */
export function updateBloodlust(run: Run): void {
  const { enemies: e, grid } = run;
  const defs = run.data.enemies;
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 1 && e.bloodlustTicks[i] > 0) e.bloodlustTicks[i]--;
  }
  if (candidates.length < e.capacity) candidates = new Int32Array(e.capacity);
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0) continue;
    const type = e.type[i];
    const lust = defs[type].bloodlust;
    if (lust === undefined) continue;
    if (e.bloodlustCooldown[i] > 0) e.bloodlustCooldown[i]--;
    if (e.bloodlustCooldown[i] > 0 || e.stunTicks[i] > 0) continue;
    const faction = defs[type].faction;
    const found = grid.query(e.x[i], e.y[i], lust.range, candidates);
    const ticks = Math.round(lust.seconds * TICKS_PER_SECOND);
    let given = 0;
    while (given < lust.targets) {
      let best = -1;
      let bestD2 = lust.range * lust.range;
      for (let k = 0; k < found; k++) {
        const j = candidates[k];
        if (j === i || e.alive[j] === 0 || e.bloodlustTicks[j] > 0 || run.isBoss[e.type[j]] === 1) continue;
        if (defs[e.type[j]].faction !== faction) continue;
        const dx = e.x[j] - e.x[i];
        const dy = e.y[j] - e.y[i];
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2 || (d2 === bestD2 && best >= 0 && j < best)) {
          best = j;
          bestD2 = d2;
        }
      }
      if (best < 0) break;
      e.bloodlustTicks[best] = ticks;
      e.bloodlustType[best] = type;
      given++;
    }
    if (given === 0) continue;
    e.bloodlustCooldown[i] = Math.round(lust.cooldownSeconds * TICKS_PER_SECOND);
    run.events.push(EventKind.Bloodlust, i, given, e.x[i], e.y[i], 0, 0);
  }
}

/** The bloodlust of enemy `slot`, or undefined when it has none running. */
function lustOf(run: Run, slot: number) {
  const e = run.enemies;
  return e.bloodlustTicks[slot] > 0 ? run.data.enemies[e.bloodlustType[slot]].bloodlust : undefined;
}

/** Walking speed multiplier of bloodlust on `slot` (1 without it). */
export function bloodlustSpeedScale(run: Run, slot: number): number {
  const lust = lustOf(run, slot);
  return lust === undefined ? 1 : 1 + lust.moveSpeed;
}

/** Damage multiplier of bloodlust on `slot` (1 without it). */
export function bloodlustDamageScale(run: Run, slot: number): number {
  const lust = lustOf(run, slot);
  return lust === undefined ? 1 : 1 + lust.damage;
}

/** Steps between two attacks of `slot`: the type's delay, divided by 1 + attackSpeed under bloodlust. */
export function attackDelayTicks(run: Run, slot: number): number {
  const def = run.data.enemies[run.enemies.type[slot]];
  const lust = lustOf(run, slot);
  const scale = lust === undefined ? 1 : 1 + lust.attackSpeed;
  return Math.round((def.attack.cooldown * TICKS_PER_SECOND) / scale);
}
