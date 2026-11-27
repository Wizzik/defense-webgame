/**
 * The damage meter (Petr, 2026-11-27: "which spell deals the most damage", in the spirit of the WoW addon Details):
 * the damage each source of one player dealt in the run. Sources: the ten ability slots (0-2 signature spells,
 * 3 the ultimate, 4-5 shared spells, 6-9 passives; a summon's hits count for the slot that summoned it), then the
 * basic attack (with multishot and splash), item effects (chain and splash of gear) and thorns. World damage
 * (storm, fire pools) belongs to nobody. Only the damage that landed counts (no overkill). The meter is a readout:
 * nothing in the game reads it and the state hash leaves it out, so it never changes a run.
 */

/** Meter sources after the ten ability slots. */
export const METER_ATTACK = 10;
export const METER_ITEM = 11;
export const METER_THORNS = 12;
export const METER_SOURCES = 13;

export class DamageMeter {
  /** Damage dealt per source. */
  readonly damage = new Float64Array(METER_SOURCES);
  /** Hits per source. */
  readonly hits = new Uint32Array(METER_SOURCES);
  /** The biggest single hit per source. */
  readonly top = new Float64Array(METER_SOURCES);
  /** Kills per source (the blow that felled the enemy). */
  readonly kills = new Uint32Array(METER_SOURCES);

  add(source: number, dealt: number, killed: boolean): void {
    if (source < 0 || source >= METER_SOURCES) return;
    this.damage[source] += dealt;
    this.hits[source]!++;
    if (dealt > this.top[source]!) this.top[source] = dealt;
    if (killed) this.kills[source]!++;
  }

  /** The sum of every source. */
  total(): number {
    let sum = 0;
    for (let i = 0; i < METER_SOURCES; i++) sum += this.damage[i]!;
    return sum;
  }
}
