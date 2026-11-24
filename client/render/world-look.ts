// The look of each world (spec 2026-11-21 difficulties 4.8): ground, light, fog, the island and forest models and the
// style of the chokepoint feature. Pure data, no `three`: the renderers read it. Colours are dark, never orange.
import {
  DIRT, GRASS_A, GRASS_B, GRASS_C, HEMI_GROUND, HEMI_SKY, MOON, PATH_COLOR, RUIN_STONE, SKY, WALL_STONE, WALL_TOP,
} from "./palette";

export type FeatureStyle = "wall" | "river" | "trees" | "ridge" | "broken";
export type Particles = "none" | "dust" | "fireflies" | "snow" | "embers";

export interface WorldLook {
  ground: { a: number; b: number; c: number; dirt: number };
  sky: number;
  fog: { near: number; far: number };
  hemi: { sky: number; ground: number; intensity: number };
  moon: { color: number; intensity: number };
  path: number;
  stone: { wall: number; top: number; ruin: number };
  /** The river (world 2); other worlds keep any value. */
  water: number;
  feature: FeatureStyle;
  islands: { rock: string[]; trees: string[]; ruin: string[] | "blocks" };
  /** The border beyond the arrival ring. */
  forest: string[];
  /** Multiplies the colour of every island and forest prop (0xffffff = none). */
  propTint: number;
  thicket: { ground: number; bush: string } | null;
  weather: { color: number; fogNear: number; fogFar: number } | null;
  /**
   * Always on in the world (fireflies, embers); "dust" runs only during the weather; "snow" falls lightly always and
   * thickly during the weather.
   */
  particles: Particles;
  /** The meteors' warning ring and pools of fire (world 5), or null. */
  fire: { ring: number; pool: number } | null;
}

/**
 * The scene size of each prop model at placement scale 1 (the kit models are tiny): the height for trees, tents and
 * stumps, the largest extent for rocks and mesas, which are wide and flat.
 */
export const PROP_SIZES: Record<string, { size: number; by: "height" | "extent" }> = {
  "tree-a": { size: 4.5, by: "height" },
  "tree-b": { size: 4.5, by: "height" },
  "trees-a": { size: 4.5, by: "height" },
  "trees-b": { size: 4.5, by: "height" },
  "trees-c": { size: 4.5, by: "height" },
  "trees-d": { size: 4.5, by: "height" },
  "rock-a": { size: 2, by: "extent" },
  "rock-b": { size: 2, by: "extent" },
  "rock-c": { size: 2, by: "extent" },
  "rock-d": { size: 2, by: "extent" },
  "mesa-a": { size: 3, by: "extent" },
  "mesa-c": { size: 3, by: "extent" },
  "stump-a": { size: 1.6, by: "height" },
  stumps: { size: 1.8, by: "height" },
  tent: { size: 2.6, by: "height" },
  bush: { size: 1.6, by: "height" },
};

/** Env models every world loads: the castle set. */
export const COMMON_ENV: readonly string[] = ["castle", "tower", "flag"];

const SILVER: WorldLook = {
  ground: { a: GRASS_A, b: GRASS_B, c: GRASS_C, dirt: DIRT },
  sky: SKY,
  fog: { near: 58, far: 105 },
  hemi: { sky: HEMI_SKY, ground: HEMI_GROUND, intensity: 1.1 },
  moon: { color: MOON, intensity: 2.2 },
  path: PATH_COLOR,
  stone: { wall: WALL_STONE, top: WALL_TOP, ruin: RUIN_STONE },
  water: 0x2e4a5c,
  feature: "wall",
  islands: { rock: ["rock-a", "rock-b", "rock-c"], trees: ["tree-a", "tree-b", "trees-a", "trees-b", "trees-c"], ruin: "blocks" },
  forest: ["tree-a", "tree-b", "trees-a", "trees-b", "trees-c", "rock-a", "rock-b", "rock-c"],
  propTint: 0xffffff,
  thicket: null,
  weather: null,
  particles: "none",
  fire: null,
};

/** Wine-red and brown-red clay, grey-pink sand and dry grass (hues 340-10°, never brick or orange). */
const RED_WASTE: WorldLook = {
  ground: { a: 0x4a2a2e, b: 0x553236, c: 0x3e2a2a, dirt: 0x5c4a46 },
  sky: 0x24161e,
  fog: { near: 52, far: 98 },
  hemi: { sky: 0xc9a6b8, ground: 0x24161c, intensity: 1.0 },
  moon: { color: 0xe6d6e6, intensity: 2.0 },
  path: 0x3c2c30,
  stone: { wall: 0x7a6670, top: 0x665660, ruin: 0x80707a },
  water: 0x2e4a5c,
  feature: "river",
  islands: { rock: ["mesa-a", "mesa-c", "rock-d", "rock-b"], trees: ["stump-a", "stumps"], ruin: ["tent"] },
  forest: ["stumps", "stump-a", "rock-d", "mesa-c"],
  propTint: 0xb4a6c4,
  thicket: null,
  weather: { color: 0x6a5056, fogNear: 34, fogFar: 78 },
  particles: "dust",
  fire: null,
};

