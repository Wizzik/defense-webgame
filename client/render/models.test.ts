import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import enemies from "../../data/generated/enemies.json";
import { enemyModelId, ModelCache } from "./models";

const model = (name: string) => ({ name }) as unknown as GLTF;

describe("ModelCache", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("loads a URL once for two concurrent gets", async () => {
    const load = vi.fn(async () => model("a"));
    const cache = new ModelCache(load);
    const [first, second] = await Promise.all([cache.get("a.glb"), cache.get("a.glb")]);
    expect(first).toBe(second);
    expect(load).toHaveBeenCalledTimes(1);
    await cache.get("a.glb");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("retries a failed load once", async () => {
    const load = vi.fn<(url: string) => Promise<GLTF>>();
    load.mockRejectedValueOnce(new Error("blip")).mockResolvedValueOnce(model("a"));
    const result = await new ModelCache(load).get("a.glb");
    expect(result).toEqual(model("a"));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("rejects after two failures and tries again on the next get", async () => {
    const load = vi.fn<(url: string) => Promise<GLTF>>();
    load.mockRejectedValue(new Error("down"));
    const cache = new ModelCache(load);
    await expect(cache.get("a.glb")).rejects.toThrow("down");
    expect(load).toHaveBeenCalledTimes(2);
    load.mockResolvedValueOnce(model("a"));
    await expect(cache.get("a.glb")).resolves.toEqual(model("a"));
    expect(load).toHaveBeenCalledTimes(3);
  });
});

describe("enemyModelId", () => {
  it("a boss uses the model of its source type", () => {
    const ids = Object.fromEntries(enemies.map((e) => [e.id, enemyModelId(e)]));
    expect(ids["lancer"]).toBe("lancer");
    expect(ids["iron-marshal"]).toBe("lancer");
    expect(ids["pale-abbot"]).toBe("chaplain");
    expect(ids["gunmaster"]).toBe("musketeer");
    expect(ids["dread-regent"]).toBe("captain");
  });
});
