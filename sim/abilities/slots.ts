import type { Ability } from "../../data/schema";
import { TICKS_PER_SECOND } from "../constants";
import { EventKind } from "../events";
import { refreshHeroStats } from "../level-up";
import type { Run } from "../run";
import { onHeroCast } from "./echo";
import { UPDATERS } from "./kinds";

/** The hero's ultimate always sits in the last slot. */
export const ULTIMATE_SLOT = 3;

export const CastMode = { None: 0, Auto: 1, Forced: 2 } as const;

export interface AbilitySlot {
  def: Ability;
  /** 0 = not learned. */
  level: number;
  /** Ticks until the next cast. */
  cooldown: number;
  /** A line is in flight, a ticking area runs, or an on_hit charge is armed. */
  active: boolean;
  originX: number;
  originY: number;
  dirX: number;
  dirY: number;
  /** Line: distance the wave has travelled from the origin. */
  front: number;
  /** Ticking area: ticks remaining. */
  ticksLeft: number;
  /** Indexed by enemy slot; cleared on cast. */
  readonly hit: Uint8Array;
}

function newSlot(run: Run, id: string, level: number): AbilitySlot {
  const def = run.data.abilities.find((a) => a.id === id);
  if (!def) throw new Error(`sim: unknown ability "${id}"`);
  return {
    def, level, cooldown: 0, active: false,
    originX: 0, originY: 0, dirX: 0, dirY: 1, front: 0, ticksLeft: 0,
    hit: new Uint8Array(run.enemies.capacity),
  };
}

/**
 * Slots 0-2 are the signature abilities (slot 0 at level 1, the others at 0), slot 3 the ultimate at level 0.
 * A kind without an updater is not rejected here; `updateAbilities` throws once such a slot is learned.
 */
export function createAbilitySlots(run: Run): AbilitySlot[] {
  const { signatureAbilities, ultimate } = run.hero.def;
  return [
    newSlot(run, signatureAbilities[0], 1),
    newSlot(run, signatureAbilities[1], 0),
    newSlot(run, signatureAbilities[2], 0),
    newSlot(run, ultimate, 0),
  ];
}

/** Cooldown in ticks: round(cooldown[level] * cooldownScale * 30). */
export function abilityCooldownTicks(run: Run, slot: AbilitySlot): number {
  const base = slot.def.cooldown[slot.level - 1];
  return Math.round(base * run.hero.stats.cooldownScale * TICKS_PER_SECOND);
}

/**
 * None: not learned, cooling down or the hero is dead; for the ultimate also when auto is off and R did not come.
 * Forced: the ultimate with an R request in this step. Otherwise Auto.
 */
export function castMode(run: Run, index: number): number {
  const slot = run.abilities[index];
  if (slot.level < 1 || slot.cooldown > 0 || run.hero.hp <= 0) return CastMode.None;
  if (index !== ULTIMATE_SLOT) return CastMode.Auto;
  if (run.ultimateRequested) return CastMode.Forced;
  return run.ultimateAuto ? CastMode.Auto : CastMode.None;
}

/** Casting: the Cast event and the cooldown, then the echo reacts. The caller applies its own damage afterwards. */
export function startCast(
  run: Run, index: number, value: number, x: number, y: number, u: number, v: number,
): void {
  const slot = run.abilities[index];
  run.events.push(EventKind.Cast, index, value, x, y, u, v);
  slot.cooldown = abilityCooldownTicks(run, slot);
  onHeroCast(run, index);
}

/** Lowers the cooldown of learned slots by 1, then runs their updaters in slot order. */
export function updateAbilities(run: Run): void {
  const slots = run.abilities;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].level >= 1 && slots[i].cooldown > 0) slots[i].cooldown--;
  }
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.level < 1) continue;
    const update = UPDATERS[slot.def.kind];
    if (!update) throw new Error(`sim: ability kind ${slot.def.kind} is not implemented`);
    update(run, slot, i);
  }
  run.ultimateRequested = false;
}

/** For debugging and e2e only: sets a slot's level and recomputes the stats. */
export function debugSetAbilityLevel(run: Run, index: number, level: number): void {
  run.abilities[index].level = level;
  refreshHeroStats(run);
}
