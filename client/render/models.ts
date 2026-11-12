import { type GLTF, GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** URL of a built model; it works in `vite dev` and under the Pages base path. */
export function modelUrl(kind: "heroes" | "enemies" | "env", id: string): string {
  return `${import.meta.env.BASE_URL}models/${kind}/${id}.glb`;
}

/**
 * One pending or finished load per URL. A failed load is tried once more (it may be a network
 * blip, spec 7); when that fails too, the URL leaves the cache so a later `get` tries again.
 */
export class ModelCache {
  private readonly entries = new Map<string, Promise<GLTF>>();

  constructor(private readonly load: (url: string) => Promise<GLTF> = defaultLoad) {}

  get(url: string): Promise<GLTF> {
    let entry = this.entries.get(url);
    if (!entry) {
      entry = this.loadWithRetry(url);
      this.entries.set(url, entry);
      entry.catch(() => this.entries.delete(url));
    }
    return entry;
  }

  private async loadWithRetry(url: string): Promise<GLTF> {
    try {
      return await this.load(url);
    } catch (error) {
      console.warn(`model load failed, retrying once: ${url}`, error);
      return this.load(url);
    }
  }
}

const loader = new GLTFLoader();

function defaultLoad(url: string): Promise<GLTF> {
  return loader.loadAsync(url);
}
