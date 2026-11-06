/// <reference types="vite/client" />
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { Color, Scene, type WebGPURenderer } from "three/webgpu";
import type { GameData } from "../data/schema";
import { CRYSTAL_CAPACITY } from "../sim";
import { Sfx } from "./audio/sfx";
import { SoundView } from "./audio/sound-view";
import { loadGameData } from "./game/data";
import { addDebugHooks, publishSnapshot, updateSnapshot } from "./game/debug";
import { Keyboard } from "./game/keyboard";
import { readGameParams } from "./game/params";
import { Session } from "./game/session";
import { Overlay } from "./perf/overlay";
import { FollowCamera } from "./render/camera";
import { createRenderer, NoGpuError } from "./render/gpu";
import { CrystalView } from "./render/crystal-view";
import { DamageNumbers } from "./render/damage-numbers";
import { Effects } from "./render/effects";
import { EnemyCrowd, IDLE_CLIP, PUNCH_CLIP, VAT_FPS, WALK_CLIP } from "./render/enemy-crowd";
import { HeroView } from "./render/hero-view";
import { createArena } from "./render/scene";
import { bakeVat } from "./render/vat";
import { Cards } from "./ui/cards";
import { CastlePointer } from "./ui/castle-pointer";
import { EndScreen } from "./ui/end-screen";
import { Hud } from "./ui/hud";
import { type Lang, pickLang, t } from "./ui/i18n";
import { Menu } from "./ui/menu";
import "./ui/style.css";

const MODEL_URL = `${import.meta.env.BASE_URL}models/robot-expressive/RobotExpressive.glb`;

const ENEMY_TINT = 0x771111;
const LANG_KEY = "defense-webgame.lang";
const MUTE_KEY = "defense-webgame.muted";

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

function randomSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000);
}

/** The model loads twice at most: a failed first try may be a network blip (spec 7). */
async function loadModel(): Promise<GLTF> {
  const loader = new GLTFLoader();
  try {
    return await loader.loadAsync(MODEL_URL);
  } catch (error) {
    console.warn("model load failed, retrying once", error);
    return loader.loadAsync(MODEL_URL);
  }
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
  const { renderer, backend } = await createRenderer(params.renderer, document.body);
  const gltf = await loadModel();

  const scene = new Scene();
  scene.background = new Color(0x1d2228);
  scene.add(createArena(data.rules));
  const followCamera = new FollowCamera(innerWidth / innerHeight);
  const keyboard = new Keyboard(window);
  const session = new Session({ data, params, scene, camera: followCamera, keyboard });
  const heroView = new HeroView(gltf);
  scene.add(heroView.object);
  const crowd = new EnemyCrowd(
    bakeVat(gltf, [WALK_CLIP, PUNCH_CLIP, IDLE_CLIP], VAT_FPS),
    data.rules.enemies.maxAlive,
    ENEMY_TINT,
  );
  const crystals = new CrystalView(CRYSTAL_CAPACITY);
  const effects = new Effects(data);
  scene.add(crowd.mesh, crystals.mesh, effects.object);
  const numbers = new DamageNumbers(document.getElementById("ui")!, followCamera.camera);
  const sfx = new Sfx();
  sfx.setMuted(readStoredMuted());
  session.views.push(heroView, crowd, crystals, effects, numbers, new SoundView(sfx));
  // the menu shows a fresh, paused run behind it
  session.start(params.seed, true);

  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    followCamera.resize(innerWidth / innerHeight);
  });

  const snapshot = publishSnapshot(backend);
  if (params.debug) addDebugHooks(snapshot, () => session.run);
  const ui = createUi(data, session, followCamera, sfx, randomSeed);
  const overlay = params.fps ? new Overlay(document.getElementById("overlay")!) : null;
  if (overlay) {
    document.getElementById("overlay")!.hidden = false;
    overlay.start(backend, 0);
  }

  // without this, WebGL2 skips objects while their programs compile in parallel, so the first
  // frames would be empty
  session.frame(0);
  await renderer.compileAsync(scene, followCamera.camera);

  runLoop(renderer, scene, followCamera, session, snapshot, overlay, ui);
}

interface Ui {
  update(width: number, height: number): void;
  readonly menuOpen: boolean;
}

/** Builds the menu, HUD, cards, end screen and castle pointer, and wires them to the session. */
function createUi(data: GameData, session: Session, followCamera: FollowCamera, sfx: Sfx, nextSeed: () => number): Ui {
  const root = document.getElementById("ui")!;
  const heroDef = data.heroes.find((h) => h.id === data.rules.slice.hero)!;
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
    menu.setLang(next, heroDef.name[next]);
  };
  const menu = new Menu(root, {
    onStart: () => {
      sfx.enable();
      menuOpen = false;
      session.paused = false;
      menu.setVisible(false);
    },
    onLang: applyLang,
    onSound: () => setMuted(!muted),
  });
  let muted = readStoredMuted();
  const setMuted = (value: boolean): void => {
    muted = value;
    sfx.setMuted(value);
    storeMuted(value);
    menu.setSound(!value);
  };
  menu.setSound(!muted);
  addEventListener("keydown", (event) => {
    if (event.code === "KeyM" && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
      setMuted(!muted);
    }
  });
  const hud = new Hud(root);
  const pointer = new CastlePointer(root);
  const cards = new Cards(root, (index) => session.setCard(index));
  const end = new EndScreen(root, () => {
    session.start(nextSeed(), true);
    showMenu();
  });
  menu.setLang(lang, heroDef.name[lang]);
  let ended = false;

  return {
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
        return;
      }
      hud.update(run, lang);
      cards.update(run, lang);
      pointer.update(run, followCamera.camera, width, height);
      if ((run.state === "won" || run.state === "lost") && !ended) {
        ended = true;
        end.show(run, session.seed, lang);
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
): void {
  let last = -1;
  renderer.setAnimationLoop((now) => {
    try {
      if (last >= 0) {
        session.frame((now - last) / 1000);
        overlay?.frame(now - last, now, session.run?.enemies.aliveCount ?? 0);
      }
      last = now;
      ui.update(innerWidth, innerHeight);
      updateSnapshot(snapshot, session.run, ui.menuOpen);
      renderer.render(scene, followCamera.camera);
    } catch (error) {
      renderer.setAnimationLoop(null);
      showError(error);
    }
  });
}

start().catch(showError);
