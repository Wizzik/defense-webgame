import { Box3, Group, InstancedMesh, Matrix4, type Mesh, Quaternion, Vector3 } from "three/webgpu";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { SCENE_SCALE } from "./coords";
import type { PropPlacement } from "./prop-layout";

/** The env models used as props and the scene height of each at placement scale 1 (the kit models are tiny). */
export const PROP_MODELS: readonly { id: string; height: number }[] = [
  { id: "tree-a", height: 4.5 },
  { id: "tree-b", height: 4.5 },
  { id: "trees-a", height: 4.5 },
  { id: "trees-b", height: 4.5 },
  { id: "trees-c", height: 4.5 },
  { id: "rock-a", height: 1.6 },
  { id: "rock-b", height: 1.6 },
  { id: "rock-c", height: 1.6 },
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
      tiles.set(key, [...(tiles.get(key) ?? []), p]);
    }
    if (tiles.size === 0) return;
    gltf.scene.updateMatrixWorld(true);
    const height = new Box3().setFromObject(gltf.scene).getSize(new Vector3()).y;
    const base = (PROP_MODELS[index]?.height ?? 1) / height;
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
