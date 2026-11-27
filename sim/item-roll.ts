import type { DifficultyId, GameData, Rarity, RoleTag, SlotType } from "../data/schema";
import { RARITIES, STAT_IDS } from "../data/schema";
import type { RolledItem } from "./gear";
import type { Rng } from "./rng";

/**
 * Rolls random items (spec 2026-11-26 random items, rules.loot in design/rules.yaml). Pure: randomness only from the
 * given generator, so a chest (run.chestRng) and a boss drop between runs (meta/) roll the same way. Allocates the
 * item: only for an offer or a drop, never in a normal step.
 */

/** Item power of a chest opened in phase `phase` (1-based) of a run on `world` and `difficulty`. */
export function chestPower(data: GameData, phase: number, world: number, difficulty: DifficultyId): number {
  const { power } = data.rules.loot;
  return power.chestBase + power.chestPerPhase * phase + courseBonus(data, world, difficulty);
}

/** Item power of the drop of the boss with order `order` (0 for the first boss of the run, as rules.drops). */
export function bossPower(data: GameData, order: number, world: number, difficulty: DifficultyId): number {
  const { power } = data.rules.loot;
  const boss = power.boss[Math.max(0, Math.min(order, power.boss.length - 1))]!;
  return boss + courseBonus(data, world, difficulty);
}

function courseBonus(data: GameData, world: number, difficulty: DifficultyId): number {
  const { power } = data.rules.loot;
  return power.perWorld * Math.max(0, world - 1) + power.difficulty[difficulty];
}

/** The item level a drop of `power` has: the highest level whose `levelAtPower` the power reaches. */
export function levelAtPower(data: GameData, power: number): number {
  const steps = data.rules.loot.levelAtPower;
  let level = 1;
  for (let i = 1; i < steps.length; i++) if (power >= steps[i]!) level = i + 1;
  return level;
}

/** Tiers (0-3) a roll of `power` may give an affix whose top tier is `maxTier` (1-4). At least T1. */
function topTier(data: GameData, power: number, maxTier: number): number {
  const tiers = data.rules.loot.tiers;
  let top = 0;
  for (let t = 1; t < tiers.length && t < maxTier; t++) if (power >= tiers[t]!.minPower) top = t;
  return top;
}

/**
 * Rolls an item of `rarity` for slot type `slotType` with item power `power`, for a hero whose primary attribute is
 * `primary`:
 * 1. the base: with rules.loot.smartShare one of the hero's flavour, else any base of the type;
 * 2. rules.loot.affixCount[rarity] affixes without repeats and never the implicit's stat: each one with smartShare
 *    from the hero's role pool, else from all (all when the pool is used up);
 * 3. a tier per affix, uniform up to the highest its power and its maxTier allow; the affix rows share
 *    (budget - implicitPoints) by their tier weights, each x a roll in [1 - rowRoll, 1 + rowRoll];
 * 4. a mythic draws one of rules.loot.mythicEffects; three or more affixes draw a two-word name.
 * The rows are values at item level 1: points x the affix unit (design/affixes.yaml).
 */
export function rollItem(
  data: GameData, rng: Rng, slotType: SlotType, rarity: Rarity, power: number, primary: RoleTag,
): RolledItem {
  const { loot } = data;
  const rules = data.rules.loot;
  const bases: number[] = [];
  const own: number[] = [];
  for (let i = 0; i < loot.bases.length; i++) {
    if (loot.bases[i]!.slotType !== slotType) continue;
    bases.push(i);
    if (loot.bases[i]!.flavour === primary) own.push(i);
  }
  if (bases.length === 0) throw new Error(`rollItem: no base of type ${slotType}`);
  const basePool = own.length > 0 && rng.next() < rules.smartShare ? own : bases;
  const base = basePool[rng.int(basePool.length)]!;
  const implicit = loot.bases[base]!.implicit;

  const count = rules.affixCount[rarity];
  const used = new Uint8Array(loot.affixes.length);
  const chosen: number[] = [];
  const tiers: number[] = [];
  for (let k = 0; k < count; k++) {
    const pool: number[] = [];
    const all: number[] = [];
    for (let a = 0; a < loot.affixes.length; a++) {
      const affix = loot.affixes[a]!;
      if (used[a] === 1 || affix.stat === implicit.stat) continue;
      all.push(a);
      if (affix.tags.includes(primary)) pool.push(a);
    }
    if (all.length === 0) break;
    const from = pool.length > 0 && rng.next() < rules.smartShare ? pool : all;
    const a = from[rng.int(from.length)]!;
    used[a] = 1;
    chosen.push(a);
    const top = topTier(data, power, loot.affixes[a]!.maxTier ?? 4);
    tiers.push(rng.int(top + 1));
  }

  const budget = rules.budget[rarity] - rules.implicitPoints;
  let weightSum = 0;
  for (const t of tiers) weightSum += rules.tiers[t]!.weight;
  const stats = [STAT_IDS.indexOf(implicit.stat)];
  const values = [implicit.value];
  const rowTiers = [-1];
  for (let k = 0; k < chosen.length; k++) {
    const affix = loot.affixes[chosen[k]!]!;
    const roll = 1 - rules.rowRoll + 2 * rules.rowRoll * rng.next();
    const points = (budget * rules.tiers[tiers[k]!]!.weight / weightSum) * roll;
    stats.push(STAT_IDS.indexOf(affix.stat));
    values.push(points * affix.unit);
    rowTiers.push(tiers[k]!);
  }

  const effect = rarity === "mythic" && rules.mythicEffects.length > 0 ? rng.int(rules.mythicEffects.length) : -1;
  let nameFirst = -1;
  let nameNoun = -1;
  if (chosen.length >= 3) {
    nameFirst = rng.int(loot.names.first.length);
    nameNoun = rng.int(loot.names.nouns[slotType].length);
  }
  return { base, rarity: RARITIES.indexOf(rarity), stats, values, tiers: rowTiers, effect, nameFirst, nameNoun };
}

/** Points of a rolled row (value / unit of its stat's affix); tests and the client's tier hints. */
export function rowPoints(data: GameData, stat: number, value: number): number {
  const affix = data.loot.affixes.find((a) => a.stat === STAT_IDS[stat]);
  return affix ? value / affix.unit : 0;
}
