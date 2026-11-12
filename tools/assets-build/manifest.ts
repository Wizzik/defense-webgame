/** What the asset build needs: pinned CC0 sources (KayKit, Kay Lousberg) and the models cut from them. */

export type SourceKey = "adv" | "skel" | "hex";

export interface Source {
  repo: string;
  commit: string;
  root: string;
}

export const SOURCES: Record<SourceKey, Source> = {
  adv: {
    repo: "KayKit-Character-Pack-Adventures-1.0",
    commit: "672074b73ba276876a19e8816ecdc5241817ab47",
    root: "addons/kaykit_character_pack_adventures",
  },
  skel: {
    repo: "KayKit-Character-Pack-Skeletons-1.0",
    commit: "15b62b9bad122f72926c10fb14d622c73819fa54",
    root: "addons/kaykit_character_pack_skeletons",
  },
  hex: {
    repo: "KayKit-Medieval-Hexagon-Pack-1.0",
    commit: "84fa4e91af6a88989be7c99e0891cede11f2ca38",
    root: "addons/kaykit_medieval_hexagon_pack",
  },
};

export interface ModelSpec {
  /** Path under `assets/models/`. */
  out: string;
  /** `"<source key>:<path under the source root>"`. */
  source: string;
  /** Nodes to delete (with their subtree). */
  removeNodes?: string[];
  /** Heroes: every node with a mesh is deleted except the body parts and these. */
  keepNodes?: string[];
  /** Models merged in and parented to a hand slot. */
  attach?: { file: string; slot: "handslot.r" | "handslot.l" }[];
  /** New clip name -> source clip name. Other clips are deleted. */
  clips: Record<string, string>;
  maxTriangles?: number;
}

const HERO_MAX = 5000;
const ENEMY_MAX = 3000;

interface HeroRow {
  id: string;
  body: string;
  keep: string[];
  punch: string;
  attach?: ModelSpec["attach"];
}

const HEROES: HeroRow[] = [
  { id: "stonehorn", body: "Knight", keep: ["2H_Sword", "Knight_Helmet", "Knight_Cape"], punch: "2H_Melee_Attack_Chop" },
  { id: "redcleaver", body: "Barbarian", keep: ["1H_Axe", "1H_Axe_Offhand", "Barbarian_Hat"], punch: "Dualwield_Melee_Attack_Chop" },
  { id: "nightglaive", body: "Rogue_Hooded", keep: ["Knife", "Rogue_Cape"], punch: "Throw" },
  { id: "sparkshot", body: "Rogue", keep: ["2H_Crossbow"], punch: "2H_Ranged_Shoot" },
  { id: "gravecaller", body: "Mage", keep: ["2H_Staff", "Mage_Hat", "Mage_Cape"], punch: "Spellcast_Shoot" },
  { id: "mistwarden", body: "Mage", keep: ["Spellbook_open", "1H_Wand", "Mage_Hat"], punch: "Spellcasting" },
  { id: "serpent-shaman", body: "Mage", keep: ["2H_Staff"], punch: "Spellcast_Raise" },
  {
    id: "tidecaller",
    body: "Rogue_Hooded",
    keep: ["Rogue_Cape"],
    punch: "Spellcast_Shoot",
    attach: [{ file: "adv:Assets/gltf/staff.gltf", slot: "handslot.r" }],
  },
];

/** Body part nodes of a character; the hooded rogue shares the rogue's parts except the head. */
export function bodyNodes(body: string): string[] {
  const prefix = body === "Rogue_Hooded" ? "Rogue" : body;
  const head = body === "Rogue_Hooded" ? "Rogue_Head_Hooded" : `${body}_Head`;
  return [`${prefix}_Body`, head, `${prefix}_ArmLeft`, `${prefix}_ArmRight`, `${prefix}_LegLeft`, `${prefix}_LegRight`];
}

interface EnemyRow {
  id: string;
  body: string;
  remove?: string[];
  attach: { file: string; slot: "handslot.r" | "handslot.l" }[];
  walking: string;
  punch: string;
}

