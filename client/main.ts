/// <reference types="vite/client" />
import { Scene, type WebGPURenderer } from "three/webgpu";
import type { GameData } from "../data/schema";
import { ALLY_CAPACITY, COIN_CAPACITY, CRYSTAL_CAPACITY, HEART_CAPACITY } from "../sim";
import type { AudioData } from "../data/schema/audio";
import { loadAudioData } from "./audio/data";
import { AudioEngine } from "./audio/engine";
import { MusicDirector, type MusicInput, musicSlot } from "./audio/music-director";
import { MusicPlayer } from "./audio/music-player";
import { latestBoss } from "./game/boss";
import { loadSettings, type Settings, saveSettings } from "./settings/store";
import { SettingsPanel } from "./ui/settings-panel";
import { SoundView } from "./audio/sound-view";
import { loadGameData } from "./game/data";
import { addDebugHooks, publishSnapshot, updateSnapshot } from "./game/debug";
import { GearSession } from "./game/gear-session";
import { indexedDbBackend, memoryBackend } from "./game/save-store";
import { ProgressSession } from "./game/progress-session";
import { WorldScreen } from "./ui/world-screen";
import { firstUnlocked, namedLevels, type ProgressData } from "../meta";
import { Keyboard } from "./game/keyboard";
import { readGameParams } from "./game/params";
import { Session } from "./game/session";
import { Overlay } from "./perf/overlay";
import { FollowCamera } from "./render/camera";
import { createRenderer, describeGpu, NoGpuError } from "./render/gpu";
import { ChestView } from "./render/chest-view";
import { coinLook, crystalLook, CrystalView, heartLook } from "./render/crystal-view";
import { DamageNumbers } from "./render/damage-numbers";
import { OrbView } from "./render/orb-view";
import { AbilityFx } from "./render/ability-fx";
import { Effects } from "./render/effects";
import { EnemyFx } from "./render/enemy-fx";
import { crowdSkins } from "./render/boss-looks";
import { hexTintTable } from "./render/enemy-tints";
import { EnemyCrowd, IDLE_CLIP, PUNCH_CLIP, VAT_FPS, WALK_CLIP } from "./render/enemy-crowd";
import { AllyView } from "./render/ally-view";
import { HeroView } from "./render/hero-view";
import { BlobShadows } from "./render/blob-shadows";
import { SunShadow, shadowsEnabled } from "./render/shadows";
import { createLighting } from "./render/lighting";
import { createArena } from "./render/scene";
import { HazardFx } from "./render/hazard-fx";
import { WorldView } from "./render/world-view";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { ArenaView } from "./render/arena-view";
import { Particles } from "./render/particles";
import { WeatherFx } from "./render/weather-fx";
import { loadWorldModels } from "./render/world-models";
import { lookOf } from "./render/world-look";
import { enemyModelId, ModelCache, modelUrl } from "./render/models";
import { type BakedVat, bakeVat } from "./render/vat";
import { Cards } from "./ui/cards";
import { CastlePointer } from "./ui/castle-pointer";
import { ChestPointer } from "./ui/chest-pointer";
import { DamageMeterPanel } from "./ui/damage-meter";
import { EndScreen } from "./ui/end-screen";
import { GearPanel } from "./ui/gear-panel";
import { GearScreen } from "./ui/gear-screen";
import { Hud } from "./ui/hud";
import { type Lang, pickLang, t } from "./ui/i18n";
import { Menu } from "./ui/menu";
import { PackArrows } from "./ui/pack-arrows";
import { CoopLobby } from "./ui/coop-lobby";
import { TeamPanel } from "./ui/team-panel";
import { CoopSetup, joinCodeOf } from "./game/coop-setup";
import { parseSignal } from "./net/signal";
import { updateNet } from "./game/net-snapshot";
import "./ui/style.css";

const LANG_KEY = "defense-webgame.lang";
const MUTE_KEY = "defense-webgame.muted";
const HERO_KEY = "defense-webgame.hero";

let lang: Lang = "en";

function readStoredLang(): string | null {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

function storeLang(value: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, value);
  } catch {
    // storage may be blocked; the choice then lasts until reload
  }
}

