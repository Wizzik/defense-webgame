import { damageEnemy } from "./combat";
import type { Run } from "./run";

/**
 * Thorns of gear (random items): a melee hit on a hero with thorns owes its attacker a share of the damage back.
 * damageHero only notes the debt (the enemy may be in the middle of its own update); applyThorns pays it right after
 * updateEnemies, as damage of source 2 (no lifesteal, no knockback). Fixed arrays, nothing allocates.
 */
export class ThornsStore {
  readonly owed: Float64Array;
  /** Whether any slot owes something this step. */
  any = false;

  constructor(capacity: number) {
    this.owed = new Float64Array(capacity);
  }

  add(slot: number, amount: number): void {
    this.owed[slot] = this.owed[slot]! + amount;
    this.any = true;
  }
}

/** Deals every owed thorns damage to its (still living) enemy and clears the debts. */
export function applyThorns(run: Run): void {
  const store = run.thorns;
  if (!store.any) return;
  store.any = false;
  const owed = store.owed;
  const e = run.enemies;
  for (let i = 0; i < owed.length; i++) {
    const amount = owed[i]!;
    if (amount <= 0) continue;
    owed[i] = 0;
    if (e.alive[i] === 1) damageEnemy(run, i, amount, 2);
  }
}
