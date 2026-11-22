import { Group } from "three/webgpu";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { Rules } from "../../data/schema";
import { createCastle } from "./castle";

/** The castle set, shared by every world. */
export interface EnvModels {
  castle: GLTF;
  tower: GLTF;
  flag: GLTF;
}

/** The castle in the middle. Static: built once; the ground and the forest are the world's (client/render/arena-view.ts). */
export function createArena(rules: Rules, env: EnvModels): Group {
  const group = new Group();
  group.add(createCastle(env, rules));
  return group;
}