/** localStorage, or null where the browser blocks it. */
function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function readStoredMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function storeMuted(value: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // storage may be blocked; the choice then lasts until reload
  }
}

function readStoredHero(): string | null {
  try {
    return localStorage.getItem(HERO_KEY);
  } catch {
    return null;
  }
}

function storeHero(value: string): void {
  try {
    localStorage.setItem(HERO_KEY, value);
  } catch {
    // storage may be blocked; the choice then lasts until reload
  }
}

/** The URL wins (an unknown id is ignored with a warning), then the stored choice, then the start hero. */
function pickHero(data: GameData, param: string | undefined, stored: string | null): string {
  const known = (id: string | null | undefined): id is string => !!id && data.heroes.some((h) => h.id === id);
  if (param !== undefined) {
    if (known(param)) return param;
    console.warn(`unknown hero "${param}" in ?hero, ignored`);
  }
  return known(stored) ? stored : data.rules.start.hero;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000);
}

function showError(error: unknown): void {
  console.error(error);
  const element = document.getElementById("error")!;
  element.textContent =
    error instanceof NoGpuError
      ? t(lang, "error.noGpu")
      : t(lang, "error.generic", { message: error instanceof Error ? error.message : String(error) });
  element.hidden = false;
}

async function start(): Promise<void> {
  const params = readGameParams(location.search, randomSeed);
  lang = pickLang(params.lang, readStoredLang(), navigator.language);
  document.documentElement.lang = lang;

  const data = loadGameData();
  // a debugging session starts from an empty collection and stores nothing
  const gear = await GearSession.load(data, params.debug ? memoryBackend() : await indexedDbBackend(), { persistent: !params.debug });
  // the world ladder: with debug every course is open and results stay in memory
  const progress = await ProgressSession.load(
    data,
    params.debug ? memoryBackend<ProgressData>() : await indexedDbBackend<ProgressData>(undefined, "progress"),
    { persistent: !params.debug, unlockAll: params.debug },
  );
  const hero = pickHero(data, params.hero, readStoredHero());
  const { renderer, backend } = await createRenderer(params.renderer, document.body);
  const gpu = describeGpu(renderer.backend, backend);
  const models = new ModelCache();
  const env = (id: string) => models.get(modelUrl("env", id));
  // ?world and ?difficulty: a locked course falls back to world 1 on normal (debug opens every course)
  const course = params.debug
    ? { world: Math.min(params.world ?? 1, data.worlds.length), difficulty: params.difficulty ?? "normal" }
    : firstUnlocked(progress.progress, params.world ?? 1, params.difficulty ?? "normal", data.worlds.length);
  // the env models of each world load once, before the first run of that world (spec 2026-11-21 difficulties 4.8)
  const worldModels = new Map<string, GLTF>();
  const loadWorld = async (world: number): Promise<void> => {
    for (const [id, gltf] of await loadWorldModels(models, lookOf(data.worlds[world - 1]!.id))) worldModels.set(id, gltf);
  };
  const worldModel = (id: string): GLTF => {
    const gltf = worldModels.get(id);
    if (!gltf) throw new Error(`env model ${id} is not loaded`);
    return gltf;
  };
  const [enemyModels, castle, tower, flag] = await Promise.all([
    Promise.all(data.enemies.map((enemy) => models.get(modelUrl("enemies", enemyModelId(enemy))))),
    env("castle"),
    env("tower"),
    env("flag"),
    loadWorld(course.world),
  ]);

  const scene = new Scene();
  const lighting = createLighting();
  const sunShadow = new SunShadow(lighting.sun, renderer, shadowsEnabled(params.shadows, gpu.software));
  scene.add(lighting.object, createArena(data.rules, { castle, tower, flag }));
  const arenaView = new ArenaView(data, scene, lighting, worldModel);
  const followCamera = new FollowCamera(innerWidth / innerHeight);
  const keyboard = new Keyboard(window);
  const session = new Session({ data, params, scene, camera: followCamera, keyboard });
  session.world = course.world;
  session.difficulty = course.difficulty;
  // the run behind the menu starts once the first hero's model is loaded and uses this seed
  session.seed = params.seed;
  // one view per player of a co-op run (two for now); the second hides in a run of one player
  const heroViews = [new HeroView(0), new HeroView(1), new HeroView(2), new HeroView(3)];
  for (const view of heroViews) scene.add(view.object);
  // one bake per model: a type that borrows a model shares its texture and gets its own copy of the geometry
  const bakedByModel = new Map<string, BakedVat>();
  // one mesh per enemy type, then one per boss look of a world (design/worlds.yaml bosses), all from loaded models
  const skins = crowdSkins(data);
  const modelById = new Map(data.enemies.map((enemy, type) => [enemyModelId(enemy), enemyModels[type]!]));
  const vats = skins.models.map((id) => {
    const baked = bakedByModel.get(id);
    if (baked) return { ...baked, geometry: baked.geometry.clone() };
    const vat = bakeVat(modelById.get(id)!, [WALK_CLIP, PUNCH_CLIP, IDLE_CLIP], VAT_FPS);
    bakedByModel.set(id, vat);
    return vat;
  });
  const crowd = new EnemyCrowd(
    vats,
    data.rules.enemies.maxAlive,
    hexTintTable(skins.tints),
    skins,
  );
  const crystals = new CrystalView(CRYSTAL_CAPACITY, (run) => run.crystals, crystalLook());
  const coins = new CrystalView(COIN_CAPACITY, (run) => run.coins, coinLook());
  const hearts = new CrystalView(HEART_CAPACITY, (run) => run.hearts, heartLook());
  const orbView = new OrbView();
  const chestView = new ChestView(document.getElementById("ui")!, followCamera.camera);
  const effects = new Effects(data);
  const abilityFx = new AbilityFx();
  const enemyFx = new EnemyFx(data);
  const worldView = new WorldView(data, worldModel);
  const hazardFx = new HazardFx(data, () => followCamera.shakeEnabled);
  const weatherFx = new WeatherFx(data, scene);
  const particles = new Particles(data);
  const allyView = new AllyView(ALLY_CAPACITY);
  const blobShadows = new BlobShadows(data.rules.enemies.maxAlive + ALLY_CAPACITY);
  scene.add(blobShadows.mesh, crowd.object, crystals.mesh, coins.mesh, hearts.mesh, orbView.object, chestView.object, effects.object, abilityFx.object, enemyFx.object, worldView.object, hazardFx.object, particles.object, ...allyView.objects);
  const numbers = new DamageNumbers(document.getElementById("ui")!, followCamera.camera);
  const audioData = loadAudioData();
  const audio = new AudioEngine(audioData, import.meta.env.BASE_URL);
  audio.setMuted(readStoredMuted());
  const sound: Sound = {
    active: false,
    settings: loadSettings(storage()),
    applySettings: (s) => {
      audio.setVolumes(s);
      followCamera.shakeEnabled = s.shake;
      numbers.enabled = s.numbers;
    },
    data: audioData,
    engine: audio,
    director: new MusicDirector(),
    music: new MusicPlayer(audio, audioData, import.meta.env.BASE_URL),
  };
  // browsers start audio only after a gesture: the first click or key in the menu enables it (the menu music starts then)
  const enableAudio = (): void => {
    audio.enable();
    void audio.preload();
  };
  sound.applySettings(sound.settings);
  addEventListener("pointerdown", enableAudio, { once: true });
  addEventListener("keydown", enableAudio, { once: true });
  const packArrows = new PackArrows(document.getElementById("ui")!, followCamera.camera);
  session.views.push(arenaView, weatherFx, particles, worldView, hazardFx, ...heroViews, allyView, blobShadows, crowd, crystals, coins, hearts, orbView, chestView, effects, abilityFx, enemyFx, numbers, packArrows, new SoundView(audio, audioData, sound.director, followCamera.camera, data.enemies.map((e) => e.id), () => sound.active));

  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    followCamera.resize(innerWidth / innerHeight);
  });

  const snapshot = publishSnapshot(backend, gpu);
  snapshot.render.enemyMeshes = crowd.meshCount;
  snapshot.render.shadows = sunShadow.enabled;
  session.loadoutFor = (heroId) => gear.loadout(heroId);
  session.onStart = () => gear.startRun();
  if (params.debug) {
    addDebugHooks(snapshot, () => session.run, gear, (run) => {
      for (const view of session.views) view.onEvents?.(run);
    }, (index, keep) => session.setCard(index, keep));
  }
  const publishGear = (): void => {
    snapshot.collection = namedLevels(gear.save);
    snapshot.collectionSize = gear.save.items.length;
    snapshot.gearSaved = gear.persistent;
    snapshot.unlocked = progress.unlocked();
    snapshot.progressSaved = progress.persistent;
  };
  publishGear();
  session.views.push({ update: publishGear, onEvents: () => {}, dispose: () => {} });
  // co-op: the heroes' models in player order on their views, the local hero's on the copies, and the world's
  const loadCoopModels = async (heroes: readonly string[], local: number, world: number): Promise<void> => {
    const [gltfs] = await Promise.all([Promise.all(heroes.map((id) => models.get(modelUrl("heroes", id)))), loadWorld(world)]);
    gltfs.forEach((gltf, p) => heroViews[p]?.setModel(gltf));
    allyView.setModel(gltfs[local]!);
  };
  const ui = createUi(data, gear, progress, !params.debug && !gear.persistent, session, followCamera, sound, randomSeed, hero, gpu.software, (setLoading) =>
    heroLoader(models, session, heroViews, allyView, setLoading, params.mates.filter((id) => data.heroes.some((h) => h.id === id))),
  loadWorld, loadCoopModels);
  const overlay = params.fps ? new Overlay(document.getElementById("overlay")!) : null;
  if (overlay) {
    document.getElementById("overlay")!.hidden = false;
    overlay.start(backend, 0, gpu.name);
  }

  // the first hero's model is in the scene before the shaders compile
  await ui.useHero(hero);

  // without this, WebGL2 skips objects while their programs compile in parallel, so the first
  // frames would be empty
  session.frame(0);
  await renderer.compileAsync(scene, followCamera.camera);

  runLoop(renderer, scene, followCamera, session, snapshot, overlay, ui, packArrows, heroViews, enemyFx, hazardFx, particles, sunShadow, chestView);
  // closing the page tells a co-op teammate at once (else he waits for the connection to time out)
  addEventListener("beforeunload", () => session.coop?.stop());
  // a link with ?join=<code> opens the co-op lobby and joins the room
  const joinCode = joinCodeOf(location.search);
  if (joinCode !== null) ui.joinCoop(joinCode);
}

