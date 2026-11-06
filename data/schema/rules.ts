import { z } from "zod";
import { Slug } from "./common";

export const PointSchema = z.object({ x: z.number(), y: z.number() }).strict();
export type Point = z.infer<typeof PointSchema>;

const positive = z.number().positive();
const nonNegative = z.number().min(0);

export const RulesSchema = z.object({
  slice: z.object({ hero: Slug, ability: Slug }).strict(),
  run: z.object({
    durationSeconds: positive,
    phaseSeconds: positive,
    timeScaling: z.object({ seconds: positive, cap: z.number().min(1) }).strict(),
  }).strict(),
  arena: z.object({
    width: positive,
    height: positive,
    castle: PointSchema,
    heroStart: PointSchema,
    gates: z.array(PointSchema).min(1),
    gateRadius: positive,
  }).strict(),
  castle: z.object({ hp: positive, radius: positive, regenPercentPerMinute: nonNegative }).strict(),
  hero: z.object({
    collision: positive,
    baseRegen: nonNegative,
    regenPerStr: nonNegative,
    spellPowerPerInt: nonNegative,
    cooldownSpeedPerInt: nonNegative,
  }).strict(),
  enemies: z.object({
    maxAlive: z.number().int().positive(),
    siegerAggroRange: positive,
    leashRange: positive,
  }).strict(),
  phases: z.array(z.object({
    enemy: Slug,
    spawnPerSecond: positive,
    hunterShare: z.number().min(0).max(1),
  }).strict()).min(1),
  progression: z.object({
    xpFirst: positive,
    xpStep: nonNegative,
    magnetRadius: positive,
    crystalSpeed: positive,
    pickupRadius: positive,
    attributeCardAmount: positive,
    cardsPerOffer: z.number().int().positive(),
  }).strict(),
}).strict();

export type Rules = z.infer<typeof RulesSchema>;
