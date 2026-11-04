import { z } from "zod";

export const ConstantsSchema = z.object({
  strHitPointBonus: z.number(),
  agiAttackSpeedBonus: z.number(),
  defenseArmor: z.number(),
  attackSpeedCap: z.number(),
  mapVersion: z.string(),
});

export type Constants = z.infer<typeof ConstantsSchema>;
