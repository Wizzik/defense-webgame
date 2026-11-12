import { Group } from "three/webgpu";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { Rules } from "../../data/schema";
import { createCastle } from "./castle";
import { createGround } from "./ground";
import { layoutProps } from "./prop-layout";
import { createProps } from "./props";

/** The environment models: the castle set and the prop models in `PROP_MODELS` order. */
export interface EnvModels {
  castle: GLTF;
  tower: GLTF;
  flag: GLTF;
  props: GLTF[];
}

/** The forest looks the same in every run. */
const PROP_SEED = 1;

/** Ground, castle in the middle and the forest beyond the spawn ring. Static: built once. */
export function createArena(rules: Rules, env: EnvModels): Group {
  const group = new Group();
  group.add(
    createGround(rules),
    createCastle(env, rules),
    createProps(env.props, layoutProps(rules, env.props.length, PROP_SEED)),
  );
  return group;
}
