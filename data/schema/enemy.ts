import { z } from "zod";
import { LocalizedText, Slug } from "./common";

export const EnemySchema = z.object({
  id: Slug,
  name: LocalizedText,
  level: z.number().int().min(1),
  hp: z.number().positive(),
  hpRegen: z.number().min(0),
  armor: z.number(),
  moveSpeed: z.number().positive(),
  collision: z.number().positive(),
  acquireRange: z.number().positive(),
  attack: z.object({
    /** `ranged` hits at once like a hero's ranged attack; the shot is only an effect. */
    kind: z.enum(["melee", "ranged"]),
    range: z.number().min(0),
    cooldown: z.number().positive(),
    damageMin: z.number().min(0),
    damageMax: z.number().min(0),
  }).strict(),
  /** How the type walks: see sim/enemy-steer.ts and sim/enemy-charge.ts. */
  behavior: z.enum(["siege", "flank", "skirmish", "support", "charge"]),
  xp: z.number().int().positive(),
  /** Heals the most wounded enemy in `range` (itself too) by `amount` every `cooldown` seconds. */
  heal: z.object({
    amount: z.number().positive(),
    range: z.number().positive(),
    cooldown: z.number().positive(),
  }).strict().optional(),
  /** A charge at the hero: a windup, then a straight run that hits harder (sim/enemy-charge.ts). */
  charge: z.object({
    minRange: z.number().positive(),
    maxRange: z.number().positive(),
    windupSeconds: z.number().positive(),
    speedMultiplier: z.number().positive(),
    damageMultiplier: z.number().positive(),
    distance: z.number().positive(),
    cooldownSeconds: z.number().positive(),
  }).strict().refine((c) => c.minRange < c.maxRange, "minRange is not below maxRange").optional(),
  /** Enemies within `radius` (other carriers of an aura excepted) walk and hit harder by these shares. */
  aura: z.object({
    radius: z.number().positive(),
    moveSpeed: z.number().min(0),
    damage: z.number().min(0),
  }).strict().optional(),
  /** A boss: it cannot be knocked back, stuns are shorter on it and it always gets a slot. */
  boss: z.literal(true).optional(),
  /** Id of the enemy type whose model this type is drawn with (its own id when missing). */
  model: Slug.optional(),
  /** A slam: the boss stops, a circle of `radius` warns for `windupSeconds`, then the hero and the castle inside take `damage`. */
  slam: z.object({
    radius: z.number().positive(),
    damage: z.number().positive(),
    windupSeconds: z.number().positive(),
    /** The next slam comes after a random time between the two values. */
    cooldownSeconds: z.tuple([z.number().positive(), z.number().positive()]),
  }).strict().refine((s) => s.cooldownSeconds[0] <= s.cooldownSeconds[1], {
    path: ["cooldownSeconds"], message: "min is above max",
  }).optional(),
  /**
   * A strike from afar (sim/enemy-strike.ts): a circle of `radius` warns where the hero stands for `windupSeconds`,
   * then the hero and the castle inside take `damage`. With `leap` the enemy jumps into the circle during the warning.
   */
  strike: z.object({
    minRange: z.number().positive(),
    maxRange: z.number().positive(),
    radius: z.number().positive(),
    damage: z.number().positive(),
    windupSeconds: z.number().positive(),
    cooldownSeconds: z.number().positive(),
    leap: z.boolean(),
  }).strict().refine((s) => s.minRange < s.maxRange, "minRange is not below maxRange").optional(),
  /** Goes for the hero whatever the role of its pack is. */
  hunter: z.literal(true).optional(),
}).strict();

export type Enemy = z.infer<typeof EnemySchema>;
