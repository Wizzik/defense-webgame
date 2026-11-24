import { z } from "zod";
import { LocalizedText, Slug } from "./common";

const finite = z.number().finite();
const positive = z.number().positive();
const nonNegative = z.number().nonnegative();
const share = z.number().min(0).max(1);
const Point = z.tuple([finite, finite]);

/** A min-max range whose max is not below its min. */
function range(value: z.ZodNumber) {
  return z.object({ min: value, max: value }).strict()
    .refine((r: { min: number; max: number }) => r.max >= r.min, { message: "max must not be below min", path: ["max"] });
}

/**
 * The fixed skeleton of a world's map (spec 2026-11-21 difficulties 4.5): paths, the chokepoint feature (a wall of
 * thick segments) and the rules for the islands placed from the run seed. North is +y.
 */
export const WorldMapSchema = z.object({
  paths: z.object({
    width: positive,
    /** Move speed bonus on a path, a share (0.15 = +15 %). */
    speedBonus: share,
    lines: z.array(z.array(Point).min(2)),
  }).strict(),
  feature: z.object({
    thickness: positive,
    /** [x1, y1, x2, y2] of each segment. */
    segments: z.array(z.tuple([finite, finite, finite, finite])).min(1),
  }).strict(),
  islands: z.object({
    count: range(z.number().int().nonnegative()),
    radius: range(positive),
    gap: nonNegative,
    kinds: z.object({ rock: nonNegative, trees: nonNegative, ruin: nonNegative }).strict()
      .refine((k) => k.rock + k.trees + k.ruin > 0, { message: "the island kind weights must sum above 0" }),
  }).strict(),
  /** Zones kept free of islands. */
  clear: z.object({
    castle: positive,
    ringInner: positive,
    ringOuter: positive,
    pathMargin: nonNegative,
    featureMargin: nonNegative,
  }).strict().refine((c) => c.ringOuter > c.ringInner, { message: "ringOuter must be beyond ringInner", path: ["ringOuter"] }),
}).strict();
export type WorldMap = z.infer<typeof WorldMapSchema>;

/** The fields of a hazard that strikes in waves after warning circles (the storm and the meteors). */
const strikeFields = {
  fromPhase: z.number().int().min(1),
  everySeconds: range(positive),
  /** Strikes per wave around every living hero. */
  bolts: range(z.number().int().min(1)),
  spread: nonNegative,
  warnSeconds: positive,
  radius: positive,
  heroShare: share,
  enemyShare: share,
  bossShare: share,
  name: LocalizedText,
};
/** Bolts after a warning circle, in waves from a phase on (spec 4.7). Shares are of the target's max hp. */
export const StormSchema = z.object({ kind: z.literal("storm"), ...strikeFields }).strict();
/**
 * Green meteors (spec 4.7 point 5): waves like the storm's, and every strike leaves a pool of fire for pool.seconds
 * that burns heroes and enemies inside it by a share of their max hp a second.
 */
export const MeteorsSchema = z.object({
  kind: z.literal("meteors"),
  ...strikeFields,
  pool: z.object({
    seconds: positive,
    radius: positive,
    heroSharePerSecond: share,
    enemySharePerSecond: share,
    bossSharePerSecond: share,
  }).strict(),
}).strict();
/**
 * A timed natural event that slows the walking of everyone while it runs (spec 4.7 point 2): a warning warnSeconds
 * ahead, then durationSeconds of weather, in gaps of everySeconds from fromPhase on. moveSlow is a share (0.2 = -20 %).
 */
export const WeatherSchema = z.object({
  kind: z.literal("weather"),
  effect: z.enum(["sand", "snow"]),
  fromPhase: z.number().int().min(1),
  everySeconds: range(positive),
  durationSeconds: positive,
  warnSeconds: positive,
  moveSlow: share,
  /** A hero standing still stillSeconds in the weather is chilled: his base attacks are slower by attackSlow (a share). */
  chill: z.object({ stillSeconds: positive, attackSlow: share }).strict().optional(),
  name: LocalizedText,
}).strict();
/** Fixed zones of brake that slow walking inside them by `slow` (spec 4.7 point 3); [x, y, r] of each zone. */
export const ThicketSchema = z.object({
  kind: z.literal("thicket"),
  slow: share,
  zones: z.array(z.tuple([finite, finite, positive])).min(1),
  name: LocalizedText,
}).strict();
export const HazardSchema = z.discriminatedUnion("kind", [StormSchema, WeatherSchema, ThicketSchema, MeteorsSchema]);
export type Hazard = z.infer<typeof HazardSchema>;
export type Storm = z.infer<typeof StormSchema>;
export type Weather = z.infer<typeof WeatherSchema>;
export type Thicket = z.infer<typeof ThicketSchema>;
export type Meteors = z.infer<typeof MeteorsSchema>;

/** One world of the ladder (design/worlds.yaml); its place in the list is its number, 1-based. */
export const WorldSchema = z.object({
  id: Slug,
  name: LocalizedText,
  /** One sentence shown under the world's card. */
  blurb: LocalizedText,
  /** Card colour, a lowercase hex. */
  color: z.string().regex(/^#[0-9a-f]{6}$/, "expected a lowercase hex colour like #1f3a44"),
  /** False: playable with the look of world 1 and marked "coming soon". */
  ready: z.boolean(),
  /** Enemy hp and damage x this on top of the difficulty's world step (default 1): tunes one world of the ladder. */
  strength: z.number().positive().optional(),
  map: WorldMapSchema,
  hazard: HazardSchema,
}).strict();
export type World = z.infer<typeof WorldSchema>;

/** The world's hazard that strikes in waves (the summer storm or the meteors), or null for a weather or a thicket. */
export function stormOf(world: World): Storm | Meteors | null {
  return world.hazard.kind === "storm" || world.hazard.kind === "meteors" ? world.hazard : null;
}
