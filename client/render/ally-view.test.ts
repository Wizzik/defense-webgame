import { AnimationClip, BoxGeometry, Group, type Material, Mesh, MeshStandardMaterial, type Object3D } from "three/webgpu";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it, vi } from "vitest";
import { AllyView, IMAGE_POOL } from "./ally-view";

/** A minimal hero model: one mesh named `tag`, with the four clips a Figure needs. */
function fakeHero(tag: string): GLTF {
  const scene = new Group();
  const mesh = new Mesh(new BoxGeometry(1, 2, 1), new MeshStandardMaterial());
  mesh.name = tag;
  scene.add(mesh);
  const animations = ["Idle", "Running", "Punch", "Death"].map((name) => new AnimationClip(name, 1, []));
  return { scene, animations } as unknown as GLTF;
}

const holdersOf = (view: AllyView): Object3D[] => view.objects.slice(2) as Object3D[];

function meshNames(holder: Object3D): string[] {
  const names: string[] = [];
  holder.traverse((node) => {
    if ((node as Mesh).isMesh) names.push(node.name);
  });
  return names;
}

describe("AllyView.setModel", () => {
  it("replaces every copy with a figure of the new model and frees the old ones", () => {
    const view = new AllyView(4);
    expect(holdersOf(view)).toHaveLength(IMAGE_POOL);

    view.setModel(fakeHero("first"));
    const oldMaterials: Material[] = [];
    for (const holder of holdersOf(view)) {
      holder.traverse((node) => {
        if ((node as Mesh).isMesh) oldMaterials.push((node as Mesh).material as Material);
      });
    }
    expect(oldMaterials).toHaveLength(IMAGE_POOL);
    const disposed = vi.fn();
    for (const material of oldMaterials) material.addEventListener("dispose", disposed);

    view.setModel(fakeHero("second"));

    for (const holder of holdersOf(view)) {
      expect(holder.children, "one figure per holder").toHaveLength(1);
      expect(meshNames(holder)).toEqual(["second"]);
    }
    expect(disposed).toHaveBeenCalledTimes(IMAGE_POOL);
  });
});
