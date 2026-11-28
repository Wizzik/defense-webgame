/**
 * Our own icon for every ability (24 x 24 line glyphs, drawn in the ability's own colour): each hero spell, each
 * ultimate, each shared spell and each passive has a glyph of its own, so the ability bar and the cards tell the
 * spells apart at a glance (Petr, 2026-11-23). Colours follow the element (earth, shadow, bone, storm, water, mist,
 * spark, blood) and avoid orange. An unknown id gets a plain diamond in the text colour.
 */
interface Icon {
  glyph: string;
  color: string;
}

const EARTH = "#c9b48f";
const NATURE = "#8fd694";
const SHADOW = "#b79cff";
const BONE = "#e3dcc2";
const SOUL = "#9fe0c4";
const STORM = "#7fd8ff";
const HEAL = "#6fb7ff";
const SPIRIT = "#a8c8ff";
const MIST = "#c9b8ff";
const SPARK = "#ffe36e";
const FIRE = "#ff6b74";
const BLOOD = "#e2475a";
const ROT = "#b5cf62";
const WATER = "#4fc3f7";
const FROST = "#c4f1ff";
const HOLY = "#ffd97a";
const STEEL = "#c3ccd6";
const ARCANE = "#d18cff";

const ICONS: Record<string, Icon> = {
  // Stonehorn
  "rock-rupture": { color: EARTH, glyph: '<path d="M2 20h20"/><path d="M3 20l3-7 2 4 3-10 3 9 2-4 4 8"/>' },
  "enhanced-totem": {
    color: NATURE,
    glyph: '<rect x="8" y="3" width="8" height="18" rx="1"/><path d="M8 9h8M8 15h8M4 12h4M16 12h4"/><path d="M10.5 6h.01M13.5 6h.01"/>',
  },
  "seismic-echo": { color: EARTH, glyph: '<path d="M12 20v-3"/><path d="M7.5 20a4.5 4.5 0 0 1 9 0"/><path d="M3 20a9 9 0 0 1 18 0"/><path d="M12 3v4M9 5l3 2 3-2"/>' },
  groundbreaker: { color: EARTH, glyph: '<rect x="9" y="2" width="6" height="7" rx="1"/><path d="M12 9v5"/><path d="M12 14l-6 7M12 14l6 7M12 14v8M12 14l-9 2M12 14l9 2"/>' },
  // Nightglaive
  "hunters-focus": { color: SHADOW, glyph: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3"/>' },
  "falling-stars": {
    color: SHADOW,
    glyph: '<path d="M8 3l1.2 2.6 2.8.3-2.1 1.9.6 2.8L8 9.2 5.5 10.6l.6-2.8L4 5.9l2.8-.3z"/><path d="M14 13l3-3M12 20l7-7M18 21l3-3"/>',
  },
  "swift-pace": { color: NATURE, glyph: '<path d="M3 17c5 0 9-3 11-9 1 3 0 6-2 8 3 0 6-1 9-4-2 5-7 8-13 8H3z"/>' },
  "shadow-sisters": {
    color: SHADOW,
    glyph: '<circle cx="8" cy="7" r="2.5"/><path d="M4 21v-6a4 4 0 0 1 8 0v6"/><circle cx="16" cy="7" r="2.5"/><path d="M12 21v-6a4 4 0 0 1 8 0v6"/>',
  },
  // Gravecaller
  "grave-grasp": { color: SOUL, glyph: '<path d="M3 21h18"/><path d="M8 21v-6l-3-3M11 21V7M14 21V9M17 21v-5l2-3"/>' },
  "skull-ring": {
    color: BONE,
    glyph: '<circle cx="12" cy="12" r="10" stroke-dasharray="3 2.5"/><path d="M8 12a4 4 0 0 1 8 0v2l-1 1v2H9v-2l-1-1z"/><path d="M10.3 12.5h.01M13.7 12.5h.01"/>',
  },
  "soul-bolt": { color: SOUL, glyph: '<circle cx="16" cy="8" r="3.5"/><path d="M13.5 10.5C9 15 6 16 3 21M12.5 7.5c-3 1-6 3-8 6M16.5 11.5c-1 3-3 6-6 8"/>' },
  "bone-stampede": {
    color: BONE,
    glyph: '<path d="M6 18L18 6M6 6l12 12"/><circle cx="4.5" cy="16.5" r="1.5"/><circle cx="7.5" cy="19.5" r="1.5"/><circle cx="16.5" cy="4.5" r="1.5"/><circle cx="19.5" cy="7.5" r="1.5"/><circle cx="4.5" cy="7.5" r="1.5"/><circle cx="7.5" cy="4.5" r="1.5"/><circle cx="16.5" cy="19.5" r="1.5"/><circle cx="19.5" cy="16.5" r="1.5"/>',
  },
  // Serpent Shaman
  "serpent-totem": { color: NATURE, glyph: '<path d="M12 22V12"/><path d="M8 5c2-3 7-3 7 0s-5 3-5 6 5 3 6 1"/><path d="M15 5h.01"/><path d="M9 22h6"/>' },
  "forked-bolt": { color: STORM, glyph: '<path d="M2 12h7l3-3M9 12l3 3"/><path d="M12 9l3-5M12 9l6-1M12 15l6 1M12 15l3 5"/>' },
  "mending-tide": { color: HEAL, glyph: '<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/><path d="M12 11v6M9 14h6"/>' },
  "spirit-ward": { color: SPIRIT, glyph: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/><path d="M12 9a3 3 0 1 1-3 3"/>' },
  // Mistwarden
  "soul-burst": { color: MIST, glyph: '<path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5L19 19M19 5l-3.5 3.5M8.5 15.5L5 19"/><circle cx="12" cy="12" r="2.5"/>' },
  "wisp-ward": { color: SPIRIT, glyph: '<path d="M12 21c-3 0-5-2-5-5 0-4 5-6 5-12 2 3 5 6 5 10 0 4-2 7-5 7z"/><circle cx="12" cy="15.5" r="2"/>' },
  "mist-surge": { color: MIST, glyph: '<path d="M3 7c3-2 5 2 8 0s5-2 8 0"/><path d="M3 12c3-2 5 2 8 0s5-2 8 0"/><path d="M5 17c3-2 5 2 8 0s4-2 6 0"/>' },
  "wailing-wave": { color: MIST, glyph: '<path d="M6 20V10a6 6 0 0 1 12 0v10l-2-2-2 2-2-2-2 2-2-2z"/><path d="M9.5 10v1M14.5 10v1M10.5 15a2 2 0 0 1 3 0"/>' },
  // Sparkshot
  "rocket-fan": { color: SPARK, glyph: '<path d="M12 21L6 7M12 21V5M12 21l6-14"/><path d="M4.5 8l1-4 2.5 2.5zM10.5 6L12 2l1.5 4zM16 6.5L18.5 4l1 4z"/>' },
  "searing-rounds": { color: FIRE, glyph: '<path d="M3 14h11l4-2-4-2H3z"/><path d="M7 7c1-1 1-2 0-3M11 7c1-1 1-2 0-3M7 21c1-1 1-2 0-3M11 21c1-1 1-2 0-3"/>' },
  quickstep: { color: SPARK, glyph: '<path d="M3 6l6 6-6 6M10 6l6 6-6 6"/><path d="M17 8l4 4-4 4"/>' },
  "beam-swarm": { color: SPARK, glyph: '<path d="M5 2v14M12 2v17M19 2v14"/><path d="M3 21h18"/><path d="M3 16h4M10 19h4M17 16h4"/>' },
  // Redcleaver
  "cleaver-toss": { color: STEEL, glyph: '<path d="M3 4h10v8H5a2 2 0 0 1-2-2z"/><path d="M13 8l7 7-2 2-7-7"/><path d="M6 17l-3 3M10 18l-2 3"/>' },
  "blood-fan": {
    color: BLOOD,
    glyph: '<path d="M12 9s-3 4-3 6a3 3 0 0 0 6 0c0-2-3-6-3-6z"/><path d="M5 4s-2 2.5-2 4a2 2 0 0 0 4 0c0-1.5-2-4-2-4zM19 4s-2 2.5-2 4a2 2 0 0 0 4 0c0-1.5-2-4-2-4z"/>',
  },
  "rot-field": { color: ROT, glyph: '<path d="M2 21h20"/><circle cx="7" cy="16" r="2.5"/><circle cx="14" cy="12" r="3.5"/><circle cx="19" cy="17.5" r="1.5"/><circle cx="9.5" cy="6.5" r="1.2"/>' },
  "crushing-wave": { color: WATER, glyph: '<path d="M2 18c4 0 5-3 5-6a6 6 0 0 1 12 0c0 2-1 3-3 3s-2-2-1-3"/><path d="M2 21h20"/>' },
  // Tidecaller
  "stunning-tide": {
    color: WATER,
    glyph: '<path d="M7 12V8a2 2 0 0 1 4 0v3M11 10a2 2 0 0 1 4 0v3a6 6 0 0 1-6 6H8l-3-4 2-3z"/><path d="M18 3l1 2 2 .5-1.5 1.5.3 2-1.8-1-1.8 1 .3-2L15.5 5.5l2-.5z"/>',
  },
  riptide: { color: WATER, glyph: '<path d="M14 12a2 2 0 1 0-2 2 4 4 0 1 0 4-4 6 6 0 1 0-6 6"/><path d="M2 21l4-2"/>' },
  "drowned-lake": { color: WATER, glyph: '<ellipse cx="12" cy="17" rx="9" ry="3.5"/><ellipse cx="12" cy="17" rx="4" ry="1.5"/><path d="M12 2s-3 4-3 6a3 3 0 0 0 6 0c0-2-3-6-3-6z"/>' },
  // Razorwind
  "blade-frenzy": { color: BLOOD, glyph: '<path d="M4 20L16 8M8 20L20 8"/><path d="M14 4l6 0 0 6M3 12l3-3"/>' },
  "sweeping-blades": { color: STEEL, glyph: '<path d="M4 16a10 10 0 0 1 16 0"/><path d="M12 20L12 9"/><path d="M5 12l-2 1M19 12l2 1"/>' },
  "keen-edge": { color: STEEL, glyph: '<path d="M5 19L17 7l2-4-4 2L3 17z"/><path d="M14 14l4 4M17 13l1 4 3 1"/>' },
  "crossing-strike": { color: BLOOD, glyph: '<path d="M4 4l16 16M20 4L4 20"/><circle cx="12" cy="12" r="9"/>' },
  // Dawnhammer
  "holy-burst": { color: HOLY, glyph: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>' },
  judgement: { color: HOLY, glyph: '<path d="M10 2h4v14h-4z"/><path d="M4 20h16"/><path d="M7 17l-2 3M17 17l2 3"/>' },
  "fan-of-light": { color: HOLY, glyph: '<path d="M12 12l-8-4M12 12l-8 4M12 12l8-4M12 12l8 4M12 12V3M12 12v9"/><circle cx="12" cy="12" r="1.5"/>' },
  dominion: { color: HOLY, glyph: '<path d="M4 14l2-8 6 4 6-4 2 8z"/><path d="M4 18h16"/><path d="M8 21l1-2M12 21v-2M16 21l-1-2"/>' },
  // Frostweaver
  "frost-slice": { color: FROST, glyph: '<path d="M3 18L19 6"/><path d="M7 15l-1-4M11 12l-1-4M15 9l-1-4"/><path d="M19 6l2-1-1 2"/>' },
  "frost-slap": { color: FROST, glyph: '<path d="M7 13V7a2 2 0 0 1 4 0v4M11 9a2 2 0 0 1 4 0v4a6 6 0 0 1-6 6H8l-3-4 2-2z"/><path d="M17 4l3 3M20 4l-3 3"/>' },
  "chill-field": { color: FROST, glyph: '<circle cx="12" cy="12" r="9"/><path d="M12 6v12M6.8 9l10.4 6M6.8 15l10.4-6"/>' },
  "ice-fall": { color: FROST, glyph: '<path d="M6 3l2 6M12 2l1 7M18 3l-2 6"/><path d="M3 21l4-6 4 3 3-5 4 4 3-1"/>' },
  // Deadeye
  "hot-blood": { color: FIRE, glyph: '<path d="M12 3s-5 6-5 10a5 5 0 0 0 10 0c0-4-5-10-5-10z"/><path d="M3 9h3M2 13h3M19 9h3"/>' },
  "blasting-powder": { color: SPARK, glyph: '<circle cx="10" cy="14" r="6"/><path d="M14 10l3-3"/><path d="M18 3v3M21 6h-3M19.5 4.5l-1.5 1.5"/>' },
  "fan-fire": { color: SPARK, glyph: '<path d="M3 12h6"/><path d="M9 12l11-7M9 12h12M9 12l11 7"/><circle cx="4" cy="12" r="1"/>' },
  doubles: { color: SHADOW, glyph: '<circle cx="8" cy="7" r="3"/><path d="M3 20c0-4 2-7 5-7s5 3 5 7"/><circle cx="16" cy="7" r="3" stroke-dasharray="2 2"/><path d="M13 13c1-.5 2-.5 3 0 3 0 5 3 5 7" stroke-dasharray="2 2"/>' },
  // Ashsinger
  "cinder-wave": { color: FIRE, glyph: '<path d="M3 17c3-4 6 0 9-4s6 0 9-4"/><path d="M6 12c1-2 0-3 1-5M12 9c1-2 0-3 1-5"/>' },
  "pyre-mantle": { color: FIRE, glyph: '<circle cx="12" cy="13" r="3"/><path d="M12 3c-4 4-7 7-7 11a7 7 0 0 0 14 0c0-4-3-7-7-11z"/>' },
  "ember-comet": { color: FIRE, glyph: '<circle cx="16" cy="8" r="4"/><path d="M13 11L3 21M11 9L4 16M15 13l-6 7"/>' },
  "phoenix-wrath": { color: FIRE, glyph: '<path d="M12 6c-2 0-3 2-3 4l-6-3 3 7 6 4 6-4 3-7-6 3c0-2-1-4-3-4z"/><path d="M12 18v3"/>' },
  // Thunderhoof
  "ground-surge": { color: EARTH, glyph: '<path d="M3 20l4-6 3 3 4-7 3 4 4-8"/><path d="M3 20h18"/>' },
  hoofstomp: { color: EARTH, glyph: '<path d="M8 4h8l1 8H7z"/><path d="M12 4v8"/><path d="M3 18c3-2 15-2 18 0M5 21c2-1 12-1 14 0"/>' },
  "long-march": { color: EARTH, glyph: '<path d="M5 20l3-8 4 2 3-8"/><path d="M15 6l3-2M15 6l1 3"/><path d="M3 14h3M2 17h3"/>' },
  aftershock: { color: EARTH, glyph: '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6" stroke-dasharray="3 2"/><circle cx="12" cy="12" r="10" stroke-dasharray="3 3"/>' },
  // Stormseer
  squall: { color: STORM, glyph: '<path d="M5 9a4 4 0 0 1 7-3 4 4 0 0 1 7 3H5z"/><path d="M9 12l-2 4h3l-2 5M15 12l-2 4h3l-2 5"/>' },
  "spirit-pack": { color: SPIRIT, glyph: '<path d="M4 18l2-8 3 2 3-6 3 6 3-2 2 8z"/><circle cx="10" cy="14" r=".8"/><circle cx="14" cy="14" r=".8"/>' },
  "dread-call": { color: SPIRIT, glyph: '<path d="M4 9v6h3l5 4V5L7 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>' },
  "last-rites": { color: SHADOW, glyph: '<path d="M7 20V9a5 5 0 0 1 10 0v11"/><path d="M12 9v6M9.5 11.5h5"/><path d="M4 20h16"/>' },
  // Mirrorblade
  "flash-cut": { color: STEEL, glyph: '<path d="M4 20L20 4"/><path d="M14 4h6v6"/><path d="M5 9l3 1M9 5l1 3M15 15l3 1M19 19l-1-3"/>' },
  "twin-shades": { color: SHADOW, glyph: '<path d="M6 21v-5l3-3V8a2 2 0 0 1 4 0v5"/><path d="M13 21v-5l3-3V8a2 2 0 0 1 4 0" stroke-dasharray="2 2"/>' },
  "mirror-dance": { color: ARCANE, glyph: '<path d="M12 3v18" stroke-dasharray="2 2"/><path d="M9 6L4 12l5 6M15 6l5 6-5 6"/>' },
  "steel-cyclone": { color: STEEL, glyph: '<path d="M12 12m-2 0a2 2 0 1 0 4 0a4 4 0 1 0-8 0a6 6 0 1 0 12 0a8 8 0 1 0-16 0"/><path d="M20 12l2-2"/>' },
  // Lightbinder
  "radiant-pulse": { color: HOLY, glyph: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" stroke-dasharray="2 2"/><circle cx="12" cy="12" r="10.5"/>' },
  "mending-wave": { color: HEAL, glyph: '<path d="M3 15c3-3 6 3 9 0s6-3 9 0"/><path d="M12 4v7M8.5 7.5h7"/>' },
  "inner-flame": { color: FIRE, glyph: '<path d="M12 21a6 6 0 0 0 6-6c0-4-6-11-6-11S6 11 6 15a6 6 0 0 0 6 6z"/><path d="M12 18a2 2 0 0 0 2-2c0-1.5-2-4-2-4s-2 2.5-2 4a2 2 0 0 0 2 2z"/>' },
  "heavens-rain": { color: HOLY, glyph: '<path d="M4 6h16"/><path d="M7 9l-1 4M12 9v5M17 9l1 4M9 16l-1 4M15 16l1 4"/>' },
  // Skyweaver
  "tempest-bolt": { color: STORM, glyph: '<path d="M13 2L6 13h5l-2 9 8-12h-5z"/><circle cx="12" cy="12" r="10" stroke-dasharray="2 3"/>' },
  "seraph-hymn": { color: HOLY, glyph: '<path d="M12 7c-3-4-8-2-9 2 3 0 6 1 9 4 3-3 6-4 9-4-1-4-6-6-9-2z"/><path d="M12 13v8M9 18h6"/>' },
  "soothing-aura": { color: HEAL, glyph: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>' },
  "phoenix-flock": { color: FIRE, glyph: '<path d="M3 10l4 2 2-4 2 4 4-6 1 6 5-2-4 7H7z"/><path d="M9 21l3-3 3 3"/>' },
  // Ironroar
  "thunder-spikes": { color: EARTH, glyph: '<path d="M3 20l3-8 2 8 3-11 3 11 2-8 3 8"/><path d="M2 20h20"/>' },
  earthhurl: { color: EARTH, glyph: '<circle cx="12" cy="7" r="3"/><path d="M12 10v3"/><path d="M3 20c3-3 15-3 18 0M6 17l-2-2M18 17l2-2"/>' },
  "iron-ward": { color: STEEL, glyph: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/><path d="M8 12h8M12 8v8"/>' },
  "roaring-axe": { color: BLOOD, glyph: '<path d="M4 20L14 10"/><path d="M14 10c1-4 5-6 7-6-1 3 0 6-3 8z"/><path d="M3 9l3 1M4 5l3 3M8 3l1 3"/>' },
  // Stonebeard
  "hammer-wave": { color: STORM, glyph: '<path d="M4 8h8v4H4z"/><path d="M8 12v9"/><path d="M14 8c2 2 2 6 0 8M17 6c3 3 3 9 0 12"/>' },
  "rolling-thunder": { color: STORM, glyph: '<path d="M7 4h10v5H7z"/><path d="M12 9v4"/><path d="M3 18c3-2 15-2 18 0M5 21c3-1 11-1 14 0"/><path d="M4 14l2 1M20 14l-2 1"/>' },
  "skull-crack": { color: BONE, glyph: '<path d="M6 11a6 6 0 1 1 12 0v3l-2 1v3H8v-3l-2-1z"/><path d="M12 5l-1 4 2 2-1 3"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>' },
  "titan-form": { color: EARTH, glyph: '<circle cx="12" cy="5" r="2.5"/><path d="M5 10l7-2 7 2-2 4h-3v7h-4v-7H7z"/><path d="M3 6l2 2M21 6l-2 2"/>' },
  // shared spells
  "arc-lightning": { color: STORM, glyph: '<path d="M13 2L6 13h5l-2 9 8-12h-5z"/>' },
  smite: { color: HOLY, glyph: '<path d="M12 2v13"/><path d="M8 11l4 4 4-4"/><path d="M5 20h14"/><path d="M8 17l-2 3M16 17l2 3"/>' },
  "fire-bolt": { color: FIRE, glyph: '<path d="M4 20l9-9"/><path d="M13 11c0-4 3-6 7-7-1 4-3 7-7 7z"/><path d="M9 15l-2-1M11 17l-1-2"/>' },
  "frost-ring": { color: FROST, glyph: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M7.7 9.5l8.6 5M7.7 14.5l8.6-5"/>' },
  meteor: { color: FIRE, glyph: '<circle cx="15" cy="15" r="4"/><path d="M12 12L4 4M13 9L7 3M9 13L3 7"/>' },
  "holy-ground": { color: HOLY, glyph: '<path d="M3 18h18"/><path d="M6 18c0-3 3-5 6-5s6 2 6 5"/><path d="M12 3v6M9 6h6"/>' },
  "blade-fan": { color: STEEL, glyph: '<path d="M12 20L5 6M12 20L12 4M12 20L19 6"/><path d="M4 9l2-3M20 9l-2-3M11 6l1-2 1 2"/>' },
  "shock-wave": { color: STORM, glyph: '<path d="M3 12h4"/><path d="M9 7c2 3 2 7 0 10"/><path d="M13 5c3 4 3 10 0 14"/><path d="M17 3c4 5 4 13 0 18"/>' },
  "sentry-ward": { color: SPIRIT, glyph: '<path d="M12 3l4 4-4 4-4-4z"/><path d="M12 11v9M8 20h8"/><path d="M17 7h4M3 7h4"/>' },
  "second-wind": { color: HEAL, glyph: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/><path d="M12 10v6M9 13h6"/>' },
  // passives
  might: { color: BLOOD, glyph: '<path d="M6 18l9-9"/><path d="M13 5l6 6-2 2-6-6z"/><path d="M4 20l2-2"/>' },
  "arcane-focus": { color: ARCANE, glyph: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>' },
  haste: { color: STORM, glyph: '<circle cx="13" cy="13" r="7"/><path d="M13 9v4l3 2"/><path d="M2 8h4M1 12h3M2 16h4"/>' },
  vigor: { color: FIRE, glyph: '<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11z"/>' },
  "fleet-foot": { color: NATURE, glyph: '<path d="M9 4h5v9l5 3v4H7v-4l2-2z"/><path d="M2 12h4M3 16h3"/>' },
  fortune: {
    color: HOLY,
    glyph: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5"/>',
  },
};

const FALLBACK = '<path d="M12 4l8 8-8 8-8-8z"/>';

/** Whether an ability has an icon of its own. */
export function hasAbilityIcon(id: string): boolean {
  return id in ICONS;
}

/** The glyph markup of an ability (for tests: every glyph is different). */
export function abilityGlyph(id: string): string | undefined {
  return ICONS[id]?.glyph;
}

let gradientId = 0;

/**
 * The icon of an ability as an inline SVG tile: a rounded square lit in the ability's colour from the middle, a thin
 * frame, and the glyph in that colour with a soft fill and a glow (`.ability-icon` in the CSS).
 */
export function abilityIconSvg(id: string): string {
  const icon = ICONS[id];
  const color = icon?.color ?? "#c3ccd6";
  const glyph = icon?.glyph ?? FALLBACK;
  const g = `ai${gradientId++}`;
  return (
    `<svg class="ability-icon" viewBox="0 0 32 32" style="color:${color}" aria-hidden="true">` +
    `<defs><radialGradient id="${g}" cx="50%" cy="42%" r="70%">` +
    `<stop offset="0" stop-color="${color}" stop-opacity="0.42"/>` +
    `<stop offset="0.55" stop-color="#16202e" stop-opacity="0.95"/>` +
    `<stop offset="1" stop-color="#0a0f17"/></radialGradient></defs>` +
    `<rect x="0.75" y="0.75" width="30.5" height="30.5" rx="6" fill="url(#${g})" stroke="${color}" stroke-opacity="0.55" stroke-width="1.5"/>` +
    `<g class="ability-glyph" transform="translate(4 4)" fill="${color}" fill-opacity="0.18" stroke="currentColor" ` +
    `stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round">${glyph}</g></svg>`
  );
}
