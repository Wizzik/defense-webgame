import { z } from "zod";
import { LocalizedText, Slug } from "./common";

const Attribute = z.object({ base: z.number(), perLevel: z.number() }).strict();

export const HeroSchema = z.object({
  id: Slug,
  name: LocalizedText,
  role: LocalizedText,
  primary: z.enum(["str", "agi", "int"]),
  hp: z.number().positive(),
  armor: z.number(),
  moveSpeed: z.number().positive(),
  attributes: z.object({ str: Attribute, agi: Attribute, int: Attribute }).strict(),
  baseAttack: z.object({
    kind: z.enum(["melee", "ranged", "bounce"]),
    range: z.number().positive(),
    cooldown: z.number().positive(),
    damageMin: z.number(),
    damageMax: z.number(),
    /** Blows per attack (two axes: 2); missing means 1. Each blow rolls its own damage. */
    strikes: z.number().int().min(2).max(4).optional(),
    /** Every blow also hits the other enemies within `radius` of its target for `share` of its damage. */
    splash: z.object({ radius: z.number().positive(), share: z.number().positive().max(1) }).strict().optional(),
  }).strict(),
  signatureAbilities: z.tuple([Slug, Slug, Slug]),
  ultimate: Slug,
  /** Multiplier on the damage enemies deal to this hero (melee heroes stand in the crowd); missing means 1. */
  damageTaken: z.number().positive().max(2).optional(),
  /** Balance multiplier on all the hero's damage and heals: base attack and spell power (Petr's batch 2); missing means 1. */
  power: z.number().positive().max(4).optional(),
}).strict();

export type Hero = z.infer<typeof HeroSchema>;
