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

export const ItemSchema = z.object({
  id: Slug,
  name: LocalizedText,
  slotType: SlotTypeSchema,
  rarity: RaritySchema,
  /** Values at item level 1. */
  stats: z.array(z.object({ stat: StatIdSchema, value: z.number().positive() }).strict()).min(1),
}).strict().refine((item) => item.stats.length === RARITY_ROWS[item.rarity], {
  path: ["stats"], message: "the number of stat rows does not match the rarity",
});

export type Item = z.infer<typeof ItemSchema>;
