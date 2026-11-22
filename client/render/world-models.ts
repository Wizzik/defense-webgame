import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { type ModelCache, modelUrl } from "./models";
import { type WorldLook, worldModelIds } from "./world-look";

/**
 * Loads the env models of one world (its islands, forest and bush; spec 2026-11-21 difficulties 4.8), each once:
 * the cache keeps every model by URL, so switching back to a world downloads nothing.
 */
export async function loadWorldModels(cache: ModelCache, look: WorldLook): Promise<Map<string, GLTF>> {
  const ids = worldModelIds(look);
  const models = await Promise.all(ids.map((id) => cache.get(modelUrl("env", id))));
  return new Map(ids.map((id, i) => [id, models[i]!]));
}
