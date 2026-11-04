import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import {
  AnimationClip,
  AnimationMixer,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  FloatType,
  Matrix3,
  type Mesh,
  type MeshStandardMaterial,
  NearestFilter,
  RGBAFormat,
  type SkinnedMesh,
  Vector3,
} from "three/webgpu";

/** Rows of one baked clip inside the VAT texture. */
export interface VatClip {
  startRow: number;
  rows: number;
}

export interface BakedVat {
  /**
   * All meshes of the model merged in the default pose (positions, normals, material colour as
   * vertex colour) plus `vatIndex`, the column of each vertex in the texture.
   */
  geometry: BufferGeometry;
  /** RGBA float texture: column = vertex, row = sampled frame, rgb = model-space position. */
  texture: DataTexture;
  clips: Record<string, VatClip>;
}

// WebGPU guarantees 2D textures up to 8192 texels wide; a bigger model needs another layout
const MAX_TEXTURE_WIDTH = 8192;

/**
 * Bakes vertex animation of the given clips, sampled `fps` times per second, into a texture.
 * Rigid meshes attached to bones and skinned meshes are both baked through
 * `getVertexPosition` and the mesh world matrix, so the result is in the model's space.
 * Leaves the model in its default pose.
 */
export function bakeVat(gltf: GLTF, clipNames: string[], fps: number): BakedVat {
  const meshes: Mesh[] = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((object) => {
    if ((object as Mesh).isMesh) meshes.push(object as Mesh);
  });
  const vertexCount = meshes.reduce((sum, mesh) => sum + mesh.geometry.attributes.position.count, 0);
  if (vertexCount > MAX_TEXTURE_WIDTH) {
    throw new Error(`bakeVat: ${vertexCount} vertices do not fit a ${MAX_TEXTURE_WIDTH} texel wide texture`);
  }
  const geometry = mergeDefaultPose(meshes, vertexCount);
  const { texture, clips } = bakeClips(gltf, meshes, vertexCount, clipNames, fps);
  return { geometry, texture, clips };
}

function mergeDefaultPose(meshes: Mesh[], vertexCount: number): BufferGeometry {
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const vatIndex = new Float32Array(vertexCount);
  const indices: number[] = [];
  const vector = new Vector3();
  const tip = new Vector3();
  const origin = new Vector3();
  const normalMatrix = new Matrix3();
  let offset = 0;
  for (const mesh of meshes) {
    const { position, normal } = mesh.geometry.attributes;
    const { color } = mesh.material as MeshStandardMaterial;
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    for (let i = 0; i < position.count; i++) {
      const vertex = offset + i;
      mesh.getVertexPosition(i, vector).applyMatrix4(mesh.matrixWorld).toArray(positions, vertex * 3);
      tip.fromBufferAttribute(normal, i);
      if ((mesh as SkinnedMesh).isSkinnedMesh) {
        // skinning is affine, so skin(n) - skin(0) is the skinned normal; the default pose of
        // this model's skinned hands differs from their bind pose
        const skinned = mesh as SkinnedMesh;
        skinned.applyBoneTransform(i, tip).sub(skinned.applyBoneTransform(i, origin.set(0, 0, 0)));
      }
      tip.applyMatrix3(normalMatrix).normalize().toArray(normals, vertex * 3);
      color.toArray(colors, vertex * 3);
      vatIndex[vertex] = vertex;
    }
    const index = mesh.geometry.index;
    const count = index ? index.count : position.count;
    for (let k = 0; k < count; k++) indices.push(offset + (index ? index.getX(k) : k));
    offset += position.count;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(normals, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setAttribute("vatIndex", new BufferAttribute(vatIndex, 1));
  geometry.setIndex(indices);
  return geometry;
}

function bakeClips(
  gltf: GLTF,
  meshes: Mesh[],
  vertexCount: number,
  clipNames: string[],
  fps: number,
): { texture: DataTexture; clips: Record<string, VatClip> } {
  const clips: Record<string, VatClip> = {};
  let rows = 0;
  const sources = clipNames.map((name) => {
    const clip = AnimationClip.findByName(gltf.animations, name);
    if (!clip) throw new Error(`bakeVat: clip "${name}" not found in the model`);
    clips[name] = { startRow: rows, rows: Math.max(1, Math.round(clip.duration * fps)) };
    rows += clips[name].rows;
    return clip;
  });
  const data = new Float32Array(vertexCount * rows * 4);
  const mixer = new AnimationMixer(gltf.scene);
  const vector = new Vector3();
  sources.forEach((clip, c) => {
    const action = mixer.clipAction(clip).play();
    const { startRow, rows: frames } = clips[clipNames[c]];
    for (let frame = 0; frame < frames; frame++) {
      mixer.setTime(frame / fps);
      gltf.scene.updateMatrixWorld(true);
      let texel = (startRow + frame) * vertexCount * 4;
      for (const mesh of meshes) {
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, vector).applyMatrix4(mesh.matrixWorld);
          data[texel++] = vector.x;
          data[texel++] = vector.y;
          data[texel++] = vector.z;
          data[texel++] = 1;
        }
      }
    }
    // stopping the only action restores the default pose before the next clip
    action.stop();
  });
  gltf.scene.updateMatrixWorld(true);
  const texture = new DataTexture(data, vertexCount, rows, RGBAFormat, FloatType);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
  return { texture, clips };
}
