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
  /** A layered take: these sources mixed into one file (`src` is then the first layer's source). */
  layers?: MixLayer[];
  /** Room of a layered take: "hall" a short bright reverb, "echo" two long repeats. */
  space?: Space;
  /** Length of a layered take in seconds; the last 0.25 s fade out. */
  length?: number;
}

export type Space = "hall" | "echo";

/** One source of a layered take, all times in seconds. */
export interface MixLayer {
  src: string;
  trim?: [number, number];
  /** Start in the mix. */
  at?: number;
  gainDb?: number;
  /** Playback rate: pitch and speed together (2 = an octave up and twice as fast). */
  rate?: number;
  /** Speed without pitch (0.5 = twice as long), 0.5-2. */
  tempo?: number;
  reverse?: boolean;
  highpass?: number;
  lowpass?: number;
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

/** A layer of a layered take: a file of a pack with its placement and treatment. */
type Layer = Omit<MixLayer, "src"> & { pack: Pack; file: string };
/** One layered take: its layers, room and length. */
interface Mix {
  layers: Layer[];
  space?: Space;
  length: number;
}

const L = (pack: Pack, file: string, opts: Omit<Layer, "pack" | "file"> = {}): Layer => ({ pack, file, ...opts });
const unique = (xs: string[]): string[] => [...new Set(xs)];

/** The layered variants of one cue: files sfx/<cue>-1 ... sfx/<cue>-n, each mixed from several sources. */
function mix(id: string, takes: Mix[]): AudioSource[] {
  return takes.map((m, i) => {
    const layers: MixLayer[] = m.layers.map(({ pack, file, ...rest }) => ({ src: `${pack.dir}/${file}`, ...rest }));
    return {
      out: `sfx/${id}-${i + 1}`,
      src: layers[0]!.src,
      kind: "sfx",
      author: unique(m.layers.map((l) => l.pack.author)).join(" + "),
      license: "CC0 1.0",
      url: unique(m.layers.map((l) => l.pack.url)).join(" "),
      downloaded: DOWNLOADED,
      layers,
      length: m.length,
      ...(m.space ? { space: m.space } : {}),
    };
  });
}

const spell = (name: string, to: number, from = 0): Take => [COMBAT, `${MAGIC}/${name}`, [from, to]];
const melee = (name: string, trim?: [number, number]): Take => [COMBAT, `${MELEE}/${name}`, ...(trim ? [trim] : [])] as Take;
const blast = (name: string, trim?: [number, number]): Take => [COMBAT, `${BLAST}/${name}`, ...(trim ? [trim] : [])] as Take;

const M = (name: string, opts: Omit<Layer, "pack" | "file"> = {}): Layer => L(COMBAT, `${MAGIC}/${name}`, opts);
const X = (name: string, opts: Omit<Layer, "pack" | "file"> = {}): Layer => L(COMBAT, `${BLAST}/${name}`, opts);
const ME = (name: string, opts: Omit<Layer, "pack" | "file"> = {}): Layer => L(COMBAT, `${MELEE}/${name}`, opts);
const bell = (n: number, opts: Omit<Layer, "pack" | "file"> = {}): Layer => L(K_IMPACT, `impactBell_heavy_00${n}.ogg`, opts);
const chime = (n: number, opts: Omit<Layer, "pack" | "file"> = {}): Layer => L(K_UI, `glass_00${n}.ogg`, opts);
const swish = (n: number, opts: Omit<Layer, "pack" | "file"> = {}): Layer => L(SWISH, `swish-${n}.wav`, opts);
const bone = (n: number, at: number, gainDb = 0): Layer => L(BONES, `${n}.ogg`, { at, gainDb });
const WIND1 = "Wind Spell Impact 1_s07.wav";
const LOW_BOOM = "low_frequency_explosion_001_48kHz_16bit_1s_a63b8c61_s04.wav";

/** One falling star: a short bright streak, then a high bell and a glass chime where it lands. */
const star = (at: number, bellN: number, bellRate: number, chimeN: number, swishN: number): Layer[] => [
  swish(swishN, { at, rate: 1.6, highpass: 2000, gainDb: -12 }),
  bell(bellN, { at: at + 0.1, rate: bellRate, gainDb: -3 }),
  chime(chimeN, { at: at + 0.11, rate: 1.5, gainDb: -8 }),
];

/** Spells whose name asks for more than one recorded sound: layered takes (review of 2026-11-20). */
const LAYERED: AudioSource[] = [
  // Mistwarden base attack: a cold gust with a frosty tinkle (was a crackle of ice)
  ...mix("mist-chill", [
    { length: 0.45, layers: [M(WIND1, { trim: [0.25, 0.7], rate: 1.3 }), L(K_IMPACT, "impactGlass_light_000.ogg", { rate: 1.6, at: 0.05, gainDb: -10 })] },
    { length: 0.45, layers: [M("Wind Spell Impact 3_s07.wav", { trim: [0.2, 0.65], rate: 1.3 }), L(K_IMPACT, "impactGlass_light_002.ogg", { rate: 1.8, at: 0.05, gainDb: -10 })] },
  ]),
  // Seismic Echo: an earth impact that really echoes
  ...mix("stone-echo", [
    { length: 1.6, space: "echo", layers: [M("Earth Spell Impact 2_s07.wav", { trim: [0, 0.9] })] },
    { length: 1.6, space: "echo", layers: [M("Earth Spell Impact 4_s07.wav", { trim: [0, 0.9] })] },
  ]),
  // Falling Stars: three stars streak down and land with ringing bells over a soft shimmer
  ...mix("moon-starfall", [
    {
      length: 1.9,
      space: "hall",
      layers: [
        M("Healing Spell Impact 12_s08.wav", { trim: [0, 1.3], highpass: 3000, gainDb: -14 }),
        L(K_IMPACT, "impactSoft_heavy_000.ogg", { at: 0.1, lowpass: 400, gainDb: -16 }),
        ...star(0, 3, 2.0, 1, 10),
        ...star(0.3, 2, 2.52, 5, 12),
        ...star(0.62, 0, 3.0, 6, 13),
      ],
    },
    {
      length: 1.9,
      space: "hall",
      layers: [
        M("Healing Spell Impact 14_s08.wav", { trim: [0, 1.3], highpass: 3000, gainDb: -14 }),
        L(K_IMPACT, "impactSoft_heavy_001.ogg", { at: 0.1, lowpass: 400, gainDb: -16 }),
        ...star(0, 2, 2.52, 6, 13),
        ...star(0.26, 3, 3.0, 1, 10),
        ...star(0.58, 1, 2.0, 5, 12),
      ],
    },
  ]),
  // Shadow Sisters: a whisper of wind over a low ghostly tone
  ...mix("moon-whisper", [
    { length: 1.5, space: "hall", layers: [M(WIND1, { trim: [0, 1.4] }), M("Healing Spell Impact 7_s08.wav", { trim: [0, 1.6], rate: 0.6, lowpass: 2500, gainDb: -8 })] },
    { length: 1.5, space: "hall", layers: [M("Wind Spell Impact 3_s07.wav", { trim: [0, 1.4] }), M("Healing Spell Impact 13_s08.wav", { trim: [0, 1.6], rate: 0.55, lowpass: 2500, gainDb: -8 })] },
  ]),
  // Grave Grasp: roots tear out of the ground with a rattle of bones
  ...mix("bone-grasp", [
    { length: 1.3, layers: [M("Plant Spell Impact 1_s07.wav", { trim: [0, 1.3], rate: 0.85, lowpass: 4000 }), bone(3, 0.15, -6), bone(7, 0.3, -8)] },
    { length: 1.3, layers: [M("Plant Spell Impact 3_s07.wav", { trim: [0, 1.3], rate: 0.85, lowpass: 4000 }), bone(8, 0.12, -6), bone(0, 0.28, -8)] },
  ]),
  // Soul Bolt: a wailing soul flies off (was a squelch of slime)
  ...mix("bone-wail", [
    { length: 1.3, space: "hall", layers: [M("Wind Spell Impact 4_s07.wav", { trim: [0, 0.9], gainDb: -6 }), M("Healing Spell Impact 9_s08.wav", { trim: [0, 1.4], rate: 0.7 })] },
    { length: 1.3, space: "hall", layers: [M("Healing Spell Impact 13_s08.wav", { trim: [0, 1.4], rate: 0.6 }), M("Wind Spell Impact 5_s07.wav", { trim: [0, 1.0], rate: 1.3, gainDb: -8 })] },
  ]),
  // Bone Stampede: a dark stampede: low bone clatter over deep hoofbeats, a drone and a ghostly moan (Petr, 2026-11-20: darker)
  ...mix("bone-stampede", [
    {
      length: 2.0,
      space: "hall",
      layers: [
        M("Wind Spell Impact 2_s07.wav", { trim: [0, 2.0], rate: 0.6, lowpass: 900, gainDb: -2 }),
        M("Healing Spell Impact 7_s08.wav", { trim: [0, 2.0], rate: 0.4, lowpass: 1500, gainDb: -8 }),
        X(LOW_BOOM, { lowpass: 150, gainDb: -6 }),
        ...[0, 0.2, 0.38, 0.58, 0.76, 0.95, 1.15].map((at, i) => L(K_IMPACT, `impactPunch_heavy_00${i % 5}.ogg`, { at, rate: 0.6, lowpass: 250, gainDb: -2 })),
        ...[0.05, 0.14, 0.27, 0.41, 0.5, 0.66, 0.8, 0.99, 1.1].map((at, i) => L(BONES, `${i}.ogg`, { at, rate: 0.65, lowpass: 2500, gainDb: -6 })),
      ],
    },
    {
      length: 2.0,
      space: "hall",
      layers: [
        M("Earth Spell Impact 5_s07.wav", { trim: [0, 2.0], rate: 0.7, lowpass: 1200, gainDb: -2 }),
        M("Healing Spell Impact 13_s08.wav", { trim: [0, 2.0], rate: 0.4, lowpass: 1500, gainDb: -8 }),
        L(BONES2, "bones-2.wav", { rate: 0.6, lowpass: 2500, gainDb: -4 }),
        ...[0.02, 0.21, 0.4, 0.6, 0.79, 0.98, 1.18].map((at, i) => L(K_IMPACT, `impactSoft_heavy_00${i % 5}.ogg`, { at, rate: 0.6, lowpass: 250, gainDb: -2 })),
        ...[0.1, 0.23, 0.35, 0.52, 0.7, 0.86, 1.04].map((at, i) => L(BONES, `${9 - i}.ogg`, { at, rate: 0.6, lowpass: 2500, gainDb: -6 })),
        X("explosion_crunch_000_48kHz_16bit_0.78s_e875be4e_s04.wav", { rate: 0.6, lowpass: 600, gainDb: -8 }),
      ],
    },
  ]),
  // Serpent Totem: a wooden totem hits the ground and a serpent hisses
  ...mix("storm-totem", [
    {
      length: 1.2,
      layers: [
        L(K_IMPACT, "impactWood_heavy_000.ogg"),
        swish(9, { at: 0.05, tempo: 0.5, highpass: 2500, gainDb: -6 }),
        M("Earth Spell Impact 5_s07.wav", { trim: [0, 1.0], gainDb: -12 }),
      ],
    },
    {
      length: 1.2,
      layers: [
        L(K_IMPACT, "impactWood_heavy_004.ogg"),
        swish(7, { at: 0.05, tempo: 0.5, highpass: 2500, gainDb: -6 }),
        swish(9, { at: 0.35, tempo: 0.6, highpass: 2800, gainDb: -10 }),
      ],
    },
  ]),
  // Mending Tide: a healing shimmer on a gentle wash of water
  ...mix("storm-mend", [
    { length: 1.5, space: "hall", layers: [M("Healing Spell Impact 1_s08.wav", { trim: [0, 1.5] }), M("Water Spell Impact 1_s06.wav", { trim: [0, 1.2], gainDb: -8 })] },
    { length: 1.5, space: "hall", layers: [M("Healing Spell Impact 3_s08.wav", { trim: [0, 1.5] }), M("Water Spell Impact 4_s06.wav", { trim: [0, 1.2], gainDb: -8 })] },
  ]),
  // Spirit Ward: a low spirit choir with a protective bell and far thunder (was a crackle of lightning)
  ...mix("storm-chorus", [
    {
      length: 2.0,
      space: "hall",
      layers: [
        M("Healing Spell Impact 6_s08.wav", { trim: [0, 2.0], rate: 0.7 }),
        bell(1, { gainDb: -6 }),
        M("Lightning Spell Impact 4_s06.wav", { trim: [0, 1.5], lowpass: 1500, gainDb: -14 }),
      ],
    },
    {
      length: 2.0,
      space: "hall",
      layers: [
        M("Healing Spell Impact 5_s08.wav", { trim: [0, 2.0], rate: 0.75 }),
        bell(0, { at: 0.05, rate: 1.5, gainDb: -6 }),
        M("Healing Spell Impact 11_s08.wav", { trim: [0, 1.8], rate: 0.6, gainDb: -10 }),
      ],
    },
  ]),
  // Soul Burst: a burst of ghostly voices in a rush of air
  ...mix("mist-burst", [
    { length: 1.2, space: "hall", layers: [M("Healing Spell Impact 10_s08.wav", { trim: [0, 1.2], rate: 0.7 }), M("Wind Spell Impact 2_s07.wav", { trim: [0, 1.0], gainDb: -4 })] },
    { length: 1.2, space: "hall", layers: [M("Healing Spell Impact 4_s08.wav", { trim: [0, 1.2], rate: 0.65 }), M("Wind Spell Impact 5_s07.wav", { trim: [0, 1.0], gainDb: -6 })] },
  ]),
  // Wailing Wave: a long falling wail carried by wind
  ...mix("mist-wail", [
    { length: 1.8, space: "hall", layers: [M("Healing Spell Impact 7_s08.wav", { trim: [0, 2.0], rate: 0.55 }), M("Wind Spell Impact 5_s07.wav", { trim: [0, 1.8], gainDb: -4 })] },
    { length: 1.8, space: "hall", layers: [M("Healing Spell Impact 14_s08.wav", { trim: [0, 2.0], rate: 0.5 }), M("Wind Spell Impact 4_s07.wav", { trim: [0, 1.8], gainDb: -4 })] },
  ]),
  // Rocket Fan: three rockets hiss off, then burst
  ...mix("spark-rockets", [
    {
      length: 1.2,
      layers: [
        ...[0, 0.07, 0.14].map((at) => swish(7, { at, rate: 0.8, tempo: 0.6, gainDb: -4 })),
        X("BlastImpact_01_s01.wav", { at: 0.3 }),
      ],
    },
    {
      length: 1.2,
      layers: [
        swish(9, { rate: 0.8, tempo: 0.6, gainDb: -4 }),
        swish(1, { at: 0.06, rate: 0.8, tempo: 0.6, gainDb: -4 }),
        swish(9, { at: 0.13, rate: 0.75, tempo: 0.6, gainDb: -4 }),
        X("BlastImpact_02_s01.wav", { at: 0.28 }),
        M("Fire Spell Impact 3_s06.wav", { trim: [0, 0.6], at: 0.28, gainDb: -12 }),
      ],
    },
  ]),
  // Beam Swarm: burning beams with a low hum under them
  ...mix("spark-beams", [
    { length: 1.5, layers: [M("Fire Spell Impact 2_s06.wav", { trim: [0, 1.5] }), M("Fire Spell Impact 4_s06.wav", { trim: [0, 1.5], rate: 0.8, gainDb: -6 })] },
    { length: 1.5, layers: [M("Fire Spell Impact 1_s06.wav", { trim: [0, 1.5] }), M("Fire Spell Impact 4_s06.wav", { trim: [0, 1.5], rate: 0.7, gainDb: -6 })] },
  ]),
  // Crushing Wave: a wave that crashes down with a heavy blow
  ...mix("tide-crush", [
    { length: 1.6, layers: [L(WAVES, "wave_02_cc0-11505__transitking__wavesound.flac", { trim: [0, 1.6] }), X(LOW_BOOM, { at: 0.35, lowpass: 500, gainDb: -6 })] },
    {
      length: 1.6,
      layers: [
        L(WAVES, "wave_04_cc0-11505__transitking__wavesound.flac", { trim: [0, 1.6] }),
        L(K_IMPACT, "impactSoft_heavy_001.ogg", { at: 0.3 }),
        X("explosion_crunch_003_48kHz_16bit_1.55s_4b973e9c_s04.wav", { at: 0.3, lowpass: 800, gainDb: -10 }),
      ],
    },
  ]),
  // Drowned Lake: deep, muffled water with rising bubbles
  ...mix("tide-lake", [
    {
      length: 1.8,
      layers: [
        M("Water Spell Impact 2_s06.wav", { trim: [0, 1.8], rate: 0.6, lowpass: 2000 }),
        ME("slime_000_48kHz_16bit_0.5s_691d3d6e_s04.wav", { at: 0.3, rate: 0.7, gainDb: -8 }),
        L(WAVES, "wave_02_cc0-11505__transitking__wavesound.flac", { trim: [0, 1.8], lowpass: 1200, gainDb: -10 }),
      ],
    },
    {
      length: 1.8,
      layers: [
        M("Water Spell Impact 5_s06.wav", { trim: [0, 1.8], rate: 0.6, lowpass: 2000 }),
        ME("slime_001_48kHz_16bit_4.71s_56e4987f_s04.wav", { trim: [0, 1.2], at: 0.2, rate: 0.8, gainDb: -8 }),
        X(LOW_BOOM, { lowpass: 200, gainDb: -12 }),
      ],
    },
  ]),
  // Smite: a strike from above with a ringing bell
  ...mix("shared-smite", [
    { length: 1.5, space: "hall", layers: [bell(0), X("BlastImpact_03_s01.wav", { gainDb: -8 }), M("Healing Spell Impact 11_s08.wav", { trim: [0, 1.0], gainDb: -8 })] },
    { length: 1.5, space: "hall", layers: [bell(1), L(K_IMPACT, "impactPlate_heavy_001.ogg", { gainDb: -8 }), M("Healing Spell Impact 4_s08.wav", { trim: [0, 1.0], gainDb: -10 })] },
  ]),
  // Frost Ring: cracking ice with a glassy ring, so it reads as ice
  ...mix("shared-frost", [
    {
      length: 1.3,
      layers: [M("Ice Spell Impact 5_s06.wav", { trim: [0, 1.3] }), L(K_IMPACT, "impactGlass_light_001.ogg", { rate: 1.5, gainDb: -6 }), chime(4, { gainDb: -14 })],
    },
    {
      length: 1.3,
      layers: [M("Ice Spell Impact 3_s06.wav", { trim: [0, 1.3] }), L(K_IMPACT, "impactGlass_light_003.ogg", { rate: 1.4, gainDb: -6 }), chime(1, { rate: 2, gainDb: -10 })],
    },
  ]),
  // Meteor: a fiery rush down, then the blast with a low boom
  ...mix("shared-meteor", [
    {
      length: 1.8,
      layers: [
        M("Fire Spell Impact 5_s06.wav", { trim: [0, 0.7], reverse: true, gainDb: -4 }),
        X("explosion_crunch_001_48kHz_16bit_1.36s_5803a7f0_s04.wav", { at: 0.62 }),
        X(LOW_BOOM, { at: 0.62, lowpass: 300, gainDb: -6 }),
      ],
    },
    {
      length: 1.8,
      layers: [
        M("Fire Spell Impact 1_s06.wav", { trim: [0, 0.8], reverse: true, gainDb: -4 }),
        X("explosion_crunch_002_48kHz_16bit_1.26s_e0852ce0_s04.wav", { at: 0.7 }),
        X(LOW_BOOM, { at: 0.7, lowpass: 300, gainDb: -6 }),
      ],
    },
  ]),
  // Holy Ground: a warm holy shimmer with a soft bell
  ...mix("shared-holy", [
    { length: 1.6, space: "hall", layers: [M("Healing Spell Impact 5_s08.wav", { trim: [0, 1.5] }), bell(0, { rate: 1.5, gainDb: -10 })] },
    { length: 1.6, space: "hall", layers: [M("Healing Spell Impact 6_s08.wav", { trim: [0, 1.5] }), bell(1, { rate: 1.335, gainDb: -10 })] },
  ]),
  // Second Wind: a drawn breath, then the heal
  ...mix("shared-breath", [
    { length: 1.6, layers: [M(WIND1, { trim: [0, 0.6], rate: 1.25, reverse: true, gainDb: -4 }), M("Healing Spell Impact 7_s08.wav", { trim: [0, 1.2], at: 0.35 })] },
    { length: 1.6, layers: [M("Wind Spell Impact 3_s07.wav", { trim: [0, 0.6], rate: 1.2, reverse: true, gainDb: -4 }), M("Healing Spell Impact 13_s08.wav", { trim: [0, 1.2], at: 0.35 })] },
  ]),
];

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
  ...cue("stone-quake", [
    blast("low_frequency_explosion_000_48kHz_16bit_2s_84586419_s04.wav", [0, 1.8]),
    blast("explosion_crunch_004_48kHz_16bit_1.98s_b6838d5c_s04.wav", [0, 1.8]),
  ]),
  // Nightglaive: moon
  ...cue("moon-glimmer", [spell("Healing Spell Impact 12_s08.wav", 1.2), spell("Healing Spell Impact 14_s08.wav", 1.2)]),
  // Gravecaller: bone and grave
  ...cue("bone-ring", [[BONES, "5.ogg"], [BONES, "6.ogg"], [BONES2, "bones-2.wav"]]),
  // Serpent Shaman: storm
  ...cue("storm-bolt", [spell("Lightning Spell Impact 1_s06.wav", 1.5), spell("Lightning Spell Impact 2_s06.wav", 1.5)]),
  // Mistwarden: mist
  ...cue("mist-wisp", [spell("Healing Spell Impact 9_s08.wav", 1.0), spell("Healing Spell Impact 10_s08.wav", 1.0)]),
  ...cue("mist-surge", [spell("Water Spell Impact 3_s06.wav", 1.5), spell("Wind Spell Impact 2_s07.wav", 1.6, 0.2)]),
  // Sparkshot: spark
  ...cue("spark-sear", [spell("Fire Spell Impact 3_s06.wav", 1.0), spell("Fire Spell Impact 4_s06.wav", 1.0)]),
  // Redcleaver: blood and cleaver
  ...cue("blood-toss", [[MEDIEVAL_TEX, "medieval_sfx_textures_2_of_2/Spear Swing.wav", [0, 0.7]], [SWISH, "swish-8.wav"]]),
  ...cue("blood-fan", [
    [MEDIEVAL_TEX, "medieval_sfx_textures_2_of_2/Axe Swing.wav", [0.42, 1.0]],
    [MEDIEVAL_TEX, "medieval_sfx_textures_2_of_2/Axe Swing.wav", [1.3, 2.0]],
  ]),
  ...cue("blood-rot", [melee("slime_000_48kHz_16bit_0.5s_691d3d6e_s04.wav"), spell("Plant Spell Impact 2_s07.wav", 1.2)]),
  // Tidecaller: tide
  ...cue("tide-splash", [[SPLASH, "water_splash-01.flac"], [SPLASH, "water_splash-04.flac", [0, 0.6]]]),
  ...cue("tide-rip", [[WAVES, "wave_01_cc0-11505__transitking__wavesound.flac"], [WAVES, "wave_03_cc0-11505__transitking__wavesound.flac", [0, 1.5]]]),
  // shared spells
  ...cue("shared-arc", [spell("Lightning Spell Impact 3_s06.wav", 1.2), spell("Lightning Spell Impact 5_s06.wav", 1.2)]),
  ...cue("shared-firebolt", [spell("Fire Spell Impact 5_s06.wav", 1.0), spell("Fire Spell Impact 3_s06.wav", 0.8)]),
  ...cue("shared-blades", [[SWISH, "swish-1.wav"], [SWISH, "swish-3.wav"], [SWISH, "swish-5.wav"]]),
  ...cue("shared-shock", [
    blast("low_frequency_explosion_001_48kHz_16bit_1s_a63b8c61_s04.wav"),
    blast("explosion_crunch_003_48kHz_16bit_1.55s_4b973e9c_s04.wav", [0, 1.2]),
  ]),
  ...cue("shared-sentry", [[K_RPG, "metalLatch.ogg"], [K_IMPACT, "impactWood_heavy_001.ogg"]]),

  ...LAYERED,

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
