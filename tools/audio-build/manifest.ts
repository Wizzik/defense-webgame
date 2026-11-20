/** Recorded sounds and music: where each output file comes from. Sources live in audio-source/ (untracked, untrusted). */
export interface AudioSource {
  /** Output path under assets/audio/ without extension, e.g. "sfx/stone-hit-1". */
  out: string;
  /** Source file path under audio-source/. */
  src: string;
  kind: "sfx" | "music";
  author: string;
  license: "CC0 1.0" | "CC-BY 3.0" | "CC-BY 4.0";
  url: string;
  /** YYYY-MM-DD */
  downloaded: string;
  /** Cut [from, to] in seconds; the end of the cut fades out. */
  trim?: [number, number];
  gainDb?: number;
}

/** A source pack: the folder under audio-source/ and its credits. All packs are CC0 1.0. */
interface Pack {
  dir: string;
  author: string;
  url: string;
}

const DOWNLOADED = "2026-11-20";

const COMBAT: Pack = {
  dir: "150gameeffectsounds",
  author: "untamedpixels (compilation of CoMiGo, Kenney, Kronbits, lentikula; see the pack's LICENSES.txt)",
  url: "https://opengameart.org/node/195932",
};
const K_IMPACT: Pack = { dir: "kenney_impact-sounds/Audio", author: "Kenney", url: "https://kenney.nl/assets/impact-sounds" };
const K_UI: Pack = { dir: "kenney_interface-sounds/Audio", author: "Kenney", url: "https://kenney.nl/assets/interface-sounds" };
const K_RPG: Pack = { dir: "kenney_rpg-audio/Audio", author: "Kenney", url: "https://kenney.nl/assets/rpg-audio" };
const SWISH: Pack = { dir: "swishes/swishes", author: "artisticdude", url: "https://opengameart.org/content/swishes-sound-pack" };
const BONES: Pack = { dir: "bones_rattle", author: "congusbongus", url: "https://opengameart.org/content/bones-rattle" };
const BONES2: Pack = { dir: "loose", author: "OpenGameArt uploader of Bones 2", url: "https://opengameart.org/content/bones-2" };
const MEDIEVAL_TEX: Pack = {
  dir: "loose",
  author: "Ben Jaszczak and Brian Nelson (Medieval sound effects - Weapon Textures)",
  url: "https://opengameart.org/content/medieval-sound-effects-weapon-textures",
};
const MEDIEVAL_HIT: Pack = {
  dir: "loose/medieval_sfx_weapon_on_weapon_1_of_2",
  author: "Ben Jaszczak and Brian Nelson (Medieval sound effects - Weapon Impacts)",
  url: "https://opengameart.org/content/medieval-sound-effects-weapon-impacts",
};
const FIREARM: Pack = {
  dir: "loose/Prepared SFX Library/Prepared SFX Library",
  author: "The Free Firearm Sound Library team",
  url: "https://opengameart.org/content/the-free-firearm-sound-library",
};
const WAVES: Pack = { dir: "loose", author: "transitking", url: "https://opengameart.org/content/water-waves" };
const SPLASH: Pack = { dir: "loose/ezwa-water_splash/ezwa-water_splash", author: "qubodup", url: "https://opengameart.org/content/6-short-water-splashes" };
const HORNS: Pack = { dir: "loose", author: "Eldritch Grim", url: "https://opengameart.org/node/153572" };
const COMING: Pack = { dir: "loose", author: "StumpyStrust", url: "https://opengameart.org/content/their-coming-generic-horn-sound" };
const HEART: Pack = { dir: "loose", author: "bart", url: "https://opengameart.org/content/heartbeat-sounds" };

const MAGIC = "04_magic_spells";
const MELEE = "01_combat_melee";
const BLAST = "03_explosions_destruction";

/** One take: a file of a pack, optionally cut. */
type Take = [pack: Pack, file: string, trim?: [number, number]];

