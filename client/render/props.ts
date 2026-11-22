import { Box3, Color, Group, InstancedMesh, type Material, Matrix4, type Mesh, Quaternion, Vector3 } from "three/webgpu";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { SCENE_SCALE } from "./coords";
import type { PropPlacement } from "./prop-layout";

/** A prop model with its scene size at placement scale 1 (`PROP_SIZES` of client/render/world-look.ts). */
export interface PropModel {
  gltf: GLTF;
  size: number;
  by: "height" | "extent";
}

/** Materials multiplied by a tint, one clone per source material and tint (shared by every rebuild). */
const tinted = new Map<Material, Map<number, Material>>();

function tintOf(material: Material, tint: number): Material {
  if (tint === 0xffffff) return material;
  let byTint = tinted.get(material);
  if (!byTint) {
    byTint = new Map();
    tinted.set(material, byTint);
  }
  let clone = byTint.get(tint);
  if (!clone) {
    clone = material.clone();
    const coloured = clone as Material & { color?: Color };
    coloured.color?.multiply(new Color(tint));
    byTint.set(tint, clone);
  }
  return clone;
}

const UP = new Vector3(0, 1, 0);

/** Props are grouped in tiles of this many sim units, so frustum culling can skip the far ones. */
const TILE = 1000;

/**
 * Trees and rocks: one `InstancedMesh` per mesh of each model and tile, static matrices, all casting shadows.
 * `placements[].model` indexes `models`; `tint` multiplies every material's colour (0xffffff = none).
 */
export function createProps(models: readonly PropModel[], placements: PropPlacement[], tint = 0xffffff): Group {
  const group = new Group();
  models.forEach(({ gltf, size, by }, index) => {
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
    const base = size / (by === "extent" ? Math.max(box.x, box.y, box.z) : box.y);
    const meshes: Mesh[] = [];
    gltf.scene.traverse((node) => {
      if ((node as Mesh).isMesh) meshes.push(node as Mesh);
    });
    const place = new Matrix4();
    const turn = new Quaternion();
    for (const own of tiles.values()) {
      for (const mesh of meshes) {
        const material = Array.isArray(mesh.material) ? mesh.material.map((m) => tintOf(m, tint)) : tintOf(mesh.material, tint);
        const instanced = new InstancedMesh(mesh.geometry, material, own.length);
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
