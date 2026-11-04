import { z } from "zod";
import { LocalizedText, Slug, SourceId } from "./common";

export const AbilityKind = z.enum([
  "projectile", "instant", "chain", "area", "line", "nova", "cone",
  "ticking_area", "aura", "summon", "on_hit", "heal", "shield",
]);

export const Targeting = z.enum([
  "nearest", "nearest_elite_first", "densest_cluster", "move_direction",
  "around_self", "self", "on_attack", "low_hp_ally",
]);

const PerLevel = z.array(z.number());

/** Params object with required keys (number arrays) and optional extra number-array keys. */
function params<K extends string>(required: readonly K[]) {
  const shape = Object.fromEntries(required.map((k) => [k, PerLevel])) as Record<K, typeof PerLevel>;
  return z.object(shape).catchall(PerLevel);
}

/** Params where at least one of the listed keys must be present. */
function paramsAnyOf(keys: readonly string[]) {
  return z.object({}).catchall(PerLevel).superRefine((p, ctx) => {
    if (!keys.some((k) => k in p)) {
      ctx.addIssue({ code: "custom", message: `needs at least one of: ${keys.join(", ")}` });
    }
  });
}

const common = {
  id: Slug,
  source: SourceId,
  name: LocalizedText,
  targeting: Targeting,
  levels: z.number().int().min(1).max(5),
  cooldown: z.array(z.number().min(0)),
  review: z
    .object({
      reason: z.enum(["script", "engine+script"]),
      jassFunctions: z.array(z.string()),
      notes: z.string().optional(),
    })
    .optional(),
};

function variant<K extends string, P extends z.ZodType>(kind: K, p: P) {
  return z.object({ ...common, kind: z.literal(kind), params: p });
}

export const AbilitySchema = z
  .discriminatedUnion("kind", [
    variant("projectile", params(["damage", "range"])),
    variant("instant", params(["damage", "range"])),
    variant("chain", params(["damage", "range", "bounces"])),
    variant("area", params(["damage", "radius", "range"])),
    variant("line", params(["damage", "length", "width"])),
    variant("nova", params(["damage", "radius"])),
    variant("cone", params(["damage", "length", "endWidth", "maxTargets"])),
    variant("ticking_area", params(["tickDamage", "ticksPerSecond", "radius", "duration"])),
    variant("aura", paramsAnyOf(["damageBonus", "moveSpeedBonus", "attackSpeedBonus"])),
    variant("summon", params(["count", "duration"])),
    variant("on_hit", paramsAnyOf(["chance", "splashRadius", "bonusDamage"])),
    variant("heal", params(["amount", "maxTargets", "range"])),
    variant("shield", params(["duration", "radius"])),
  ])
  .superRefine((a, ctx) => {
    if (a.cooldown.length !== a.levels) {
      ctx.addIssue({
        code: "custom",
        path: ["cooldown"],
        message: `cooldown must have ${a.levels} entries (levels), got ${a.cooldown.length}`,
      });
    }
    for (const [key, arr] of Object.entries(a.params as Record<string, number[]>)) {
      if (arr.length !== a.levels) {
        ctx.addIssue({
          code: "custom",
          path: ["params", key],
          message: `params.${key} must have ${a.levels} entries (levels), got ${arr.length}`,
        });
      }
    }
  });

export type Ability = z.infer<typeof AbilitySchema>;