/** The recorded variants of one cue: files sfx/<cue>-1 ... sfx/<cue>-n. */
function cue(id: string, takes: Take[]): AudioSource[] {
  return takes.map(([pack, file, trim], i) => ({
    out: `sfx/${id}-${i + 1}`,
    src: `${pack.dir}/${file}`,
    kind: "sfx",
    author: pack.author,
    license: "CC0 1.0",
    url: pack.url,
    downloaded: DOWNLOADED,
    ...(trim ? { trim } : {}),
  }));
}

const spell = (name: string, to: number, from = 0): Take => [COMBAT, `${MAGIC}/${name}`, [from, to]];
const melee = (name: string, trim?: [number, number]): Take => [COMBAT, `${MELEE}/${name}`, ...(trim ? [trim] : [])] as Take;
const blast = (name: string, trim?: [number, number]): Take => [COMBAT, `${BLAST}/${name}`, ...(trim ? [trim] : [])] as Take;

/** Effects by cue id of design/audio.yaml; the hero families follow spec 5.1. */
export const SFX_SOURCES: AudioSource[] = [
  // base attacks: short (at most about 0.4 s)
  ...cue("stone-strike", [[K_IMPACT, "impactMining_000.ogg"], [K_IMPACT, "impactMining_001.ogg"], [K_IMPACT, "impactPunch_heavy_000.ogg"]]),
  ...cue("moon-arrow", [
    [MEDIEVAL_TEX, "medieval_sfx_textures_1_of_2/English Longbow Shoot.wav", [0, 0.4]],
    [MEDIEVAL_TEX, "medieval_sfx_textures_1_of_2/Scythian Recurve Shoot.wav", [0.18, 0.58]],
    [MEDIEVAL_TEX, "medieval_sfx_textures_1_of_2/Crossbow Shoot.wav", [0.3, 0.7]],
  ]),
  ...cue("grave-bolt", [[BONES, "9.ogg"], blast("Break_02_s01.wav"), melee("SmallImpact_03_s01.wav")]),
  ...cue("shaman-bolt", [spell("Lightning Spell Impact 3_s06.wav", 0.45), spell("Lightning Spell Impact 5_s06.wav", 0.45)]),
  ...cue("mist-chill", [spell("Ice Spell Impact 3_s06.wav", 0.45), spell("Ice Spell Impact 5_s06.wav", 0.45)]),
  ...cue("spark-shot", [
    [FIREARM, "Model 1894/L_17P.wav", [0.58, 1.15]],
    [FIREARM, "Mosin Nagant/M_21P.wav", [1.0, 1.55]],
    [FIREARM, "Marlin 336/I_17P.wav", [0.58, 1.2]],
  ]),
  ...cue("cleaver-chop", [
    [K_RPG, "chop.ogg"],
    melee("knife_slice2_48kHz_16bit_0.56s_d1b73212_s03.wav"),
  ]),
  ...cue("tide-bolt", [[SPLASH, "water_splash-02.flac"], [SPLASH, "water_splash-05.flac"], [SPLASH, "water_splash-03.flac"]]),

  // Stonehorn: stone
  ...cue("stone-rupture", [spell("Earth Spell Impact 1_s07.wav", 1.5), spell("Earth Spell Impact 3_s07.wav", 1.5)]),
  ...cue("stone-tap", [[K_IMPACT, "impactMining_002.ogg"], [K_IMPACT, "impactMining_003.ogg"]]),
  ...cue("stone-echo", [spell("Earth Spell Impact 2_s07.wav", 1.2), spell("Earth Spell Impact 4_s07.wav", 1.2)]),
  ...cue("stone-quake", [
    blast("low_frequency_explosion_000_48kHz_16bit_2s_84586419_s04.wav", [0, 1.8]),
    blast("explosion_crunch_004_48kHz_16bit_1.98s_b6838d5c_s04.wav", [0, 1.8]),
  ]),
  // Nightglaive: moon
  ...cue("moon-glimmer", [spell("Healing Spell Impact 12_s08.wav", 1.2), spell("Healing Spell Impact 14_s08.wav", 1.2)]),
  ...cue("moon-starfall", [spell("Ice Spell Impact 1_s06.wav", 1.5), spell("Ice Spell Impact 2_s06.wav", 1.5)]),
  ...cue("moon-whisper", [spell("Wind Spell Impact 1_s07.wav", 1.3), spell("Wind Spell Impact 3_s07.wav", 1.3)]),
  // Gravecaller: bone and grave
  ...cue("bone-grasp", [spell("Plant Spell Impact 1_s07.wav", 1.2), spell("Plant Spell Impact 3_s07.wav", 1.2)]),
  ...cue("bone-ring", [[BONES, "5.ogg"], [BONES, "6.ogg"], [BONES2, "bones-2.wav"]]),
  ...cue("bone-wail", [melee("slime_001_48kHz_16bit_4.71s_56e4987f_s04.wav", [0, 1.5]), spell("Wind Spell Impact 4_s07.wav", 1.5)]),
  ...cue("bone-stampede", [[BONES2, "bones-2.wav"], blast("explosion_crunch_000_48kHz_16bit_0.78s_e875be4e_s04.wav")]),
  // Serpent Shaman: storm
  ...cue("storm-totem", [spell("Earth Spell Impact 5_s07.wav", 1.2), [K_IMPACT, "impactWood_heavy_000.ogg"]]),
  ...cue("storm-bolt", [spell("Lightning Spell Impact 1_s06.wav", 1.5), spell("Lightning Spell Impact 2_s06.wav", 1.5)]),
  ...cue("storm-mend", [spell("Healing Spell Impact 1_s08.wav", 1.5), spell("Healing Spell Impact 3_s08.wav", 1.5)]),
  ...cue("storm-chorus", [spell("Lightning Spell Impact 4_s06.wav", 1.8), blast("ElectricExplosion_s01.wav", [0, 1.5])]),
  // Mistwarden: mist
  ...cue("mist-burst", [spell("Ice Spell Impact 4_s06.wav", 1.2), spell("Wind Spell Impact 2_s07.wav", 1.2)]),
  ...cue("mist-wisp", [spell("Healing Spell Impact 9_s08.wav", 1.0), spell("Healing Spell Impact 10_s08.wav", 1.0)]),
  ...cue("mist-surge", [spell("Water Spell Impact 3_s06.wav", 1.5), spell("Wind Spell Impact 2_s07.wav", 1.6, 0.2)]),
  ...cue("mist-wail", [spell("Wind Spell Impact 5_s07.wav", 1.8), spell("Ice Spell Impact 2_s06.wav", 1.8)]),
  // Sparkshot: spark
  ...cue("spark-rockets", [blast("BlastImpact_01_s01.wav"), blast("BlastImpact_02_s01.wav")]),
  ...cue("spark-sear", [spell("Fire Spell Impact 3_s06.wav", 1.0), spell("Fire Spell Impact 4_s06.wav", 1.0)]),
  ...cue("spark-beams", [spell("Fire Spell Impact 1_s06.wav", 1.5), spell("Fire Spell Impact 2_s06.wav", 1.5)]),
  // Redcleaver: blood and cleaver
  ...cue("blood-toss", [[MEDIEVAL_TEX, "medieval_sfx_textures_2_of_2/Spear Swing.wav", [0, 0.7]], [SWISH, "swish-8.wav"]]),
  ...cue("blood-fan", [
    [MEDIEVAL_TEX, "medieval_sfx_textures_2_of_2/Axe Swing.wav", [0.42, 1.0]],
    [MEDIEVAL_TEX, "medieval_sfx_textures_2_of_2/Axe Swing.wav", [1.3, 2.0]],
  ]),
  ...cue("blood-rot", [melee("slime_000_48kHz_16bit_0.5s_691d3d6e_s04.wav"), spell("Plant Spell Impact 2_s07.wav", 1.2)]),
  // Tidecaller: tide
  ...cue("tide-crush", [[WAVES, "wave_02_cc0-11505__transitking__wavesound.flac", [0, 1.8]], [WAVES, "wave_04_cc0-11505__transitking__wavesound.flac"]]),
  ...cue("tide-splash", [[SPLASH, "water_splash-01.flac"], [SPLASH, "water_splash-04.flac", [0, 0.6]]]),
  ...cue("tide-rip", [[WAVES, "wave_01_cc0-11505__transitking__wavesound.flac"], [WAVES, "wave_03_cc0-11505__transitking__wavesound.flac", [0, 1.5]]]),
  ...cue("tide-lake", [spell("Water Spell Impact 2_s06.wav", 1.8), spell("Water Spell Impact 5_s06.wav", 1.8)]),
  // shared spells
  ...cue("shared-arc", [spell("Lightning Spell Impact 3_s06.wav", 1.2), spell("Lightning Spell Impact 5_s06.wav", 1.2)]),
  ...cue("shared-smite", [spell("Healing Spell Impact 11_s08.wav", 1.4), blast("BlastImpact_03_s01.wav")]),
  ...cue("shared-firebolt", [spell("Fire Spell Impact 5_s06.wav", 1.0), spell("Fire Spell Impact 3_s06.wav", 0.8)]),
  ...cue("shared-frost", [spell("Ice Spell Impact 5_s06.wav", 1.4), spell("Ice Spell Impact 3_s06.wav", 1.4)]),
  ...cue("shared-meteor", [
    blast("explosion_crunch_001_48kHz_16bit_1.36s_5803a7f0_s04.wav"),
    blast("explosion_crunch_002_48kHz_16bit_1.26s_e0852ce0_s04.wav"),
  ]),
  ...cue("shared-holy", [spell("Healing Spell Impact 5_s08.wav", 1.5), spell("Healing Spell Impact 6_s08.wav", 1.5)]),
  ...cue("shared-blades", [[SWISH, "swish-1.wav"], [SWISH, "swish-3.wav"], [SWISH, "swish-5.wav"]]),
  ...cue("shared-shock", [
    blast("low_frequency_explosion_001_48kHz_16bit_1s_a63b8c61_s04.wav"),
    blast("explosion_crunch_003_48kHz_16bit_1.55s_4b973e9c_s04.wav", [0, 1.2]),
  ]),
  ...cue("shared-sentry", [[K_RPG, "metalLatch.ogg"], [K_IMPACT, "impactWood_heavy_001.ogg"]]),
  ...cue("shared-breath", [spell("Healing Spell Impact 7_s08.wav", 1.5), spell("Healing Spell Impact 13_s08.wav", 1.5)]),

  // enemies
  ...cue("bone-rattle", [[BONES, "0.ogg"], [BONES, "1.ogg"], [BONES, "2.ogg"], [BONES, "3.ogg"], [BONES, "4.ogg"]]),
  ...cue("bone-rattle-heavy", [[BONES2, "bones-2.wav"], blast("explosion_crunch_000_48kHz_16bit_0.78s_e875be4e_s04.wav", [0, 0.6])]),
  ...cue("chaplain-mend", [spell("Healing Spell Impact 14_s08.wav", 0.8)]),
  ...cue("enemy-charge", [[MEDIEVAL_TEX, "medieval_sfx_textures_2_of_2/Spear Swing.wav", [0.8, 2.0]], [SWISH, "swish-9.wav"]]),

  // pickups, chests, orbs
  ...cue("pickup-heart", [spell("Healing Spell Impact 15_s08.wav", 0.6)]),
  ...cue("orb-boots", [[SWISH, "swish-11.wav"], spell("Wind Spell Impact 1_s07.wav", 0.8)]),
  ...cue("orb-berserk", [melee("impact_punch_heavy_000_48kHz_16bit_0.65s_8fb58ba7_s02.wav"), spell("Fire Spell Impact 1_s06.wav", 0.8)]),
  ...cue("orb-renewal", [spell("Healing Spell Impact 2_s08.wav", 1.2)]),
  ...cue("chest-open", [[K_RPG, "creak1.ogg"], [K_RPG, "doorOpen_1.ogg"], [K_RPG, "metalLatch.ogg"]]),
  ...cue("chest-pick", [[K_UI, "select_001.ogg"], [K_UI, "confirmation_002.ogg"]]),
  ...cue("level-up", [spell("Healing Spell impact 8_s08.wav", 1.5)]),
  ...cue("drop-legendary", [[K_UI, "bong_001.ogg"], [K_UI, "maximize_002.ogg"]]),
  ...cue("drop-mythic", [[K_IMPACT, "impactBell_heavy_000.ogg"], [K_IMPACT, "impactBell_heavy_001.ogg"]]),
  ...cue("gear-equip", [[K_RPG, "beltHandle1.ogg"], [K_RPG, "clothBelt.ogg"], [K_RPG, "metalClick.ogg"]]),

  // hero
  ...cue("hero-hurt", [
    melee("impact_punch_medium_000_48kHz_16bit_0.36s_bd322da3_s02.wav"),
    melee("impact_punch_medium_001_48kHz_16bit_0.35s_bfeb7339_s02.wav"),
    melee("impact_punch_medium_002_48kHz_16bit_0.42s_212c5895_s02.wav"),
  ]),
  ...cue("hero-heal", [spell("Healing Spell Impact 4_s08.wav", 0.6)]),
  ...cue("hero-dash", [[SWISH, "swish-2.wav"], [SWISH, "swish-4.wav"], [SWISH, "swish-6.wav"]]),
  ...cue("heartbeat", [[HEART, "heartbeat_slow_0.wav", [0, 0.75]], [HEART, "heartbeat_slow_0.wav", [0.85, 1.6]]]),

  // castle, bosses and warnings
  ...cue("castle-thud", [[K_IMPACT, "impactWood_heavy_002.ogg"], [K_IMPACT, "impactPlate_heavy_000.ogg"], [K_IMPACT, "impactWood_heavy_003.ogg"]]),
  ...cue("war-horn", [[HORNS, "war_horns.wav", [24.5, 29.5]], [COMING, "theircoming.ogg", [0, 2.3]]]),
  ...cue("rush-horn", [[COMING, "theircoming.ogg", [3.4, 5.8]], [COMING, "theircoming3.ogg", [0, 2.6]]]),
  ...cue("boss-collapse", [
    blast("low_frequency_explosion_000_48kHz_16bit_2s_84586419_s04.wav"),
    blast("explosion_crunch_004_48kHz_16bit_1.98s_b6838d5c_s04.wav"),
  ]),
  ...cue("boss-roar", [[HORNS, "war_horns.wav", [36, 40]]]),
  ...cue("slam-breath", [spell("Wind Spell Impact 3_s07.wav", 1.0)]),
  ...cue("slam-impact", [[K_IMPACT, "impactPlate_heavy_001.ogg"], [K_IMPACT, "impactPunch_heavy_002.ogg"]]),

  // interface
  ...cue("ui-click", [[K_UI, "click_001.ogg"], [K_UI, "click_002.ogg"], [K_UI, "tick_001.ogg"]]),
];

