import { z } from "zod";
import { LocalizedText, Slug } from "./common";

export const AbilityKind = z.enum([
  "projectile", "instant", "chain", "area", "line", "nova", "cone",
  "ticking_area", "aura", "summon", "on_hit", "heal", "shield", "on_cast", "passive", "transform",
]);

export const Targeting = z.enum([
  "nearest", "nearest_elite_first", "densest_cluster", "move_direction",
  "around_self", "self", "on_attack", "low_hp_ally", "on_cast", "strongest",
]);

/** Params of a passive: fractions (0.08 = 8 %), except regenBonus (hp per second) and magnetBonus (world units). */
export const PASSIVE_KEYS = [
  "attackBonus", "spellPowerBonus", "cooldownBonus", "hpBonus", "regenBonus",
  "moveSpeedBonus", "attackSpeedBonus", "goldBonus", "magnetBonus",
] as const;
export type PassiveKey = (typeof PASSIVE_KEYS)[number];

/** Upper bound of chain bounces (the chain updater keeps a scratch array of this size). */
export const MAX_BOUNCES = 8;

const PerLevel = z.array(z.number());

/** Params of a kind: required keys, optional keys, and nothing else. */
function params<R extends string, O extends string = never>(required: readonly R[], optional: readonly O[] = []) {
  const shape = {
    ...Object.fromEntries(required.map((k) => [k, PerLevel])),
    ...Object.fromEntries(optional.map((k) => [k, PerLevel.optional()])),
  } as Record<R, typeof PerLevel> & Record<O, z.ZodOptional<typeof PerLevel>>;
  return z.object(shape).strict();
}

/** Params where at least one of the listed keys must be present; the optional keys may follow. */
function paramsAnyOf(anyOf: readonly string[], optional: readonly string[] = []) {
  const shape = Object.fromEntries([...anyOf, ...optional].map((k) => [k, PerLevel.optional()]));
  return z.object(shape).strict().superRefine((p, ctx) => {
    if (!anyOf.some((k) => k in p)) {
      ctx.addIssue({ code: "custom", message: `needs at least one of: ${anyOf.join(", ")}` });
    }
  });
}

const WARD_KEYS = ["damage", "attackRange", "attackInterval", "maxAlive"] as const;

/** A summon is either copies of the hero (damageDealt) or totems (damage, attackRange, attackInterval, maxAlive). */
function summonParams() {
  return params(
    ["count", "duration"],
    ["range", "damageDealt", "damageTaken", ...WARD_KEYS],
  ).superRefine((p, ctx) => {
    const images = p.damageDealt !== undefined;
    const anyWard = WARD_KEYS.some((k) => p[k] !== undefined);
    const wards = WARD_KEYS.every((k) => p[k] !== undefined);
    if (!((images && !anyWard) || (!images && wards))) {
      ctx.addIssue({
        code: "custom",
        message: "summon needs damageDealt (images) or damage, attackRange, attackInterval and maxAlive (wards)",
      });
    }
  });
}

const common = {
  id: Slug,
  name: LocalizedText,
  description: LocalizedText,
  targeting: Targeting,
  levels: z.number().int().min(1).max(10),
  cooldown: z.array(z.number().min(0)),
};

function variant<K extends string, P extends z.ZodType>(kind: K, p: P) {
  return z.object({ ...common, kind: z.literal(kind), params: p }).strict();
}

export const AbilitySchema = z
  .discriminatedUnion("kind", [
    variant("projectile", params(["damage", "range"], ["speed"])),
    variant("on_cast", params(["damage", "radius", "stunSeconds"])),
    variant("instant", params(["damage", "range"])),
    variant("chain", params(["damage", "range", "bounces", "bounceRange"]).superRefine((p, ctx) => {
      if (p.bounces.some((b) => !Number.isInteger(b) || b < 0 || b > MAX_BOUNCES)) {
        ctx.addIssue({ code: "custom", path: ["bounces"], message: `bounces must be integers 0-${MAX_BOUNCES}` });
      }
    })),
    variant("area", params(["damage", "radius", "range"], ["healPerHit", "slow", "slowSeconds"])),
    variant("line", params(["damage", "length", "width"], ["stunSeconds", "waveSpeed"])),
    variant("nova", params(["damage", "radius"], ["slow", "slowSeconds", "stunSeconds"])),
    variant("cone", params(["damage", "length", "endWidth", "maxTargets"])),
    variant("ticking_area", params(["tickDamage", "ticksPerSecond", "radius", "duration"], ["hitRadius"])),
    variant("aura", paramsAnyOf(["damageBonus", "moveSpeedBonus", "attackSpeedBonus", "slow", "armorBonus"], ["radius"]).superRefine((p, ctx) => {
      if ((p.slow === undefined) !== (p.radius === undefined)) {
        ctx.addIssue({ code: "custom", message: "an aura with slow needs radius, and radius needs slow" });
      }
    })),
    variant("summon", summonParams()),
    variant("on_hit", paramsAnyOf(["chance", "splashRadius", "bonusDamage", "empower", "extraTargets"], ["splashPercent", "stunSeconds", "multiplier"])),
    variant("heal", params(["amount", "maxTargets", "range"])),
    variant("shield", params(["duration", "radius"])),
    // a timed self buff (the map's Avatar): hpBonus and damageBonus are shares, armorBonus is flat armor
    variant("transform", params(["duration"], ["hpBonus", "armorBonus", "damageBonus"])),
    variant("passive", paramsAnyOf(PASSIVE_KEYS)),
  ])
  .superRefine((a, ctx) => {
    if (a.kind === "passive" && a.cooldown.some((c) => c !== 0)) {
      ctx.addIssue({ code: "custom", path: ["cooldown"], message: "a passive has no cooldown (all 0)" });
    }
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
