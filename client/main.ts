/// <reference types="vite/client" />
import { Scene, type WebGPURenderer } from "three/webgpu";
import type { GameData } from "../data/schema";
import { ALLY_CAPACITY, COIN_CAPACITY, CRYSTAL_CAPACITY } from "../sim";
import { Sfx } from "./audio/sfx";
import { SoundView } from "./audio/sound-view";
import { loadGameData } from "./game/data";
import { addDebugHooks, publishSnapshot, updateSnapshot } from "./game/debug";
import { GearSession } from "./game/gear-session";
import { indexedDbBackend, memoryBackend } from "./game/save-store";
import { Keyboard } from "./game/keyboard";
import { readGameParams } from "./game/params";
import { Session } from "./game/session";
import { Overlay } from "./perf/overlay";
import { FollowCamera } from "./render/camera";
import { createRenderer, describeGpu, NoGpuError } from "./render/gpu";
import { ChestView } from "./render/chest-view";
import { coinLook, crystalLook, CrystalView } from "./render/crystal-view";
import { DamageNumbers } from "./render/damage-numbers";
import { AbilityFx } from "./render/ability-fx";
import { Effects } from "./render/effects";
import { EnemyFx } from "./render/enemy-fx";
import { tintTable } from "./render/enemy-tints";
import { EnemyCrowd, IDLE_CLIP, PUNCH_CLIP, VAT_FPS, WALK_CLIP } from "./render/enemy-crowd";
import { AllyView } from "./render/ally-view";
import { HeroView } from "./render/hero-view";
import { BlobShadows } from "./render/blob-shadows";
import { SunShadow, shadowsEnabled } from "./render/shadows";
import { createLighting } from "./render/lighting";
import { createArena } from "./render/scene";
import { PROP_MODELS } from "./render/props";
import { enemyModelId, ModelCache, modelUrl } from "./render/models";
import { type BakedVat, bakeVat } from "./render/vat";
import { Cards } from "./ui/cards";
import { CastlePointer } from "./ui/castle-pointer";
import { ChestPointer } from "./ui/chest-pointer";
import { EndScreen } from "./ui/end-screen";
import { GearPanel } from "./ui/gear-panel";
import { Hud } from "./ui/hud";
import { type Lang, pickLang, t } from "./ui/i18n";
import { Menu } from "./ui/menu";
import { PackArrows } from "./ui/pack-arrows";
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
  const hero = pickHero(data, params.hero, readStoredHero());
  const { renderer, backend } = await createRenderer(params.renderer, document.body);
  const gpu = describeGpu(renderer.backend, backend);
  const models = new ModelCache();
  const env = (id: string) => models.get(modelUrl("env", id));
  const [enemyModels, castle, tower, flag, props] = await Promise.all([
    Promise.all(data.enemies.map((enemy) => models.get(modelUrl("enemies", enemyModelId(enemy))))),
    env("castle"),
    env("tower"),
    env("flag"),
    Promise.all(PROP_MODELS.map((prop) => env(prop.id))),
  ]);

  const scene = new Scene();
  const lighting = createLighting();
  lighting.applyTo(scene);
  const sunShadow = new SunShadow(lighting.sun, renderer, shadowsEnabled(params.shadows, gpu.software));
  scene.add(lighting.object, createArena(data.rules, { castle, tower, flag, props }));
  const followCamera = new FollowCamera(innerWidth / innerHeight);
  const keyboard = new Keyboard(window);
  const session = new Session({ data, params, scene, camera: followCamera, keyboard });
  // the run behind the menu starts once the first hero's model is loaded and uses this seed
  session.seed = params.seed;
  const heroView = new HeroView();
  scene.add(heroView.object);
  // one bake per model: a type that borrows a model shares its texture and gets its own copy of the geometry
  const bakedByModel = new Map<string, BakedVat>();
  const vats = data.enemies.map((enemy, type) => {
    const id = enemyModelId(enemy);
    const baked = bakedByModel.get(id);
    if (baked) return { ...baked, geometry: baked.geometry.clone() };
    const vat = bakeVat(enemyModels[type], [WALK_CLIP, PUNCH_CLIP, IDLE_CLIP], VAT_FPS);
    bakedByModel.set(id, vat);
    return vat;
  });
  const crowd = new EnemyCrowd(
    vats,
    data.rules.enemies.maxAlive,
    tintTable(data.enemies),
  );
  const crystals = new CrystalView(CRYSTAL_CAPACITY, (run) => run.crystals, crystalLook());
  const coins = new CrystalView(COIN_CAPACITY, (run) => run.coins, coinLook());
  const chestView = new ChestView(document.getElementById("ui")!, followCamera.camera);
  const effects = new Effects(data);
  const abilityFx = new AbilityFx();
  const enemyFx = new EnemyFx(data);
  const allyView = new AllyView(ALLY_CAPACITY);
  const blobShadows = new BlobShadows(data.rules.enemies.maxAlive + ALLY_CAPACITY);
  scene.add(blobShadows.mesh, crowd.object, crystals.mesh, coins.mesh, chestView.object, effects.object, abilityFx.object, enemyFx.object, ...allyView.objects);
  const numbers = new DamageNumbers(document.getElementById("ui")!, followCamera.camera);
  const sfx = new Sfx();
  sfx.setMuted(readStoredMuted());
  const packArrows = new PackArrows(document.getElementById("ui")!, followCamera.camera);
  session.views.push(heroView, allyView, blobShadows, crowd, crystals, coins, chestView, effects, abilityFx, enemyFx, numbers, packArrows, new SoundView(sfx));

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
    });
  }
  const publishGear = (): void => {
    snapshot.collection = gear.save.items;
    snapshot.gearSaved = gear.persistent;
  };
  publishGear();
  session.views.push({ update: publishGear, onEvents: () => {}, dispose: () => {} });
  const ui = createUi(data, gear, !params.debug && !gear.persistent, session, followCamera, sfx, randomSeed, hero, gpu.software, (setLoading) =>
    heroLoader(models, session, heroView, allyView, setLoading),
  );
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

  runLoop(renderer, scene, followCamera, session, snapshot, overlay, ui, packArrows, heroView, enemyFx, sunShadow, chestView);
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
  heroView: HeroView,
  allyView: AllyView,
  setLoading: (loading: boolean, failed?: boolean) => void,
): UseHero {
  let latest = 0;
  let errorShown = false;
  return async (id, seed = session.seed) => {
    const ticket = ++latest;
    setLoading(true);
    try {
      const gltf = await models.get(modelUrl("heroes", id));
      if (ticket !== latest) return;
      heroView.setModel(gltf);
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

interface Ui {
  update(width: number, height: number): void;
  readonly menuOpen: boolean;
  useHero: UseHero;
}

/** Builds the menu, HUD, cards, end screen and castle pointer, and wires them to the session. */
function createUi(
  data: GameData,
  gear: GearSession,
  noSave: boolean,
  session: Session,
  followCamera: FollowCamera,
  sfx: Sfx,
  nextSeed: () => number,
  initialHero: string,
  softwareGpu: boolean,
  makeUseHero: (setLoading: (loading: boolean, failed?: boolean) => void) => UseHero,
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
    onStart: () => {
      sfx.enable();
      menuOpen = false;
      session.paused = false;
      menu.setVisible(false);
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
  });
  const useHero = makeUseHero((loading, failed) => menu.setLoading(loading, failed));
  let muted = readStoredMuted();
  const setMuted = (value: boolean): void => {
    muted = value;
    sfx.setMuted(value);
    storeMuted(value);
    menu.setSound(!value);
  };
  menu.setSound(!muted);
  menu.setGpuWarning(softwareGpu);
  menu.setSaveWarning(noSave);
  addEventListener("keydown", (event) => {
    if (event.code === "KeyM" && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
      setMuted(!muted);
    }
  });
  const hud = new Hud(root);
  hud.dropFor = (bossId, order) => gear.onBossDeath(bossId, session.seed, order);
  // the HUD reads the events of every step for its news line
  session.views.push({ update: () => {}, onEvents: (run) => hud.onEvents(run, lang), dispose: () => {} });
  const pointer = new CastlePointer(root);
  const chestPointer = new ChestPointer(root);
  const cards = new Cards(root, (index) => session.setCard(index));
  new GearPanel(root, { data, session, getLang: () => lang, menuOpen: () => menuOpen });
  const end = new EndScreen(root, () => {
    void useHero(heroId, nextSeed());
    showMenu();
  });
  menu.setLang(lang);
  let ended = false;

  return {
    useHero,
    get menuOpen() {
      return menuOpen;
    },
    update(width, height) {
      const run = session.run;
      if (!run) return;
      hud.setVisible(!menuOpen);
      if (menuOpen) {
        ended = false;
        cards.hide();
        pointer.hide();
        chestPointer.hide();
        return;
      }
      hud.update(run, lang);
      cards.update(run, lang);
      pointer.update(run, followCamera.camera, width, height);
      chestPointer.update(run, followCamera.camera, width, height);
      if ((run.state === "won" || run.state === "lost") && !ended) {
        ended = true;
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
  heroView: HeroView,
  enemyFx: EnemyFx,
  sunShadow: SunShadow,
  chestView: ChestView,
): void {
  let last = -1;
  renderer.setAnimationLoop((now) => {
    try {
      if (last >= 0) {
        session.frame((now - last) / 1000);
        overlay?.frame(now - last, now, session.run?.enemies.aliveCount ?? 0);
      }
      last = now;
      chestView.labelsVisible = !ui.menuOpen && !session.paused;
      ui.update(innerWidth, innerHeight);
      updateSnapshot(snapshot, session.run, ui.menuOpen, packArrows.visible);
      snapshot.render.heroModels = heroView.modelCount;
      snapshot.render.slamRings = enemyFx.slamRingCount;
      sunShadow.follow(followCamera.targetX, followCamera.targetZ);
      renderer.render(scene, followCamera.camera);
    } catch (error) {
      renderer.setAnimationLoop(null);
      showError(error);
    }
  });
}

start().catch(showError);