/** One music track (all CC0 1.0). */
function track(out: string, src: string, author: string, url: string, trim?: [number, number]): AudioSource {
  return { out: `music/${out}`, src: `loose/${src}`, kind: "music", author, license: "CC0 1.0", url, downloaded: DOWNLOADED, ...(trim ? { trim } : {}) };
}

/** Music by slot: Petr's picks of 2026-11-20 (menu A, both boss slots B); the other slots got what he downloaded. */
export const MUSIC_SOURCES: AudioSource[] = [
  track("menu-fantasy-theme", "FantasyOrchestralTheme.mp3", "Joth", "https://opengameart.org/content/fantasy-orchestral-theme"),
  track("run-determined-pursuit", "determined_pursuit_loop.wav", "Emma_MA", "https://opengameart.org/content/determined-pursuit-epic-orchestra-loop"),
  track("boss-fight", "bosstheme_WO_low.mp3", "Lisboa", "https://opengameart.org/content/boss-fight-0"),
  track("final-epic-endgame", "Heavy Concept A Bass Master.wav", "cynicmusic", "https://opengameart.org/content/epic-endgame-cinematic"),
  track("victory-fanfare", "Transformansion ending.wav", "Emma_MA", "https://opengameart.org/content/transformansion-ending"),
  track("defeat-game-over", "GAMEOVER.wav", "OpenGameArt uploader of Game Over sound", "https://opengameart.org/node/54772"),
];

export const AUDIO_SOURCES: AudioSource[] = [...SFX_SOURCES, ...MUSIC_SOURCES];