const skel = (name: string, slot: "handslot.r" | "handslot.l") => ({
  file: `skel:Assets/gltf/${name}.gltf`,
  slot,
});

const ENEMIES: EnemyRow[] = [
  {
    id: "shieldbearer",
    body: "Skeleton_Warrior",
    attach: [skel("Skeleton_Blade", "handslot.r"), skel("Skeleton_Shield_Large_A", "handslot.l")],
    walking: "Walking_A",
    punch: "1H_Melee_Attack_Chop",
  },
  {
    id: "scout",
    body: "Skeleton_Minion",
    attach: [skel("Skeleton_Blade", "handslot.r")],
    walking: "Running_B",
    punch: "1H_Melee_Attack_Slice_Diagonal",
  },
  {
    id: "musketeer",
    body: "Skeleton_Rogue",
    attach: [skel("Skeleton_Crossbow", "handslot.r")],
    walking: "Walking_A",
    punch: "2H_Ranged_Shoot",
  },
  {
    id: "chaplain",
    body: "Skeleton_Mage",
    attach: [skel("Skeleton_Staff", "handslot.r")],
    walking: "Walking_A",
    punch: "Spellcast_Shoot",
  },
  {
    id: "lancer",
    body: "Skeleton_Warrior",
    remove: ["Skeleton_Warrior_Helmet"],
    attach: [skel("Skeleton_Axe", "handslot.r")],
    walking: "Running_A",
    punch: "2H_Melee_Attack_Chop",
  },
  {
    id: "captain",
    body: "Skeleton_Warrior",
    attach: [skel("Skeleton_Blade", "handslot.r"), skel("Skeleton_Shield_Large_B", "handslot.l")],
    walking: "Walking_A",
    punch: "1H_Melee_Attack_Slice_Horizontal",
  },
];

/** `[out name, path under hex root without extension]` */
const ENV: [string, string][] = [
  ["castle", "buildings/blue/building_castle_blue"],
  ["tower", "buildings/blue/building_tower_A_blue"],
  ["flag", "decoration/props/flag_blue"],
  ["tree-a", "decoration/nature/tree_single_A"],
  ["tree-b", "decoration/nature/tree_single_B"],
  ["trees-a", "decoration/nature/trees_A_large"],
  ["trees-b", "decoration/nature/trees_B_large"],
  ["trees-c", "decoration/nature/trees_A_medium"],
  ["rock-a", "decoration/nature/rock_single_A"],
  ["rock-b", "decoration/nature/rock_single_C"],
  ["rock-c", "decoration/nature/rock_single_E"],
];

export const MODELS: ModelSpec[] = [
  ...HEROES.map(
    (h): ModelSpec => ({
      out: `heroes/${h.id}.glb`,
      source: `adv:Characters/gltf/${h.body}.glb`,
      keepNodes: [...bodyNodes(h.body), ...h.keep],
      attach: h.attach,
      clips: { Idle: "Idle", Running: "Running_A", Death: "Death_A", Punch: h.punch },
      maxTriangles: HERO_MAX,
    }),
  ),
  ...ENEMIES.map(
    (e): ModelSpec => ({
      out: `enemies/${e.id}.glb`,
      source: `skel:Characters/gltf/${e.body}.glb`,
      removeNodes: e.remove,
      attach: e.attach,
      clips: { Idle: "Idle", Walking: e.walking, Punch: e.punch },
      maxTriangles: ENEMY_MAX,
    }),
  ),
  ...ENV.map(
    ([name, path]): ModelSpec => ({
      out: `env/${name}.glb`,
      source: `hex:Assets/gltf/${path}.gltf`,
      clips: {},
    }),
  ),
];

export function splitRef(ref: string): { key: SourceKey; path: string } {
  const i = ref.indexOf(":");
  const key = ref.slice(0, i) as SourceKey;
  if (!(key in SOURCES)) throw new Error(`unknown source key in ${ref}`);
  return { key, path: ref.slice(i + 1) };
}