/** Night in colours: deep blue-green ground, a cold moon, fireflies; the heroes and enemies stay readable. */
const SHADEWOOD: WorldLook = {
  ground: { a: 0x1e3236, b: 0x22383a, c: 0x1a2b30, dirt: 0x2a3338 },
  sky: 0x0b1226,
  fog: { near: 48, far: 92 },
  hemi: { sky: 0x8aa6e6, ground: 0x0e1424, intensity: 0.9 },
  moon: { color: 0xbcd2ff, intensity: 2.4 },
  path: 0x2a3440,
  stone: { wall: 0x5c6a80, top: 0x4a5668, ruin: 0x66748a },
  water: 0x2e4a5c,
  feature: "trees",
  islands: { rock: ["rock-a", "rock-c"], trees: ["trees-a", "trees-b", "trees-d", "tree-b"], ruin: "blocks" },
  forest: ["trees-a", "trees-b", "trees-d", "trees-c"],
  propTint: 0x9fb8c8,
  thicket: { ground: 0x2a1e34, bush: "bush" },
  weather: null,
  particles: "fireflies",
  fire: null,
};

/** Snow and ice in a cold blue-grey light: the snow is a mid grey-blue, so pale enemies stay readable on it. */
const FROSTREACH: WorldLook = {
  ground: { a: 0x6f8297, b: 0x7a8da2, c: 0x66788c, dirt: 0x8aa0b8 },
  sky: 0x1c2636,
  fog: { near: 50, far: 96 },
  hemi: { sky: 0xdfe9ff, ground: 0x2a3444, intensity: 1.15 },
  moon: { color: 0xe8f0ff, intensity: 2.3 },
  path: 0x4c5a6c,
  stone: { wall: 0x9fb6cc, top: 0xc8daea, ruin: 0x7f90a4 },
  water: 0x2e4a5c,
  feature: "ridge",
  islands: { rock: ["rock-a", "rock-b", "rock-c", "mesa-c"], trees: ["tree-a", "tree-b", "trees-c"], ruin: "blocks" },
  forest: ["tree-a", "tree-b", "trees-c", "rock-a", "mesa-c"],
  propTint: 0xd4e4f4,
  thicket: null,
  weather: { color: 0x9aaabe, fogNear: 32, fogFar: 76 },
  particles: "snow",
  fire: null,
};

/** Scorched black earth with sick green, a violet sky, green embers and green fire (never orange). */
const BLIGHTSCAR: WorldLook = {
  ground: { a: 0x25232a, b: 0x2b2830, c: 0x201e25, dirt: 0x2e3e26 },
  sky: 0x1a1226,
  fog: { near: 46, far: 90 },
  hemi: { sky: 0x9c96ac, ground: 0x121414, intensity: 1.0 },
  moon: { color: 0xe2deec, intensity: 2.3 },
  path: 0x2c2634,
  stone: { wall: 0x625c68, top: 0x736c7a, ruin: 0x4e4856 },
  water: 0x2e4a5c,
  feature: "broken",
  islands: { rock: ["rock-d", "rock-c", "mesa-a"], trees: ["stump-a", "stumps"], ruin: "blocks" },
  forest: ["stumps", "stump-a", "rock-d", "mesa-a"],
  propTint: 0x8c8498,
  thicket: null,
  weather: null,
  particles: "embers",
  fire: { ring: 0xc8ff4a, pool: 0x46b832 },
};

const LOOKS: Record<string, WorldLook> = {
  "silver-march": SILVER, "red-waste": RED_WASTE, shadewood: SHADEWOOD, frostreach: FROSTREACH, blightscar: BLIGHTSCAR,
};

/** The look of a world by its id; an unknown id looks like Silver March. */
export function lookOf(worldId: string): WorldLook {
  return LOOKS[worldId] ?? SILVER;
}

/** The env models a world loads besides the common set: islands, forest and the thicket's bush; unique, sorted. */
export function worldModelIds(look: WorldLook): string[] {
  const ids = new Set<string>([...look.islands.rock, ...look.islands.trees, ...look.forest]);
  if (look.islands.ruin !== "blocks") for (const id of look.islands.ruin) ids.add(id);
  if (look.thicket) ids.add(look.thicket.bush);
  return [...ids].sort();
}
