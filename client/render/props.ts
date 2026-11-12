import { Box3, Group, InstancedMesh, Matrix4, type Mesh, Quaternion, Vector3 } from "three/webgpu";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { SCENE_SCALE } from "./coords";
import type { PropPlacement } from "./prop-layout";

/**
 * The env models used as props and the scene size of each at placement scale 1 (the kit models are tiny):
 * the height for trees, the largest extent for rocks, which are wide and flat. A rock stays below the hero's
 * height (3.08 scene units) even at the largest placement scale 1.4.
 */
export const PROP_MODELS: readonly { id: string; size: number; by: "height" | "extent" }[] = [
  { id: "tree-a", size: 4.5, by: "height" },
  { id: "tree-b", size: 4.5, by: "height" },
  { id: "trees-a", size: 4.5, by: "height" },
  { id: "trees-b", size: 4.5, by: "height" },
  { id: "trees-c", size: 4.5, by: "height" },
  { id: "rock-a", size: 2, by: "extent" },
  { id: "rock-b", size: 2, by: "extent" },
  { id: "rock-c", size: 2, by: "extent" },
];

const UP = new Vector3(0, 1, 0);

/** Props are grouped in tiles of this many sim units, so frustum culling can skip the far ones. */
const TILE = 1000;

/** Trees and rocks: one `InstancedMesh` per mesh of each model and tile, static matrices, all casting shadows. */
export function createProps(models: GLTF[], placements: PropPlacement[]): Group {
  const group = new Group();
  models.forEach((gltf, index) => {
    const tiles = new Map<string, PropPlacement[]>();
    for (const p of placements) {
      if (p.model !== index) continue;
      const key = `${Math.floor(p.x / TILE)},${Math.floor(p.y / TILE)}`;
      const tile = tiles.get(key);
      if (tile) tile.push(p);
      else tiles.set(key, [p]);
    }
    if (tiles.size === 0) return;
    gltf.scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(gltf.scene).getSize(new Vector3());
    const prop = PROP_MODELS[index];
    const base = (prop?.size ?? 1) / (prop?.by === "extent" ? Math.max(box.x, box.y, box.z) : box.y);
    const meshes: Mesh[] = [];
    gltf.scene.traverse((node) => {
      if ((node as Mesh).isMesh) meshes.push(node as Mesh);
    });
    const place = new Matrix4();
    const turn = new Quaternion();
    for (const own of tiles.values()) {
      for (const mesh of meshes) {
        const instanced = new InstancedMesh(mesh.geometry, mesh.material, own.length);
        own.forEach((p, i) => {
          const scale = base * p.scale;
          turn.setFromAxisAngle(UP, (p.turn * Math.PI) / 2);
          place.compose(new Vector3(p.x * SCENE_SCALE, 0, -p.y * SCENE_SCALE), turn, new Vector3(scale, scale, scale));
          instanced.setMatrixAt(i, place.multiply(mesh.matrixWorld));
        });
        instanced.instanceMatrix.needsUpdate = true;
        instanced.castShadow = true;
        instanced.receiveShadow = true;
        instanced.matrixAutoUpdate = false;
        group.add(instanced);
      }
    }
  });
  return group;
}
