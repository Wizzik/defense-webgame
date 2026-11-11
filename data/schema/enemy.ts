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
}).strict();

export type Enemy = z.infer<typeof EnemySchema>;
