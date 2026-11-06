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
    range: z.number(),
    cooldown: z.number(),
    damageMin: z.number(),
    damageMax: z.number(),
  }).strict(),
  xp: z.number().int().positive(),
}).strict();

export type Enemy = z.infer<typeof EnemySchema>;
