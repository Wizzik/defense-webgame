import { z } from "zod";
import { Slug } from "./common";

export const AudioCategory = z.enum(["sfx", "ui", "music"]);

/** Methods of the synthesizer in `client/audio/sfx.ts`: the fallback when a cue's files do not load. */
export const SYNTH_NAMES = [
  "hit", "cast", "death", "pickup", "coin", "heart", "orb", "chest",
  "levelUp", "castleHit", "bossArrive", "slam", "enrage",
] as const;
export const SynthName = z.enum(SYNTH_NAMES);
export type SynthName = z.infer<typeof SynthName>;

/** Sounds of the game that belong to no ability, hero or enemy. */
export const GAME_SOUNDS = [
  "pickup.xp", "pickup.coin", "pickup.heart", "orb.boots", "orb.berserk", "orb.heal",
  "chest.open", "chest.pick", "levelUp", "heroHit", "heroHeal", "dash", "castleHit",
  "bossArrive", "bossDeath", "rushWarning", "slam.warn", "slam.hit", "enrage",
  "enemy.heal", "enemy.charge", "drop.legendary", "drop.mythic", "gear.equip", "lowHp", "ui.click",
] as const;
export type GameSound = (typeof GAME_SOUNDS)[number];

/** A named sound: recorded variants (paths under `assets/`) and how they are mixed. */
export const CueSchema = z.object({
  id: Slug,
  files: z.array(z.string().min(1)),
  synth: SynthName.optional(),
  gainDb: z.number().default(0),
  pitchSpread: z.number().min(0).max(0.5).default(0.06),
  gainSpreadDb: z.number().min(0).max(12).default(2),
  maxVoices: z.number().int().min(1).max(16).default(4),
  priority: z.number().int().min(0).max(3).default(1),
  category: AudioCategory.default("sfx"),
}).strict().refine((c) => c.files.length > 0 || c.synth !== undefined, {
  message: "a cue needs files or synth",
});
export type Cue = z.infer<typeof CueSchema>;

export const TrackSchema = z.object({
  id: Slug,
  file: z.string().min(1),
  gainDb: z.number().default(0),
  loop: z.boolean().default(true),
}).strict();
export type Track = z.infer<typeof TrackSchema>;

const CueRef = z.string().min(1);

export const MusicSchema = z.object({
  menu: CueRef,
  run: z.array(CueRef).min(1).max(3),
  miniboss: CueRef,
  final: CueRef,
  victory: CueRef,
  defeat: CueRef,
}).strict();
export type Music = z.infer<typeof MusicSchema>;

export const AudioDataSchema = z.object({
  cues: z.array(CueSchema),
  tracks: z.array(TrackSchema),
  abilities: z.record(z.string(), z.object({ cast: CueRef, hit: CueRef.optional() }).strict()),
  heroes: z.record(z.string(), z.object({ attack: CueRef, attackHit: CueRef.optional() }).strict()),
  enemies: z.record(z.string(), z.object({ death: CueRef, attack: CueRef.optional() }).strict()),
  sounds: z.object(Object.fromEntries(GAME_SOUNDS.map((s) => [s, CueRef])) as Record<GameSound, typeof CueRef>).strict(),
  /** Optional until the music is chosen (plan Task 10). */
  music: MusicSchema.optional(),
}).strict();
export type AudioData = z.infer<typeof AudioDataSchema>;
