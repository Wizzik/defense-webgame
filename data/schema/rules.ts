import { z } from "zod";
import { Slug } from "./common";
import { RaritySchema } from "./item";

export const PointSchema = z.object({ x: z.number(), y: z.number() }).strict();
export type Point = z.infer<typeof PointSchema>;

const positive = z.number().positive();
const nonNegative = z.number().min(0);

/** Weights of rarities for a draw; at least one rarity. */
export const RarityWeightsSchema = z.partialRecord(RaritySchema, positive)
  .refine((w) => Object.keys(w).length > 0, "needs at least one rarity");
export type RarityWeights = z.infer<typeof RarityWeightsSchema>;

export const RulesSchema = z.object({
  start: z.object({ hero: Slug }).strict(),
  run: z.object({
    durationSeconds: positive,
    phaseSeconds: positive,
    /** The first pack of the run comes at this time. */
    firstPackSeconds: nonNegative,
    timeScaling: z.object({ seconds: positive, cap: z.number().min(1) }).strict(),
    /** An elite rush is announced this long before it comes. */
    rushWarningSeconds: nonNegative,
    /** The final boss comes at `durationSeconds`; the run is won when it falls. */
    finale: z.object({
      boss: Slug,
      /** Pack sizes of the last phase are multiplied by this while the finale lasts. */
      packScale: positive.max(1),
      /** Counted from the arrival of the final boss. */
      enrageAfterSeconds: positive,
      enrage: z.object({ damage: positive, moveSpeed: positive, slamCooldown: positive }).strict(),
    }).strict(),
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
    /** A stun lasts this share of its time on a boss. */
    bossStunScale: z.number().min(0).max(1),
  }).strict(),
  /** Timed events of the run, in the order of their time: elite rushes and minibosses. */
  events: z.array(z.discriminatedUnion("kind", [
    z.object({
      atSeconds: nonNegative,
      kind: z.literal("rush"),
      /** Enemy id to count; the members come in the order of the keys. */
      units: z.record(Slug, z.number().int().min(1)).refine((u) => Object.keys(u).length > 0, "needs at least one unit"),
    }).strict(),
    z.object({ atSeconds: nonNegative, kind: z.literal("boss"), enemy: Slug }).strict(),
  ])).superRefine((events, ctx) => {
    for (let i = 1; i < events.length; i++) {
      if (events[i]!.atSeconds < events[i - 1]!.atSeconds) {
        ctx.addIssue({ code: "custom", path: [i, "atSeconds"], message: "below the event before it" });
      }
    }
  }),
  /** Values for debug tools only. `phaseXp[n]` is the XP a hero has at the start of phase n + 1 (`?phase`). */
  debug: z.object({
    phaseXp: z.array(nonNegative).superRefine((xp, ctx) => {
      for (let i = 1; i < xp.length; i++) {
        if (xp[i]! < xp[i - 1]!) ctx.addIssue({ code: "custom", path: [i], message: "below the value before it" });
      }
    }),
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
  /** Multiplier on all damage enemies deal to the hero (not to the castle). */
  threat: z.object({ heroDamageTaken: positive }).strict(),
  /**
   * Sustain (spec 2026-11-19): lifesteal from gear with a cap per second, hearts dropped by enemies and orbs on the map
   * whose effects last buffSeconds (sim/buffs.ts, sim/orbs.ts).
   */
  sustain: z.object({
    buffSeconds: positive,
    /** Lifesteal heals at most capPerSecond x max hp in one second. */
    lifesteal: z.object({ capPerSecond: z.number().positive().max(1) }).strict(),
    /** A common enemy drops a heart with `chance` (elites and bosses always); a heart heals healShare x max hp. */
    hearts: z.object({ chance: z.number().positive().max(1), healShare: z.number().positive().max(1) }).strict(),
    orbs: z.object({
      maxOnMap: z.number().int().min(1).max(8),
      /** When each orb place first spawns its orb; one value per place. */
      firstSeconds: z.array(nonNegative),
      respawnSeconds: z.object({ min: positive, max: positive }).strict()
        .refine((r) => r.min <= r.max, "min is above max"),
      minCastleDistance: nonNegative,
      maxCastleDistance: positive,
      minSpacing: nonNegative,
      chestSpacing: nonNegative,
      pickupRadius: positive,
    }).strict()
      .refine((o) => o.firstSeconds.length === o.maxOnMap, { path: ["firstSeconds"], message: "needs one value per orb place (maxOnMap)" })
      .refine((o) => o.minCastleDistance < o.maxCastleDistance, { path: ["minCastleDistance"], message: "minCastleDistance is not below maxCastleDistance" }),
    boots: z.object({ moveSpeed: positive }).strict(),
    berserk: z.object({ damage: positive }).strict(),
    heal: z.object({ share: positive }).strict(),
  }).strict(),
  /**
   * Item numbers with permanent level B and chest levels T: the level-1 numbers x
   * (1 + levelStep x max(B - 1, 0) + chestLevelStep x T); an item a chest gave has B = 0.
   */
  gear: z.object({ levelStep: nonNegative, chestLevelStep: nonNegative, maxPermanentLevel: z.number().int().min(1) }).strict(),
  /** `count` chests lie on the map; the n-th one opened costs basePrice x priceGrowth^(n - 1) gold. */
  chests: z.object({
    count: z.number().int().min(1).max(8),
    basePrice: positive,
    priceGrowth: z.number().min(1),
    minCastleDistance: nonNegative,
    maxCastleDistance: positive,
    minSpacing: nonNegative,
    pickupRadius: positive,
    slotsPerOffer: z.number().int().min(1).max(16),
    /** Weights of the rarity each card of an offer rolls, before magic find. */
    rarityWeights: RarityWeightsSchema,
  }).strict().refine((c) => c.minCastleDistance < c.maxCastleDistance, "minCastleDistance is not below maxCastleDistance"),
  /**
   * Magic find: effective = MF x limit / (MF + limit); every rarity above the lowest of a weight table is
   * multiplied by (1 + effective x rarityFactor[rarity]) (sim/magic-find.ts).
   */
  magicFind: z.object({
    limit: positive,
    rarityFactor: z.object({ rare: nonNegative, epic: nonNegative, legendary: nonNegative, mythic: nonNegative }).strict(),
  }).strict(),
  /** What a boss drops: the rarity is drawn by these weights. */
  drops: z.array(z.object({
    boss: Slug,
    weights: RarityWeightsSchema,
  }).strict()),
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
    sharedSpells: z.array(Slug).min(1),
    passives: z.array(Slug).min(1),
    sharedSpellSlots: z.number().int().min(0),
    passiveSlots: z.number().int().min(0),
    cardWeights: z.object({
      signature: positive,
      sharedUpgrade: positive,
      newSpell: positive,
      newPassive: positive,
    }).strict(),
  }).strict(),
}).strict();

export type Rules = z.infer<typeof RulesSchema>;
