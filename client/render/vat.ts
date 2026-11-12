import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { floor, int, ivec2, max, mod, referenceAttribute, textureLoad, vec4, vertexIndex } from "three/tsl";
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
  type Node,
  RGBAFormat,
  type SkinnedMesh,
  type Texture,
  type UniformNode,
  Vector3,
} from "three/webgpu";

/** Widest texture WebGL2 guarantees; a mesh with more vertices wraps into more rows. */
export const VAT_MAX_WIDTH = 2048;

/** Texture tiling of one baked frame: vertex `v` sits at column `v % width`, row `floor(v / width)`. */
export interface VatLayout {
  width: number;
  rowsPerFrame: number;
}

export function vatLayout(vertexCount: number, maxWidth: number = VAT_MAX_WIDTH): VatLayout {
  const width = Math.min(vertexCount, maxWidth);
  return { width, rowsPerFrame: Math.ceil(vertexCount / width) };
}

/** Texel `[column, row]` of a vertex in a frame. */
export function vatTexel(layout: VatLayout, vertex: number, frame: number): [number, number] {
  return [vertex % layout.width, frame * layout.rowsPerFrame + Math.floor(vertex / layout.width)];
}

/** Frames of one baked clip; frame `f` of the clip is frame `startFrame + f` of the texture. */
export interface VatClip {
  startFrame: number;
  frames: number;
}

export interface BakedVat {
  /** All meshes of the model merged in the default pose (positions, normals, uv, material colour as vertex colour). */
  geometry: BufferGeometry;
  /** RGBA float texture tiled by `layout`; rgb = model-space position. */
  texture: DataTexture;
  clips: Record<string, VatClip>;
  layout: VatLayout;
  /** Colour texture of the first material that has one, or null. */
  map: Texture | null;
}

// the texture height (rowsPerFrame * total frames) has to stay within this
const MAX_TEXTURE_HEIGHT = 8192;

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
  const layout = vatLayout(vertexCount);
  const geometry = mergeDefaultPose(meshes, vertexCount);
  const { texture, clips } = bakeClips(gltf, meshes, layout, clipNames, fps);
  const map = meshes.map((mesh) => (mesh.material as MeshStandardMaterial).map).find((texture) => texture) ?? null;
  return { geometry, texture, clips, layout, map };
}

function mergeDefaultPose(meshes: Mesh[], vertexCount: number): BufferGeometry {
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];
  const vector = new Vector3();
  const tip = new Vector3();
  const origin = new Vector3();
  const normalMatrix = new Matrix3();
  let offset = 0;
  for (const mesh of meshes) {
    const { position, normal, uv } = mesh.geometry.attributes;
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
      if (uv) {
        uvs[vertex * 2] = uv.getX(i);
        uvs[vertex * 2 + 1] = uv.getY(i);
      }
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
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function bakeClips(
  gltf: GLTF,
  meshes: Mesh[],
  layout: VatLayout,
  clipNames: string[],
  fps: number,
): { texture: DataTexture; clips: Record<string, VatClip> } {
  const clips: Record<string, VatClip> = {};
  let totalFrames = 0;
  const sources = clipNames.map((name) => {
    const clip = AnimationClip.findByName(gltf.animations, name);
    if (!clip) throw new Error(`bakeVat: clip "${name}" not found in the model`);
    clips[name] = { startFrame: totalFrames, frames: Math.max(1, Math.round(clip.duration * fps)) };
    totalFrames += clips[name].frames;
    return clip;
  });
  const height = totalFrames * layout.rowsPerFrame;
  if (height > MAX_TEXTURE_HEIGHT) {
    throw new Error(`bakeVat: ${height} texture rows exceed ${MAX_TEXTURE_HEIGHT}`);
  }
  const data = new Float32Array(layout.width * height * 4);
  const frameTexels = layout.width * layout.rowsPerFrame;
  const mixer = new AnimationMixer(gltf.scene);
  const vector = new Vector3();
  sources.forEach((clip, c) => {
    const action = mixer.clipAction(clip).play();
    const { startFrame, frames } = clips[clipNames[c]];
    for (let frame = 0; frame < frames; frame++) {
      mixer.setTime(frame / fps);
      gltf.scene.updateMatrixWorld(true);
      // vertex v of the merged geometry is texel v of the frame, so a running index tiles it
      let texel = (startFrame + frame) * frameTexels * 4;
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
  const texture = new DataTexture(data, layout.width, height, RGBAFormat, FloatType);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
  return { texture, clips };
}

/**
 * Shader position for the crowd. `anim` = (clip startFrame, clip frames, start time s, last hit
 * time s); the frame is `floor((time - start) * fps)` looped over the clip. The texel follows
 * `vatTexel` with the `vertexIndex` builtin. The instance matrix is applied here: positionNode
 * runs after three.js has applied it to the geometry position, so it has to apply the matrix to
 * the baked position itself; normals keep the default pose and get the instance rotation from
 * three.js.
 */
export function vatPositionNode(
  vat: BakedVat,
  anim: Node<"vec4">,
  time: UniformNode<"float">,
  fps: number,
): Node<"vec3"> {
  const { width, rowsPerFrame } = vat.layout;
  const age = max(time.sub(anim.z), 0);
  const frame = int(anim.x.add(mod(floor(age.mul(fps)), anim.y)));
  const vertex = int(vertexIndex);
  const column = vertex.mod(int(width));
  const row = frame.mul(int(rowsPerFrame)).add(vertex.div(int(width)));
  const local = textureLoad(vat.texture, ivec2(column, row)).xyz;
  // every node has the chaining methods at runtime; the referenceAttribute typings lack them
  const instanceMatrix = referenceAttribute("instanceMatrix", "mat4") as unknown as Node<"mat4">;
  return instanceMatrix.mul(vec4(local, 1)).xyz;
}
