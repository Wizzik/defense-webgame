/// <reference types="vite/client" />
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardNodeMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGPURenderer,
} from "three/webgpu";
import { bakeVat } from "../render/vat";
import { Crowd, RUN_CLIP, WALK_CLIP } from "./crowd";
import { type Backend, Overlay } from "../perf/overlay";

const MODEL_URL = `${import.meta.env.BASE_URL}models/robot-expressive/RobotExpressive.glb`;
const VAT_FPS = 30;
const FLOOR_SIZE = 200;
/** Camera pitch below the horizon. */
const CAMERA_TILT_DEG = 55;
const CAMERA_FOV_DEG = 35;
const CAMERA_DISTANCE = 70;
/** Longest simulated step; a longer frame (for example after a hidden tab) is cut to it. */
const MAX_STEP_S = 0.1;

interface SpikeParams {
  n: number;
  renderer: "webgpu" | "webgl2";
  seed: number;
}

function readParams(search: string): SpikeParams {
  const params = new URLSearchParams(search);
  const n = Number.parseInt(params.get("n") ?? "", 10);
  const seed = Number.parseInt(params.get("seed") ?? "", 10);
  return {
    n: Number.isNaN(n) ? 150 : Math.min(2000, Math.max(1, n)),
    renderer: params.get("renderer") === "webgl2" ? "webgl2" : "webgpu",
    seed: Number.isNaN(seed) ? 1 : seed,
  };
}

function createScene(crowd: Crowd): Scene {
  const scene = new Scene();
  scene.background = new Color(0x1d2228);
  const floor = new Mesh(
    new PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
    new MeshStandardNodeMaterial({ color: 0x56614c, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  const sun = new DirectionalLight(0xffffff, 2.5);
  sun.position.set(30, 60, 20);
  scene.add(floor, crowd.mesh, sun, new AmbientLight(0xffffff, 0.7));
  return scene;
}

function createCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(CAMERA_FOV_DEG, innerWidth / innerHeight, 1, 500);
  const tilt = (CAMERA_TILT_DEG * Math.PI) / 180;
  camera.position.set(0, Math.sin(tilt) * CAMERA_DISTANCE, Math.cos(tilt) * CAMERA_DISTANCE);
  camera.lookAt(0, 0, 0);
  return camera;
}

async function start(overlay: Overlay): Promise<void> {
  const params = readParams(location.search);
  const renderer = new WebGPURenderer({ forceWebGL: params.renderer === "webgl2" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.body.prepend(renderer.domElement);
  await renderer.init();
  // `Backend` does not declare the flag; WebGPUBackend sets it to true
  const backend: Backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? "WebGPU" : "WebGL2";

  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  const vat = bakeVat(gltf, [WALK_CLIP, RUN_CLIP], VAT_FPS);
  const crowd = new Crowd(vat, { count: params.n, seed: params.seed, fps: VAT_FPS });
  const scene = createScene(crowd);
  const camera = createCamera();
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // without this, WebGL2 skips the crowd while its program compiles in parallel, so the first
  // counted frames would be empty and the stats would include the compile stall
  await renderer.compileAsync(scene, camera);

  overlay.start(backend, params.n);
  let last = -1;
  renderer.setAnimationLoop((now) => {
    if (last >= 0) {
      crowd.update(Math.min((now - last) / 1000, MAX_STEP_S));
      overlay.frame(now - last, now);
    }
    last = now;
    renderer.render(scene, camera);
  });
}

const overlay = new Overlay(document.getElementById("overlay")!, true);
start(overlay).catch((error: unknown) => {
  overlay.showError(error);
  console.error(error);
});
