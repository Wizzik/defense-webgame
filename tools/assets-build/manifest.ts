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
  // new heroes, batch 1 (2026-11-28)
  { id: "razorwind", body: "Knight", keep: ["1H_Sword", "1H_Sword_Offhand", "Knight_Helmet"], punch: "Dualwield_Melee_Attack_Slice" },
  { id: "dawnhammer", body: "Knight", keep: ["1H_Sword", "Rectangle_Shield", "Knight_Cape"], punch: "1H_Melee_Attack_Chop" },
  { id: "frostweaver", body: "Mage", keep: ["1H_Wand", "Spellbook", "Mage_Cape"], punch: "Spellcast_Shoot" },
  { id: "deadeye", body: "Rogue_Hooded", keep: ["1H_Crossbow", "Rogue_Cape"], punch: "1H_Ranged_Shoot" },
  // new heroes, batch 2 (2026-11-28)
  { id: "ashsinger", body: "Mage", keep: ["2H_Staff", "Mage_Cape"], punch: "Spellcast_Raise" },
  { id: "thunderhoof", body: "Barbarian", keep: ["2H_Axe", "Barbarian_Cape"], punch: "2H_Melee_Attack_Chop" },
  { id: "stormseer", body: "Mage", keep: ["Spellbook_open", "Mage_Cape"], punch: "Spellcasting" },
  { id: "mirrorblade", body: "Rogue", keep: ["Knife", "Knife_Offhand", "Rogue_Cape"], punch: "Dualwield_Melee_Attack_Slice" },
  // new heroes, batch 3 (2026-11-28)
  { id: "lightbinder", body: "Mage", keep: ["1H_Wand", "Spellbook_open", "Mage_Cape"], punch: "Spellcasting" },
  { id: "skyweaver", body: "Mage", keep: ["2H_Staff", "Mage_Hat", "Spellbook"], punch: "Spellcast_Raise" },
  { id: "ironroar", body: "Barbarian", keep: ["1H_Axe", "Barbarian_Hat", "Barbarian_Cape"], punch: "1H_Melee_Attack_Chop" },
  { id: "stonebeard", body: "Barbarian", keep: ["1H_Axe", "Barbarian_Round_Shield", "Barbarian_Cape"], punch: "1H_Melee_Attack_Chop" },
  // new heroes, batch 4 (2026-11-28)
  { id: "rimebreaker", body: "Knight", keep: ["2H_Sword", "Knight_Cape"], punch: "2H_Melee_Attack_Slice" },
  { id: "arcfang", body: "Mage", keep: ["1H_Wand", "Spellbook_open"], punch: "Spellcast_Shoot" },
  { id: "emberclaw", body: "Rogue_Hooded", keep: ["1H_Crossbow"], punch: "1H_Ranged_Shoot" },
  { id: "galestrider", body: "Barbarian", keep: ["2H_Axe"], punch: "2H_Melee_Attack_Slice" },
];

/** Body part nodes of a character; the hooded rogue shares the rogue's parts except the head. */
export function bodyNodes(body: string): string[] {
  const prefix = body === "Rogue_Hooded" ? "Rogue" : body;
  const head = body === "Rogue_Hooded" ? "Rogue_Head_Hooded" : `${body}_Head`;
  return [`${prefix}_Body`, head, `${prefix}_ArmLeft`, `${prefix}_ArmRight`, `${prefix}_LegLeft`, `${prefix}_LegRight`];
}

/**
 * An enemy model: an adventurer body (`adv`: humans, orcs, elves) keeps its body parts and the named parts of its own
 * file, a skeleton body (`skel`: the undead) gets weapons attached to its hands (spec 2026-11-20, 4.6).
 */
interface EnemyRow {
  id: string;
  src: "adv" | "skel";
  body: string;
  /** adv: parts of the body's file to keep besides the body. */
  keep?: string[];
  /** skel: nodes to delete. */
  remove?: string[];
  attach?: { file: string; slot: "handslot.r" | "handslot.l" }[];
  walking: string;
  punch: string;
}

const skel = (name: string, slot: "handslot.r" | "handslot.l") => ({
  file: `skel:Assets/gltf/${name}.gltf`,
  slot,
});

