import { z } from "zod";
import { Slug } from "./common";

export const PointSchema = z.object({ x: z.number(), y: z.number() }).strict();
export type Point = z.infer<typeof PointSchema>;

const positive = z.number().positive();
const nonNegative = z.number().min(0);

export const RulesSchema = z.object({
  start: z.object({ hero: Slug }).strict(),
  run: z.object({
    durationSeconds: positive,
    phaseSeconds: positive,
    /** The first pack of the run comes at this time. */
    firstPackSeconds: nonNegative,
    timeScaling: z.object({ seconds: positive, cap: z.number().min(1) }).strict(),
  }).strict(),
  arena: z.object({
    width: positive,
    height: positive,
    castle: PointSchema,
    heroStart: PointSchema,
    /** Packs appear on a circle of `radius` around the castle, scattered within `spread` of their centre. */
    spawn: z.object({ radius: positive, spread: positive }).strict(),
  }).strict().refine(
    (arena) => arena.spawn.radius + arena.spawn.spread <= Math.min(arena.width, arena.height) / 2,
    { path: ["spawn"], message: "arena.spawn: the ring does not fit the arena" },
  ),
  castle: z.object({ hp: positive, radius: positive, regenPercentPerMinute: nonNegative }).strict(),
  hero: z.object({
    collision: positive,
    baseRegen: nonNegative,
    regenPerStr: nonNegative,
    spellPowerPerInt: nonNegative,
    cooldownSpeedPerInt: nonNegative,
    dash: z.object({ distance: positive, seconds: positive, cooldownSeconds: positive }).strict(),
  }).strict(),
  autocast: z.object({
    novaMinEnemies: z.number().int().min(1),
    healBelow: z.number().min(0).max(1),
    shieldBelow: z.number().min(0).max(1),
  }).strict(),
  enemies: z.object({
    maxAlive: z.number().int().positive(),
    siegerAggroRange: positive,
    leashRange: positive,
    /** Knockback for the base attack and for an ability: initial speed = value / `seconds` (world units),
     *  fading linearly to zero over `seconds`, so the enemy travels about 0.67 × value. */
    knockback: z.object({ attack: nonNegative, ability: nonNegative, seconds: positive }).strict(),
    /** The enemy type that comes as the elite of a phase. */
    elite: Slug,
  }).strict(),
  /** Enemies come in packs: one pack is one direction and one role. */
  phases: z.array(z.object({
    /** Enemy id to weight; each member of a pack is drawn from it. */
    mix: z.record(Slug, positive).refine((mix) => Object.keys(mix).length > 0, "needs at least one enemy"),
    pack: z.object({
      min: z.number().int().min(1),
      max: z.number().int().min(1),
      everySeconds: positive,
    }).strict().refine((pack) => pack.min <= pack.max, "min is above max"),
    /** Packs sent at once in every interval, from different sides. */
    packs: z.number().int().min(1).max(3),
    /** Chance that a pack hunts the hero in place of walking to the castle. */
    hunterShare: z.number().min(0).max(1),
    /** Elites that come once, with the first pack of the first interval of the phase. */
    elites: z.number().int().min(0),
  }).strict()).min(1),
  progression: z.object({
    xpFirst: positive,
    xpStep: nonNegative,
    magnetRadius: positive,
    crystalSpeed: positive,
    pickupRadius: positive,
    attributeCardAmount: positive,
    cardsPerOffer: z.number().int().positive(),
    ultimateFromLevel: z.number().int().min(1),
    ultimateLevelStep: z.number().int().min(1),
  }).strict(),
}).strict();

export type Rules = z.infer<typeof RulesSchema>;
