/**
 * The colour of every item's picture (Petr, 2026-11-28): the picture shows what the item is made of or stands for,
 * and only the frame around it carries the rarity. A random item takes its base's colour (`rolled-<base id>`).
 * Colours by material: iron and plate steel-grey, leather brown, silk lilac, silver pale, gold yellow, and so on.
 */
const IRON = "#a9b6c4";
const STEEL = "#c9d4e0";
const LEATHER = "#c08a58";
const DARK_LEATHER = "#9a6c46";
const SILK = "#c9a8f0";
const CLOTH = "#c9bfa2";
const SILVER = "#e4eaf1";
const GOLD = "#f2c14e";
const COPPER = "#d98b5f";
const BRASS = "#d4b26a";
const BONE = "#e6dcc2";
const OAK = "#b0864f";
const STONE = "#a9a196";
const JADE = "#5fd39a";
const MOON = "#a8d8ff";
const NIGHT = "#8f92e0";
const STAR = "#b7a6ff";
const SEA = "#4fc3f7";
const STORM = "#7fd8ff";
const FROST = "#bdefff";
const RUNE = "#6fb7ff";
const EMERALD = "#3fcf86";
const ROYAL = "#c58cff";
const BLOOD = "#e2475a";
const FOREST = "#86c26a";
const EARTH = "#b99a6b";
const RAVEN = "#7d86a8";
const CRIMSON = "#d9606e";
const SKY = "#9fd0ff";

export const ITEM_TINTS: Record<string, string> = {
  // bases (design/item-bases.yaml)
  "iron-helm": IRON,
  "leather-cap": LEATHER,
  "silk-hood": SILK,
  "iron-torc": IRON,
  "fang-necklace": BONE,
  "crystal-pendant": FROST,
  "silver-chain": SILVER,
  "plate-pauldrons": STEEL,
  "leather-spaulders": LEATHER,
  "silk-mantle": SILK,
  "war-cape": CRIMSON,
  "hunters-cloak": FOREST,
  "woven-shawl": CLOTH,
  chainmail: STEEL,
  "leather-jerkin": LEATHER,
  "silk-robe": SILK,
  "iron-vambraces": IRON,
  "leather-wraps": DARK_LEATHER,
  "silver-bangle": SILVER,
  "iron-gauntlets": IRON,
  "leather-gloves": LEATHER,
  "silk-gloves": SILK,
  "plated-belt": STEEL,
  "leather-belt": LEATHER,
  "silk-sash": SILK,
  "plate-greaves": STEEL,
  "leather-leggings": LEATHER,
  "silk-trousers": SILK,
  "iron-sabatons": IRON,
  "soft-boots": DARK_LEATHER,
  "cloth-slippers": CLOTH,
  "iron-ring": IRON,
  "jade-ring": JADE,
  "moonstone-ring": MOON,
  "gold-ring": GOLD,
  "war-horn": BONE,
  "bone-dice": BONE,
  "rune-stone": RUNE,
  "old-coin": BRASS,
  broadsword: STEEL,
  "curved-dagger": SILVER,
  "oak-staff": OAK,
  "iron-mace": IRON,
  "tower-shield": STEEL,
  "parrying-knife": SILVER,
  "spell-tome": ROYAL,
  // named items (design/items.yaml)
  "travelers-hood": EARTH,
  "copper-pendant": COPPER,
  "padded-mantle": CLOTH,
  "road-cloak": EARTH,
  "quilted-vest": CLOTH,
  "leather-bracers": LEATHER,
  "work-gloves": DARK_LEATHER,
  "rope-belt": CLOTH,
  "patched-trousers": EARTH,
  "walking-boots": LEATHER,
  "tin-ring": IRON,
  "lucky-pebble": STONE,
  "militia-blade": COPPER,
  "plank-buckler": OAK,
  "wardens-helm": STEEL,
  "scholars-circlet": SILVER,
  "falcon-charm": SKY,
  "bastion-pauldrons": IRON,
  "starwoven-mantle": STAR,
  "windrunner-cloak": STORM,
  "guardsmans-cuirass": STEEL,
  "robe-of-quiet-waters": SEA,
  "archers-bracers": FOREST,
  "masons-grip": STONE,
  "quickfinger-gloves": EMERALD,
  "runed-sash": RUNE,
  "marching-greaves": IRON,
  "trackers-leggings": FOREST,
  "swiftstep-boots": STORM,
  "pilgrims-sandals": EARTH,
  "band-of-resolve": BONE,
  "moonlit-signet": MOON,
  "hunters-whistle": BRASS,
  "vial-of-clear-thought": SEA,
  "soldiers-longsword": STEEL,
  "twin-edged-glaive": SILVER,
  "apprentices-staff": OAK,
  "oaken-shield": OAK,
  "helm-of-the-unbroken-line": IRON,
  "hood-of-the-night-watch": NIGHT,
  "pendant-of-the-deep-well": EMERALD,
  "torc-of-the-old-guard": GOLD,
  "raven-feather-spaulders": RAVEN,
  "cloak-of-falling-stars": STAR,
  "banner-cloak-of-the-keep": CRIMSON,
  "night-trackers-jerkin": NIGHT,
  "bulwark-plate": STEEL,
  "bindings-of-the-high-tide": SEA,
  "siegebreaker-vambraces": BRASS,
  "weavers-gloves": ROYAL,
  "girdle-of-the-mountain": STONE,
  "belt-of-many-knives": BLOOD,
  "leggings-of-the-moon-court": MOON,
  "treads-of-the-vanguard": STEEL,
  "boots-of-the-silent-road": NIGHT,
  "ring-of-the-keen-eye": FROST,
  "seal-of-the-archivist": ROYAL,
  "astrolabe-shard": BRASS,
  "compass-of-the-lost-scout": COPPER,
  "greatblade-of-the-keep": STEEL,
  "staff-of-the-low-tide": SEA,
  "parrying-dagger": SILVER,
  skysplitter: STORM,
  quakemaul: EARTH,
  "last-rampart": GOLD,
  "hourglass-of-the-hunt": EARTH,
  "frostbound-lantern": FROST,
  "seal-of-the-royal-treasury": GOLD,
  "glaive-of-the-last-storm": STORM,
  "oathkeepers-wall": SILVER,
};

/** The colour of an item's picture (its base's for a random item); undefined for an unknown id. */
export function itemTint(itemId: string): string | undefined {
  const key = itemId.startsWith("rolled-") ? itemId.slice("rolled-".length) : itemId;
  return ITEM_TINTS[key];
}
