import { z } from "zod";
import { LocalizedText, Slug } from "./common";
import { FactionId } from "./enemy";
import { EffectSchema, RaritySchema } from "./item";

export const PointSchema = z.object({ x: z.number(), y: z.number() }).strict();
export type Point = z.infer<typeof PointSchema>;

const positive = z.number().positive();
const nonNegative = z.number().min(0);

/** Weights of rarities for a draw; at least one rarity. */
export const RarityWeightsSchema = z.partialRecord(RaritySchema, positive)
  .refine((w) => Object.keys(w).length > 0, "needs at least one rarity");
export type RarityWeights = z.infer<typeof RarityWeightsSchema>;

export const DIFFICULTY_IDS = ["normal", "insane", "hell"] as const;
export type DifficultyId = (typeof DIFFICULTY_IDS)[number];

/** One difficulty: multipliers on enemy strength, extra magic find and elite rushes on top of `rules.events`. */
const DifficultyLevelSchema = z.object({
  hp: positive,
  damage: positive,
  packSize: positive,
  /** Elites and bosses get this on top of `hp`. */
  eliteHp: positive,
  magicFind: nonNegative,
  extraRushes: z.array(z.object({
    atSeconds: positive,
    elites: z.number().int().min(0),
    heavies: z.number().int().min(0),
  }).strict().refine((r) => r.elites + r.heavies > 0, "needs at least one unit")),
}).strict();

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
    dash: z.object({
      distance: positive,
      seconds: positive,
      cooldownSeconds: positive,
      /** From hero level `fromLevel` the dash holds `count` charges; a spent charge comes back after cooldownSeconds, one at a time. */
      charges: z.object({ fromLevel: z.number().int().min(1), count: z.number().int().min(2).max(5) }).strict(),
    }).strict(),
    /**
     * The blink (key F) from hero level `fromLevel`: an instant teleport to the aimed point at any distance (straight
     * ahead by `aheadDistance` without an aim), then a burst of
     * `damage` x spell power within `radius` around the landing spot that stuns for `stunSeconds`.
     */
    blink: z.object({
      fromLevel: z.number().int().min(1),
      cooldownSeconds: positive,
      aheadDistance: positive,
      radius: positive,
      damage: positive,
      stunSeconds: z.number().min(0),
    }).strict(),
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
    /** While the hero stands within this distance of the castle, every enemy goes for him instead of the castle. */
    heroDefendRange: positive,
    /** New enemies get 1 + hp (damage) x (hero level - 1) times their hp (damage), on top of the time scaling. */
    levelScaling: z.object({ hp: z.number().min(0), damage: z.number().min(0) }).strict(),
    /** Knockback for the base attack and for an ability: initial speed = value / `seconds` (world units),
     *  fading linearly to zero over `seconds`, so the enemy travels about 0.67 × value. */
    knockback: z.object({ attack: nonNegative, ability: nonNegative, seconds: positive }).strict(),
    /** A stun lasts this share of its time on a boss. */
    bossStunScale: z.number().min(0).max(1),
  }).strict(),
  /** Timed events of the run, in the order of their time: elite rushes and minibosses. */
  events: z.array(z.discriminatedUnion("kind", [
    z.object({
      atSeconds: nonNegative,
      kind: z.literal("rush"),
      /** The elite and the heavy type of the faction of the rush's phase (sim/factions.ts); elites come first. */
      elites: z.number().int().min(0),
      heavies: z.number().int().min(0),
    }).strict().refine((r) => r.elites + r.heavies > 0, "needs at least one unit"),
    z.object({ atSeconds: nonNegative, kind: z.literal("boss"), enemy: Slug }).strict(),
  ])).superRefine((events, ctx) => {
    for (let i = 1; i < events.length; i++) {
      if (events[i]!.atSeconds < events[i - 1]!.atSeconds) {
        ctx.addIssue({ code: "custom", path: [i, "atSeconds"], message: "below the event before it" });
      }
    }
  }),
  /**
   * Enemy factions by phase, ascending by `fromPhase` (1-based); the first starts at phase 1. A faction's elite comes as
   * the elite of its phases and of its rushes; its heavy type fills a rush after the elites.
   */
  factions: z.array(z.object({
    id: FactionId,
    name: LocalizedText,
    fromPhase: z.number().int().min(1),
    elite: Slug,
    heavy: Slug,
  }).strict()).min(1).superRefine((factions, ctx) => {
    if (factions[0]!.fromPhase !== 1) ctx.addIssue({ code: "custom", path: [0, "fromPhase"], message: "the first faction must start at phase 1" });
    for (let i = 1; i < factions.length; i++) {
      if (factions[i]!.fromPhase <= factions[i - 1]!.fromPhase) {
        ctx.addIssue({ code: "custom", path: [i, "fromPhase"], message: "not above the faction before it" });
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
    packs: z.number().int().min(1).max(6),
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
  /**
   * Random items (spec 2026-11-26 random items, docs/DECISIONS.md section Random items). A rolled item has the
   * base's implicit row (`implicitPoints`) and `affixCount` affix rows that share the rest of the rarity's budget:
   * row i gets (budget - implicitPoints) x weight_i / sum of weights x a roll in [1 - rowRoll, 1 + rowRoll], where
   * weight_i is the weight of the row's tier. A tier rolls only when the item power reaches its `minPower`.
   * Item power = power.boss[boss order] or chestBase + chestPerPhase x phase, + perWorld x (world - 1) +
   * difficulty; a dropped item's level is the highest whose `levelAtPower` the power reaches.
   */
  loot: z.object({
    /** Share of the affixes drawn from the hero's primary attribute's pool (the rest from all). */
    smartShare: z.number().min(0).max(1),
    /** Items the collection holds at most. */
    collectionLimit: z.number().int().positive(),
    /** Point budget of an item at level 1 (the design/items.yaml header); named items are held to it by the tests. */
    budget: z.object({ common: positive, rare: positive, epic: positive, legendary: positive, mythic: positive }).strict(),
    implicitPoints: positive,
    rowRoll: z.number().min(0).max(0.5),
    affixCount: z.object({
      common: z.number().int().min(1), rare: z.number().int().min(1), epic: z.number().int().min(1),
      legendary: z.number().int().min(1), mythic: z.number().int().min(1),
    }).strict(),
    /** Share of a drop or chest card of the rarity that is a named item instead of a rolled one. */
    namedShare: z.object({
      common: z.number().min(0).max(1), rare: z.number().min(0).max(1), epic: z.number().min(0).max(1),
      legendary: z.number().min(0).max(1), mythic: z.number().min(0).max(1),
    }).strict(),
    /**
     * Share of the chest cards drawn for a slot that already wears the drawn rarity or a higher one that become a
     * Level card of the worn item; the rest move to a slot where the rarity is an upgrade (sim/chests.ts).
     */
    upgradeShare: z.number().min(0).max(1),
    /** Gold a salvaged item of the rarity gives for the next run's chests. */
    salvageGold: z.object({
      common: nonNegative, rare: nonNegative, epic: nonNegative, legendary: nonNegative, mythic: nonNegative,
    }).strict(),
    /** The most salvage gold the bank keeps; the next solo run starts with it. */
    bankLimit: z.number().int().nonnegative(),
    /** T1-T4 from the lowest; a higher tier is a bigger share of the budget. */
    tiers: z.array(z.object({ weight: positive, minPower: nonNegative }).strict()).length(4)
      .refine((t) => t.every((tier, i) => i === 0 || (tier.weight > t[i - 1]!.weight && tier.minPower > t[i - 1]!.minPower)), {
        message: "tier weights and minPower must rise",
      }),
    power: z.object({
      /** By the boss's order in the run (rules.drops). */
      boss: z.array(nonNegative).min(1),
      chestBase: nonNegative,
      chestPerPhase: nonNegative,
      perWorld: nonNegative,
      difficulty: z.object({ normal: nonNegative, insane: nonNegative, hell: nonNegative }).strict(),
    }).strict(),
    /** The least item power of item levels 1, 2, ... (one value per level up to gear.maxPermanentLevel). */
    levelAtPower: z.array(nonNegative).min(1)
      .refine((l) => l[0] === 0 && l.every((v, i) => i === 0 || v > l[i - 1]!), { message: "must start at 0 and rise" }),
    /** Extra damage of a critical basic attack before gear adds crit damage (0.5: a crit deals 150 %). */
    critDamage: positive,
    /** The most the summed gear gives of these shares (sim/hero.ts heroStats). */
    caps: z.object({ critChance: z.number().gt(0).max(1), dodge: z.number().gt(0).max(1), damageTaken: z.number().gt(0).max(1) }).strict(),
    /** The effect a mythic roll draws one of (sim/gear-effects.ts), with its fixed numbers. */
    mythicEffects: z.array(EffectSchema).min(1),
  }).strict(),
  /** What a boss drops: the rarity is drawn by these weights. */
  drops: z.array(z.object({
    boss: Slug,
    weights: RarityWeightsSchema,
  }).strict()),
  progression: z.object({
    xpFirst: positive,
    xpStep: nonNegative,
    /** XP to leave a level grows by this x (level - 1)^2 on top of the step (Petr's batch 3); none when left out. */
    xpQuad: nonNegative.optional(),
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
  /**
   * Difficulties and worlds (spec 2026-11-21 4.2, sim/difficulty.ts): enemy hp and damage x level x
   * (1 + worldStep x (world - 1)); gold x (1 + goldPerWorld x (world - 1)); magic find + magicFindPerWorld x
   * (world - 1) + level.magicFind.
   */
  difficulty: z.object({
    worldStep: z.object({ hp: nonNegative, damage: nonNegative }).strict(),
    reward: z.object({ goldPerWorld: nonNegative, magicFindPerWorld: nonNegative }).strict(),
    levels: z.object({ normal: DifficultyLevelSchema, insane: DifficultyLevelSchema, hell: DifficultyLevelSchema }).strict(),
  }).strict(),
  /**
   * Co-op (multiplayer migration step 6, sim/difficulty.ts, sim/revive.ts): with n players enemy hp, damage, pack
   * sizes, elite hp and the castle's hp (`castleHp`, step 8) are each x (1 + perPlayer.x x (n - 1)) on top of the
   * difficulty; `chests` more chests lie on
   * the map per extra player. A fallen hero is revived by a living teammate within `revive.radius` for
   * `revive.seconds`, back at `revive.hpShare` of his max hp. One player: all of it is x 1.
   */
  coop: z.object({
    perPlayer: z.object({
      hp: nonNegative, damage: nonNegative, packSize: nonNegative, eliteHp: nonNegative, castleHp: nonNegative,
      chests: z.number().int().min(0).max(4),
    }).strict(),
    revive: z.object({ seconds: positive, radius: positive, hpShare: z.number().gt(0).max(1) }).strict(),
  }).strict(),
}).strict();

export type Rules = z.infer<typeof RulesSchema>;
