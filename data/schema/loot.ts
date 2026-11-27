import { z } from "zod";
import { LocalizedText, Slug } from "./common";
import { SlotTypeSchema, StatIdSchema, STAT_IDS } from "./item";

/**
 * Random items (spec 2026-11-26 random items): an item is a base + rarity + affix rows. These schemas hold the
 * bases, the affix pools and the parts of the rare names; the numbers of a roll live in `rules.loot`.
 */

/**
 * Stats only random items roll. The sim reads them from stage 2 of the plan on
 * (docs/superpowers/plans/2026-11-27-random-items.md); until then the roller skips them.
 * critChance and critDamage, dodge, damageTaken (a share off), thorns (a share of melee damage back),
 * cooldownSpeed, ultimateCooldown and areaSize are shares: 0.05 is 5 %.
 */
export const NEW_STAT_IDS = [
  "critChance", "critDamage", "dodge", "damageTaken", "thorns", "cooldownSpeed", "ultimateCooldown", "areaSize",
] as const;
export const AFFIX_STAT_IDS = [...STAT_IDS, ...NEW_STAT_IDS] as const;
export const AffixStatSchema = z.enum(AFFIX_STAT_IDS);
export type AffixStat = z.infer<typeof AffixStatSchema>;

/** The hero's role a base or an affix serves: the primary attribute, or `any`. */
export const ROLE_TAGS = ["str", "agi", "int", "any"] as const;
export const RoleTagSchema = z.enum(ROLE_TAGS);
export type RoleTag = z.infer<typeof RoleTagSchema>;

/**
 * Grammatical gender of a Czech noun, for the adjective in front of it: masculine, feminine, neuter, and `p` for a
 * noun used in the plural (boty, rukavice: inanimate, so one plural form serves masculine and feminine nouns).
 */
export const GENDERS = ["m", "f", "n", "p"] as const;
export const GenderSchema = z.enum(GENDERS);
export type Gender = z.infer<typeof GenderSchema>;

/** A Czech adjective in the four forms of GENDERS. */
export const GenderedCs = z.object({
  m: z.string().min(1), f: z.string().min(1), n: z.string().min(1), p: z.string().min(1),
}).strict();
/** An English word and its Czech adjective forms. */
export const GenderedText = z.object({ en: z.string().min(1), cs: GenderedCs }).strict();
export type GenderedText = z.infer<typeof GenderedText>;

export const ItemBaseSchema = z.object({
  id: Slug,
  /** The base's own name; CS starts with a capital and is lowercased behind a prefix. */
  name: LocalizedText,
  gender: GenderSchema,
  slotType: SlotTypeSchema,
  /** Heavy (str), light (agi), cloth (int) or neutral (any): smart loot prefers the hero's own flavour. */
  flavour: RoleTagSchema,
  /** The base's own row, worth `rules.loot.implicitPoints` at item level 1. Only stats the sim already reads. */
  implicit: z.object({ stat: StatIdSchema, value: z.number().positive() }).strict(),
  /** game-icons.net icon name (stage 6 of the plan). */
  icon: z.string().regex(/^[a-z0-9-]+$/).optional(),
}).strict();
export type ItemBase = z.infer<typeof ItemBaseSchema>;

export const AffixSchema = z.object({
  stat: AffixStatSchema,
  /** Roles whose pool holds the affix (smart loot draws from the hero's primary attribute's pool). */
  tags: z.array(RoleTagSchema).min(1),
  /** The value of one budget point at item level 1 (design/items.yaml header). */
  unit: z.number().positive(),
  /** The highest tier the affix may roll (1-4); missing means 4. */
  maxTier: z.number().int().min(1).max(4).optional(),
  /** The word in front of the base when the affix gives the prefix: "Mighty", "Mocný / Mocná / Mocné / Mocné". */
  prefix: GenderedText,
  /** The words behind the base when the affix gives the suffix: "of the Bear", "medvěda". */
  suffix: LocalizedText,
}).strict().refine((a) => new Set(a.tags).size === a.tags.length, { path: ["tags"], message: "duplicate tag" });
export type Affix = z.infer<typeof AffixSchema>;

/** A noun of a rare name with the gender its Czech word takes. */
const RareNoun = z.object({ name: LocalizedText, gender: GenderSchema }).strict();

/** Two-word names of items with three or more affixes ("Grim Crown"): a first word and a noun of the slot type. */
export const ItemNamesSchema = z.object({
  first: z.array(GenderedText).min(1),
  nouns: z.record(SlotTypeSchema, z.array(RareNoun).min(1)),
}).strict();
export type ItemNames = z.infer<typeof ItemNamesSchema>;

export const LootSchema = z.object({
  bases: z.array(ItemBaseSchema).min(1),
  affixes: z.array(AffixSchema).min(1),
  names: ItemNamesSchema,
}).strict();
export type Loot = z.infer<typeof LootSchema>;
