import { z } from "zod";

export const ConstantsSchema = z.object({
  strHitPointBonus: z.number(),
  agiAttackSpeedBonus: z.number(),
  defenseArmor: z.number(),
  agiDefenseBonus: z.number(),
  primaryAttackBonus: z.number(),
  attackSpeedCap: z.number(),
  mapVersion: z.string(),
}).strict();

export type Constants = z.infer<typeof ConstantsSchema>;
