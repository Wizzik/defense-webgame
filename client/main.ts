/// <reference types="vite/client" />
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { Color, Scene, type WebGPURenderer } from "three/webgpu";
import { loadGameData } from "./game/data";
import { publishSnapshot, updateSnapshot } from "./game/debug";
import { Keyboard } from "./game/keyboard";
import { readGameParams } from "./game/params";
import { Session } from "./game/session";
import { Overlay } from "./perf/overlay";
import { FollowCamera } from "./render/camera";
import { createRenderer, NoGpuError } from "./render/gpu";
import { HeroView } from "./render/hero-view";
import { createArena } from "./render/scene";
import { pickLang, setLang, t } from "./ui/i18n";

const MODEL_URL = `${import.meta.env.BASE_URL}models/robot-expressive/RobotExpressive.glb`;

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
  element.textContent = error instanceof NoGpuError ? t("error.noGpu") : t("error.generic");
  element.hidden = false;
}

async function start(): Promise<void> {
  const params = readGameParams(location.search, randomSeed);
  setLang(pickLang(params.lang, navigator.language));

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
  session.views.push(heroView);
  session.start(params.seed);

  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    followCamera.resize(innerWidth / innerHeight);
  });

  const snapshot = publishSnapshot(backend);
  const overlay = params.fps ? new Overlay(document.getElementById("overlay")!) : null;
  if (overlay) {
    document.getElementById("overlay")!.hidden = false;
    overlay.start(backend, 0);
  }

  // without this, WebGL2 skips objects while their programs compile in parallel, so the first
  // frames would be empty
  session.frame(0);
  await renderer.compileAsync(scene, followCamera.camera);

  runLoop(renderer, scene, followCamera, session, snapshot, overlay);
}

function runLoop(
  renderer: WebGPURenderer,
  scene: Scene,
  followCamera: FollowCamera,
  session: Session,
  snapshot: ReturnType<typeof publishSnapshot>,
  overlay: Overlay | null,
): void {
  let last = -1;
  renderer.setAnimationLoop((now) => {
    try {
      if (last >= 0) {
        session.frame((now - last) / 1000);
        overlay?.frame(now - last, now, session.run?.enemies.aliveCount ?? 0);
      }
      last = now;
      updateSnapshot(snapshot, session.run);
      renderer.render(scene, followCamera.camera);
    } catch (error) {
      renderer.setAnimationLoop(null);
      showError(error);
    }
  });
}

start().catch(showError);