/** Switches the run to a hero: `useHero(id, seed)` returns when the hero's model is in place (or its loading failed and the error is shown). */
type UseHero = (id: string, seed?: number) => Promise<void>;

/**
 * Loads a hero's model (cached by URL), gives it to the hero and the shadow copies, and only then starts
 * the paused menu run with that hero. When picks overlap, the last one wins; a failed load shows the error.
 */
function heroLoader(
  models: ModelCache,
  session: Session,
  heroViews: readonly HeroView[],
  allyView: AllyView,
  setLoading: (loading: boolean, failed?: boolean) => void,
  mates: readonly string[] = [],
): UseHero {
  let latest = 0;
  let errorShown = false;
  return async (id, seed = session.seed) => {
    const ticket = ++latest;
    setLoading(true);
    try {
      const gltf = await models.get(modelUrl("heroes", id));
      // ?debug=1&mate=<id>,...: the autopilot's heroes of a local co-op run
      const mateGltfs = await Promise.all(mates.map((id) => models.get(modelUrl("heroes", id))));
      // a co-op run that started meanwhile (a hero picked in the lobby just before) keeps its own models and run
      if (ticket !== latest || session.coop) {
        if (ticket === latest) setLoading(false);
        return;
      }
      heroViews[0]!.setModel(gltf);
      mateGltfs.forEach((mateGltf, i) => heroViews[i + 1]?.setModel(mateGltf));
      allyView.setModel(gltf);
      session.start(seed, true, id);
      if (errorShown) document.getElementById("error")!.hidden = true;
      errorShown = false;
      setLoading(false);
    } catch (error) {
      if (ticket !== latest) return;
      setLoading(false, true);
      errorShown = true;
      showError(new Error(`could not load the model of ${id} (${modelUrl("heroes", id)})`, { cause: error }));
    }
  };
}

