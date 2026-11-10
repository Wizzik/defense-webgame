import type { Ability } from "../../data/schema";
import { TICKS_PER_SECOND } from "../constants";
import type { Run } from "../run";
import { updateLine } from "./line";

export interface AbilitySlot {
  def: Ability;
  level: number;
  /** Ticks until the next cast. */
  cooldown: number;
  active: boolean;
  originX: number;
  originY: number;
  dirX: number;
  dirY: number;
  /** Distance the wave has travelled from the origin. */
  front: number;
  /** Indexed by enemy slot; cleared on cast. */
  readonly hit: Uint8Array;
}

/**
 * One slot: the hero's first signature ability at level 1. Any kind other than line throws
 * `sim: ability kind <kind> is not implemented`.
 */
export function createAbilitySlots(run: Run): AbilitySlot[] {
  const id = run.hero.def.signatureAbilities[0];
  const def = run.data.abilities.find((a) => a.id === id);
  if (!def) throw new Error(`sim: unknown ability "${id}"`);
  if (def.kind !== "line") throw new Error(`sim: ability kind ${def.kind} is not implemented`);
  return [{
    def, level: 1, cooldown: 0, active: false,
    originX: 0, originY: 0, dirX: 0, dirY: 1, front: 0,
    hit: new Uint8Array(run.enemies.capacity),
  }];
}

/** Cooldown in ticks: round(cooldown[level] * cooldownScale * 30). */
export function abilityCooldownTicks(run: Run, slot: AbilitySlot): number {
  const base = slot.def.cooldown[slot.level - 1];
  return Math.round(base * run.hero.stats.cooldownScale * TICKS_PER_SECOND);
}

export function updateAbilities(run: Run): void {
  const slots = run.abilities;
  for (let i = 0; i < slots.length; i++) updateLine(run, slots[i], i);
}