const ENEMIES: EnemyRow[] = [
  // Human Legion: knights, rogues and a priest
  { id: "shieldbearer", src: "adv", body: "Knight", keep: ["1H_Sword", "Round_Shield", "Knight_Helmet"], walking: "Walking_A", punch: "1H_Melee_Attack_Chop" },
  { id: "scout", src: "adv", body: "Rogue", keep: ["Knife"], walking: "Running_B", punch: "1H_Melee_Attack_Slice_Diagonal" },
  { id: "musketeer", src: "adv", body: "Rogue", keep: ["2H_Crossbow", "Rogue_Cape"], walking: "Walking_A", punch: "2H_Ranged_Shoot" },
  { id: "chaplain", src: "adv", body: "Mage", keep: ["Spellbook", "Mage_Cape"], walking: "Walking_A", punch: "Spellcast_Shoot" },
  { id: "lancer", src: "adv", body: "Knight", keep: ["2H_Sword", "Knight_Helmet"], walking: "Running_A", punch: "2H_Melee_Attack_Stab" },
  { id: "captain", src: "adv", body: "Knight", keep: ["1H_Sword", "Badge_Shield", "Knight_Helmet", "Knight_Cape"], walking: "Walking_A", punch: "1H_Melee_Attack_Slice_Horizontal" },
  // Blood Clan: barbarians, a hooded thrower and a caster
  { id: "brute", src: "adv", body: "Barbarian", keep: ["1H_Axe", "Barbarian_Round_Shield"], walking: "Walking_A", punch: "1H_Melee_Attack_Chop" },
  { id: "spearthrower", src: "adv", body: "Rogue_Hooded", keep: ["Throwable"], walking: "Walking_A", punch: "Throw" },
  { id: "hornback", src: "adv", body: "Barbarian", keep: ["2H_Axe", "Barbarian_Hat"], walking: "Running_A", punch: "2H_Melee_Attack_Chop" },
  { id: "bloodcaller", src: "adv", body: "Mage", keep: ["1H_Wand"], walking: "Walking_A", punch: "Spellcast_Raise" },
  { id: "warlord", src: "adv", body: "Barbarian", keep: ["2H_Axe", "Barbarian_Hat", "Barbarian_Cape"], walking: "Walking_A", punch: "2H_Melee_Attack_Slice" },
  // Restless Dead: the skeletons
  { id: "ghoul", src: "skel", body: "Skeleton_Minion", walking: "Running_B", punch: "Unarmed_Melee_Attack_Punch_A" },
  { id: "webcrawler", src: "skel", body: "Skeleton_Rogue", attach: [skel("Skeleton_Crossbow", "handslot.r")], walking: "Walking_A", punch: "2H_Ranged_Shoot" },
  {
    id: "rotgut", src: "skel", body: "Skeleton_Warrior", remove: ["Skeleton_Warrior_Helmet"],
    attach: [skel("Skeleton_Axe", "handslot.r")], walking: "Walking_D_Skeletons", punch: "2H_Melee_Attack_Chop",
  },
  { id: "gravebinder", src: "skel", body: "Skeleton_Mage", attach: [skel("Skeleton_Staff", "handslot.r")], walking: "Walking_A", punch: "Spellcast_Summon" },
  { id: "risen", src: "skel", body: "Skeleton_Minion", remove: ["Skeleton_Minion_Cloak"], walking: "Walking_D_Skeletons", punch: "Unarmed_Melee_Attack_Punch_B" },
  {
    id: "bone-tyrant", src: "skel", body: "Skeleton_Warrior",
    attach: [skel("Skeleton_Axe", "handslot.r"), skel("Skeleton_Shield_Large_B", "handslot.l")], walking: "Walking_A", punch: "1H_Melee_Attack_Chop",
  },
  // Moon Grove: hooded rogues, knights of stone and a staff druid
  { id: "huntress", src: "adv", body: "Rogue_Hooded", keep: ["Knife", "Knife_Offhand"], walking: "Running_A", punch: "Throw" },
  { id: "moon-archer", src: "adv", body: "Rogue", keep: ["1H_Crossbow", "Knife_Offhand"], walking: "Walking_A", punch: "1H_Ranged_Shoot" },
  { id: "stone-warden", src: "adv", body: "Knight", keep: ["1H_Sword", "Rectangle_Shield", "Knight_Helmet"], walking: "Walking_B", punch: "1H_Melee_Attack_Stab" },
  { id: "grove-druid", src: "adv", body: "Mage", keep: ["2H_Staff", "Mage_Hat"], walking: "Walking_A", punch: "Spellcasting" },
  { id: "grove-warden", src: "adv", body: "Knight", keep: ["1H_Sword", "Spike_Shield", "Knight_Cape"], walking: "Walking_A", punch: "1H_Melee_Attack_Slice_Diagonal" },
  // casters of the four factions (Petr's batch 2): a mage, a barbarian with a staff, a skeleton rogue with a staff,
  // a caped rogue with a staff
  { id: "battle-mage", src: "adv", body: "Mage", keep: ["1H_Wand", "Mage_Hat", "Mage_Cape"], walking: "Walking_A", punch: "Spellcast_Shoot" },
  {
    id: "fire-caller", src: "adv", body: "Barbarian", keep: ["Barbarian_Hat"],
    attach: [{ file: "adv:Assets/gltf/staff.gltf", slot: "handslot.r" }], walking: "Walking_A", punch: "Spellcast_Shoot",
  },
  { id: "bone-acolyte", src: "skel", body: "Skeleton_Rogue", attach: [skel("Skeleton_Staff", "handslot.r")], walking: "Walking_A", punch: "Spellcast_Shoot" },
  {
    id: "moon-priestess", src: "adv", body: "Rogue", keep: ["Rogue_Cape"],
    attach: [{ file: "adv:Assets/gltf/staff.gltf", slot: "handslot.r" }], walking: "Walking_A", punch: "Spellcasting",
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
  // Red Waste and Shadewood (difficulties plan 3a)
  ["mesa-a", "decoration/nature/mountain_A"],
  ["mesa-c", "decoration/nature/mountain_C"],
  ["rock-d", "decoration/nature/rock_single_D"],
  ["stump-a", "decoration/nature/tree_single_A_cut"],
  ["stumps", "decoration/nature/trees_A_cut"],
  ["tent", "decoration/props/tent"],
  ["bush", "decoration/nature/trees_A_small"],
  ["trees-d", "decoration/nature/trees_B_medium"],
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
      source: e.src === "adv" ? `adv:Characters/gltf/${e.body}.glb` : `skel:Characters/gltf/${e.body}.glb`,
      ...(e.src === "adv" ? { keepNodes: [...bodyNodes(e.body), ...(e.keep ?? [])] } : {}),
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
