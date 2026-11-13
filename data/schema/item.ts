import { z } from "zod";
import { LocalizedText, Slug } from "./common";

/** The 14 item types. A ring fits `ring1` and `ring2`, a trinket `trinket1` and `trinket2`. */
export const SLOT_TYPES = [
  "head", "neck", "shoulders", "back", "chest", "wrist", "hands", "waist", "legs", "feet", "ring", "trinket", "mainHand", "offHand",
] as const;
export const SlotTypeSchema = z.enum(SLOT_TYPES);
export type SlotType = z.infer<typeof SlotTypeSchema>;

/** Rarities from the lowest to the highest. */
export const RARITIES = ["common", "rare", "epic", "legendary", "mythic"] as const;
export const RaritySchema = z.enum(RARITIES);
export type Rarity = z.infer<typeof RaritySchema>;

/** Stat rows an item of a rarity has. */
export const RARITY_ROWS: Record<Rarity, number> = { common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };

/** `damage`, `attackSpeed`, `moveSpeed`, `spellPower` and `goldFind` are shares: 0.05 is 5 %. */
export const STAT_IDS = [
  "str", "agi", "int", "hp", "armor", "regen", "damage", "attackSpeed", "moveSpeed", "spellPower", "magnet", "goldFind",
] as const;
export const StatIdSchema = z.enum(STAT_IDS);
export type StatId = z.infer<typeof StatIdSchema>;

const positive = z.number().positive();
const share = z.number().positive().max(1);

/**
 * Special effects of legendary and mythic items (sim/gear-effects.ts). `text` is the one line the tooltip shows.
 * An effect does not grow with the item level.
 */
const effect = <K extends string, P extends z.ZodRawShape>(kind: K, params: P) =>
  z.object({ kind: z.literal(kind), params: z.object(params).strict(), text: LocalizedText }).strict();

export const EffectSchema = z.discriminatedUnion("kind", [
  /** Every `every`-th basic attack jumps on to `jumps` enemies, each within `range` of the one before, for `damage` x spell power. */
  effect("chain_on_attack", { every: z.number().int().min(1), damage: positive, jumps: z.number().int().min(1).max(8), range: positive }),
  /** A basic attack has `chance` to deal `fraction` of its damage to every other enemy within `radius` of the target. */
  effect("splash_on_attack", { chance: share, radius: positive, fraction: positive }),
  /** Under `threshold` of max hp the hero and the castle are immune for `seconds`; then `cooldown` seconds pass before the next one. */
  effect("low_hp_shield", { threshold: share, seconds: positive, cooldown: positive }),
  /** After an elite or a boss falls, spell cooldowns run `cooldownSpeed` times as fast for `seconds`. */
  effect("haste_on_elite_kill", { cooldownSpeed: z.number().gt(1), seconds: positive }),
  /** Enemies within `radius` of the hero walk slower by the share `slow`. */
  effect("slow_aura", { radius: positive, slow: share }),
  /** Collected gold heals the castle by `perGold` hp for every gold of the coin. */
  effect("gold_heals_castle", { perGold: positive }),
]);
export type Effect = z.infer<typeof EffectSchema>;
export type EffectKind = Effect["kind"];

export const ItemSchema = z.object({
  id: Slug,
  name: LocalizedText,
  slotType: SlotTypeSchema,
  rarity: RaritySchema,
  /** Values at item level 1. */
  stats: z.array(z.object({ stat: StatIdSchema, value: z.number().positive() }).strict()).min(1),
  effect: EffectSchema.optional(),
}).strict().refine((item) => item.stats.length === RARITY_ROWS[item.rarity], {
  path: ["stats"], message: "the number of stat rows does not match the rarity",
});

export type Item = z.infer<typeof ItemSchema>;
