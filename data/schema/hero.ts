import { z } from "zod";
import { LocalizedText, Slug, SourceId } from "./common";

const Attribute = z.object({ base: z.number(), perLevel: z.number() });

export const HeroSchema = z.object({
  id: Slug,
  source: SourceId,
  name: LocalizedText,
  primary: z.enum(["str", "agi", "int"]),
  moveSpeed: z.number().positive(),
  attributes: z.object({ str: Attribute, agi: Attribute, int: Attribute }),
  baseAttack: z.object({
    kind: z.enum(["melee", "ranged", "bounce"]),
    range: z.number().positive(),
    cooldown: z.number().positive(),
    damageMin: z.number(),
    damageMax: z.number(),
  }),
  signatureAbilities: z.tuple([Slug, Slug, Slug]),
  ultimate: Slug,
});

export type Hero = z.infer<typeof HeroSchema>;
