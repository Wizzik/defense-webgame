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

/** The ability of an empty shared-spell or passive slot: a passive with no params, never learned. */
export const EMPTY_ABILITY: Ability = {
  id: "", name: { en: "", cs: "" }, description: { en: "", cs: "" },
  kind: "passive", targeting: "self", levels: 5, cooldown: [0, 0, 0, 0, 0], params: {},
};

export interface AbilitySlot {
  /** EMPTY_ABILITY until a card fills a shared-spell or passive slot. */
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

export function isEmptySlot(slot: AbilitySlot): boolean {
  return slot.def === EMPTY_ABILITY;
}

/** Slots of the shared spells: [first, end). */
export function sharedSlotRange(run: Run): [number, number] {
  const first = ULTIMATE_SLOT + 1;
  return [first, first + run.data.rules.progression.sharedSpellSlots];
}

/** Slots of the passives: [first, end). */
export function passiveSlotRange(run: Run): [number, number] {
  const first = sharedSlotRange(run)[1];
  return [first, first + run.data.rules.progression.passiveSlots];
}

function newSlot(run: Run, id: string, level: number): AbilitySlot {
  const def = run.data.abilities.find((a) => a.id === id);
  if (!def) throw new Error(`sim: unknown ability "${id}"`);
  return emptySlotWith(run, def, level);
}

function emptySlotWith(run: Run, def: Ability, level: number): AbilitySlot {
  return {
    def, level, cooldown: 0, active: false,
    originX: 0, originY: 0, dirX: 0, dirY: 1, front: 0, ticksLeft: 0,
    hit: new Uint8Array(run.enemies.capacity),
  };
}

/**
 * Slots 0-2 are the signature abilities (slot 0 at level 1, the others at 0), slot 3 the ultimate at level 0,
 * then the empty shared-spell slots and the empty passive slots (rules.progression).
 * A kind without an updater is not rejected here; `updateAbilities` throws once such a slot is learned.
 */
export function createAbilitySlots(run: Run): AbilitySlot[] {
  const { signatureAbilities, ultimate } = run.hero.def;
  const { sharedSpellSlots, passiveSlots } = run.data.rules.progression;
  const slots = [
    newSlot(run, signatureAbilities[0], 1),
    newSlot(run, signatureAbilities[1], 0),
    newSlot(run, signatureAbilities[2], 0),
    newSlot(run, ultimate, 0),
  ];
  for (let i = 0; i < sharedSpellSlots + passiveSlots; i++) slots.push(emptySlotWith(run, EMPTY_ABILITY, 0));
  return slots;
}

/** Whether the hero has learned the ability `def` in any slot. */
export function hasAbility(run: Run, def: Ability): boolean {
  for (const slot of run.abilities) if (slot.def === def) return true;
  return false;
}

/** The first empty slot in [first, end), or -1. */
export function firstEmptySlot(run: Run, range: [number, number]): number {
  for (let i = range[0]; i < range[1]; i++) if (isEmptySlot(run.abilities[i])) return i;
  return -1;
}

/**
 * Fills the empty slot `index` with ability `abilityIndex` (index into data.abilities) at level 1.
 * A shared spell goes into a shared-spell slot, a passive into a passive slot; the hero must not have it yet.
 * Only a card choice and debugging call it, never a normal step.
 */
export function learnAbility(run: Run, index: number, abilityIndex: number): void {
  const def = run.data.abilities[abilityIndex];
  if (!def) throw new Error(`sim: unknown ability index ${abilityIndex}`);
  const slot = run.abilities[index];
  if (!slot || !isEmptySlot(slot)) throw new Error(`sim: slot ${index} is not an empty slot`);
  const { sharedSpells, passives } = run.data.rules.progression;
  const passive = def.kind === "passive";
  const [first, end] = passive ? passiveSlotRange(run) : sharedSlotRange(run);
  if (!(passive ? passives : sharedSpells).includes(def.id)) {
    throw new Error(`sim: "${def.id}" is not in the ${passive ? "passive" : "shared spell"} pool`);
  }
  if (index < first || index >= end) throw new Error(`sim: slot ${index} cannot hold "${def.id}"`);
  if (hasAbility(run, def)) throw new Error(`sim: the hero already has "${def.id}"`);
  slot.def = def;
  slot.level = 1;
  slot.cooldown = 0;
  slot.active = false;
  slot.front = 0;
  slot.ticksLeft = 0;
  slot.hit.fill(0);
  refreshHeroStats(run);
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

/** Counts the shield down, lowers the cooldown of learned slots by 1, then runs their updaters in slot order. */
export function updateAbilities(run: Run): void {
  const slots = run.abilities;
  if (run.shieldTicks > 0) run.shieldTicks--;
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

/** For debugging and e2e only: sets a slot's level and recomputes the stats. An empty slot stays empty. */
export function debugSetAbilityLevel(run: Run, index: number, level: number): void {
  if (isEmptySlot(run.abilities[index])) return;
  run.abilities[index].level = level;
  refreshHeroStats(run);
}