interface Sound {
  settings: Settings;
  /** Applies volumes, screen shake and damage numbers. */
  applySettings(s: Settings): void;
  /** A run is on screen and not paused (the low-hp pulse beats only then); the UI keeps it current. */
  active: boolean;
  engine: AudioEngine;
  data: AudioData;
  director: MusicDirector;
  music: MusicPlayer;
}

interface Ui {
  update(width: number, height: number): void;
  readonly menuOpen: boolean;
  readonly settingsOpen: boolean;
  /** The chest card whose compare is open, or null. */
  readonly chestCompare: number | null;
  useHero: UseHero;
  /** Opens the co-op lobby and joins room `code`. */
  joinCoop(code: string): void;
}

/** Builds the menu, HUD, cards, end screen and castle pointer, and wires them to the session. */
function createUi(
  data: GameData,
  gear: GearSession,
  progress: ProgressSession,
  noSave: boolean,
  session: Session,
  followCamera: FollowCamera,
  sound: Sound,
  nextSeed: () => number,
  initialHero: string,
  softwareGpu: boolean,
  makeUseHero: (setLoading: (loading: boolean, failed?: boolean) => void) => UseHero,
  loadWorld: (world: number) => Promise<void>,
  loadCoopModels: (heroes: readonly string[], local: number, world: number) => Promise<void>,
): Ui {
  const root = document.getElementById("ui")!;
  let heroId = initialHero;
  let menuOpen = true;
  const showMenu = (): void => {
    menuOpen = true;
    menu.setVisible(true);
    end.hide();
  };
  const applyLang = (next: Lang): void => {
    lang = next;
    document.documentElement.lang = next;
    storeLang(next);
    menu.setLang(next);
  };
  const menu = new Menu(root, data.heroes, heroId, {
    // Start opens the world choice; its Start begins the run
    onStart: () => {
      sound.engine.enable();
      void sound.engine.preload();
      menu.setVisible(false);
      worldScreen.open(session.world, session.difficulty, lang);
    },
    onHero: (id) => {
      heroId = id;
      storeHero(id);
      menu.setHero(id);
      // Start waits for the model; the paused run behind the menu is then replaced by one with the new hero
      void useHero(id);
    },
    onLang: applyLang,
    onSound: () => setMuted(!muted),
    onGear: () => gearScreen.open(heroId, lang),
    onSettings: () => openSettings(false),
    onCoop: () => openCoop(),
  });
  // co-op: the lobby; the host's course comes from the world screen (`coopCourse` routes its Start and Back)
  let coopCourse = false;
  // the gear screen opened from the lobby goes back there (and a guest tells the host his new gear)
  let gearFromLobby = false;
  const lobby = new CoopLobby(root, data.heroes, {
    onHero: (id) => {
      heroId = id;
      storeHero(id);
      menu.setHero(id);
      lobby.setHero(id);
      void useHero(id);
      coop.heroChanged();
    },
    onHost: () => void coop.host(),
    onJoin: (code) => void coop.join(code),
    onStart: () => coop.chooseCourse(),
    onGear: () => {
      gearFromLobby = true;
      lobby.close();
      gearScreen.open(heroId, lang);
    },
    onSettings: () => openSettings(false),
    onBack: () => {
      coop.drop();
      lobby.close();
      lobby.set({ kind: "idle" });
      menu.setVisible(true);
    },
  });
  const openCoop = (code = ""): void => {
    sound.engine.enable();
    void sound.engine.preload();
    menu.setVisible(false);
    lobby.open(lang, heroId, code);
  };
  const coop = new CoopSetup({
    data, session, lobby,
    signal: parseSignal(new URLSearchParams(location.search).get("signal")),
    lang: () => lang,
    heroId: () => heroId,
    loadout: (id) => gear.loadout(id),
    loadModels: loadCoopModels,
    chooseCourse: () => {
      coopCourse = true;
      lobby.close();
      worldScreen.open(session.world, session.difficulty, lang);
    },
    onRunStarted: () => {
      coopCourse = false;
      // the host started while this player looked at his gear: the screen closes, the run comes up
      gearFromLobby = false;
      gearScreen.close();
      lobby.close();
      lobby.set({ kind: "idle" });
      worldScreen.close();
      menu.setVisible(false);
      menuOpen = false;
    },
    onNote: (text) => team.setNote(text),
    showError,
  });
  const worldScreen = new WorldScreen(root, {
    data, progress,
    onStart: async (world, difficulty) => {
      if (coopCourse) {
        await coop.startCourse(world, difficulty);
        return;
      }
      try {
        await loadWorld(world);
      } catch (error) {
        showError(new Error(`could not load the models of world ${world}`, { cause: error }));
        return;
      }
      // the paused run behind the menu goes on when it already has this course (debug setups made on it stay);
      // another course starts a new run with the same seed
      const run = session.run;
      if (run && run.world === world && run.difficulty === difficulty && run.hero.def.id === heroId) {
        session.paused = false;
      } else {
        session.world = world;
        session.difficulty = difficulty;
        session.start(session.seed, false, heroId);
      }
      // the salvage bank (meta/salvage.ts) goes to a run that has not stepped yet, the same as RunOptions.gold
      if (session.run && session.run.tick === 0) session.run.gold += gear.takeBank();
      menuOpen = false;
    },
    onBack: () => {
      if (coopCourse) {
        coopCourse = false;
        lobby.open(lang, heroId);
      } else menu.setVisible(true);
    },
  });
  // the settings: from the menu button, or O in a run (pauses it until the panel closes)
  let settingsPausedRun = false;
  const settingsPanel = new SettingsPanel(root, {
    onChange: (s) => {
      sound.settings = s;
      sound.applySettings(s);
      saveSettings(storage(), s);
    },
    onClose: () => closeSettings(),
  });
  const closeSettings = (): void => {
    settingsPanel.close();
    if (settingsPausedRun) session.paused = false;
    settingsPausedRun = false;
  };
  const openSettings = (fromRun: boolean): void => {
    settingsPausedRun = fromRun;
    if (fromRun) session.paused = true;
    settingsPanel.open(sound.settings, lang);
  };
  // buttons of the menu, the settings and the gear screen click
  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, input") && target.closest("#menu, #settings-panel, #gear-screen, #world-screen")) {
      sound.engine.play(sound.data.sounds["ui.click"]);
    }
  });
  // the paused run behind the menu wears the old doll: after a change it is started again
  const gearScreen = new GearScreen(root, {
    data, gear,
    onEquip: () => sound.engine.play(sound.data.sounds["gear.equip"]),
    onClose: (changed) => {
      if (changed) void useHero(heroId);
      if (gearFromLobby) {
        gearFromLobby = false;
        lobby.open(lang, heroId);
        if (changed) coop.heroChanged();
      } else menu.setVisible(true);
    },
  });
  const useHero = makeUseHero((loading, failed) => menu.setLoading(loading, failed));
  let muted = readStoredMuted();
  const setMuted = (value: boolean): void => {
    muted = value;
    sound.engine.setMuted(value);
    storeMuted(value);
    menu.setSound(!value);
  };
  menu.setSound(!muted);
  menu.setGpuWarning(softwareGpu);
  menu.setSaveWarning(noSave);
  addEventListener("keydown", (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === "KeyM") setMuted(!muted);
    else if (event.code === "KeyN" && !menuOpen) meterPanel.toggle();
    else if (event.code === "KeyO") {
      if (settingsPanel.isOpen) {
        if (settingsPausedRun) closeSettings();
      } else if (!menuOpen && session.run?.state === "playing" && !session.paused) openSettings(true);
    }
  });
  const hud = new Hud(root);
  const meterPanel = new DamageMeterPanel(root);
  hud.onLoot = (tone) => sound.engine.play(sound.data.sounds[tone === "rarity-mythic" ? "drop.mythic" : "drop.legendary"]);
  // the drop rolls for the run's course and the local hero's primary attribute (smart loot)
  hud.dropFor = (bossId, order, magicFind) => {
    const run = session.run;
    const course = run ? { world: run.world, difficulty: run.difficulty, primary: run.hero.def.primary } : {};
    return gear.onBossDeath(bossId, session.seed, order, magicFind, course);
  };
  // the HUD reads the events of every step for its news line
  session.views.push({ update: () => {}, onEvents: (run) => hud.onEvents(run, lang), dispose: () => {} });
  const pointer = new CastlePointer(root);
  const chestPointer = new ChestPointer(root);
  const cards = new Cards(root, (index, keep) => session.setCard(index, keep), (fn) => void session.asLocal(fn));
  const team = new TeamPanel(root, followCamera.camera);
  new GearPanel(root, { data, session, getLang: () => lang, menuOpen: () => menuOpen });
  const end = new EndScreen(root, () => {
    void useHero(heroId, nextSeed());
    showMenu();
  });
  menu.setLang(lang);
  let ended = false;

  return {
    useHero,
    joinCoop: (code) => {
      openCoop(code);
      void coop.join(code);
    },
    get menuOpen() {
      return menuOpen;
    },
    get chestCompare() {
      return cards.comparing;
    },
    get settingsOpen() {
      return settingsPanel.isOpen;
    },
    update(width, height) {
      const run = session.run;
      if (!run) return;
      const input: MusicInput = {
        menuOpen,
        state: run.state,
        bossAlive: latestBoss(run) >= 0,
        finale: run.inFinale,
        panelOpen: !menuOpen && session.paused,
      };
      sound.active = !menuOpen && !session.paused;
      sound.music.set(musicSlot(input));
      sound.music.setDuck(sound.director.duck(input, performance.now() / 1000));
      hud.setVisible(!menuOpen);
      if (menuOpen) {
        ended = false;
        meterPanel.hide();
        cards.hide();
        team.hide();
        pointer.hide();
        chestPointer.hide();
        return;
      }
      hud.update(run, lang);
      meterPanel.update(run, lang);
      cards.update(run, lang);
      team.update(run, lang, width, height);
      pointer.update(run, followCamera.camera, width, height);
      chestPointer.update(run, followCamera.camera, width, height);
      if ((run.state === "won" || run.state === "lost") && !ended) {
        ended = true;
        progress.record(run.world, run.difficulty, { won: run.state === "won", phase: run.inFinale ? 21 : run.phaseIndex + 1 });
        end.show(run, session.seed, lang, gear.drops);
      }
    },
  };
}

function runLoop(
  renderer: WebGPURenderer,
  scene: Scene,
  followCamera: FollowCamera,
  session: Session,
  snapshot: ReturnType<typeof publishSnapshot>,
  overlay: Overlay | null,
  ui: Ui,
  packArrows: PackArrows,
  heroViews: readonly HeroView[],
  enemyFx: EnemyFx,
  hazardFx: HazardFx,
  particles: Particles,
  sunShadow: SunShadow,
  chestView: ChestView,
): void {
  // read live, not copied once a frame: a test that clicks a card and reads it at once must not depend on a frame
  // having passed (slow software rendering)
  Object.defineProperty(snapshot, "chestCompare", { get: () => ui.chestCompare, enumerable: true, configurable: true });
  Object.defineProperty(snapshot, "settingsOpen", { get: () => ui.settingsOpen, enumerable: true, configurable: true });
  let last = -1;
  renderer.setAnimationLoop((now) => {
    try {
      if (last >= 0) {
        session.frame((now - last) / 1000);
        overlay?.frame(now - last, now, session.run?.enemies.aliveCount ?? 0);
      }
      last = now;
      chestView.labelsVisible = !ui.menuOpen && !session.paused;
      // the HUD, the cards and the snapshot show the local player (the guest of a co-op run is player 1)
      session.asLocal(() => {
        ui.update(innerWidth, innerHeight);
        updateSnapshot(snapshot, session.run, ui.menuOpen, packArrows.visible);
      });
      if (!session.run) {
        ui.update(innerWidth, innerHeight);
        updateSnapshot(snapshot, null, ui.menuOpen, packArrows.visible);
      }
      updateNet(snapshot, session);
      snapshot.render.heroModels = heroViews.reduce((n, view) => n + (view.object.visible ? view.modelCount : 0), 0);
      snapshot.render.slamRings = enemyFx.slamRingCount;
      snapshot.render.hazardRings = hazardFx.ringCount;
      snapshot.render.pools = hazardFx.poolCount;
      snapshot.render.particles = particles.visible;
      sunShadow.follow(followCamera.targetX, followCamera.targetZ);
      renderer.render(scene, followCamera.camera);
    } catch (error) {
      renderer.setAnimationLoop(null);
      showError(error);
    }
  });
}

start().catch(showError);
