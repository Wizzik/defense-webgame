import { readFileSync } from "node:fs";

export interface GlbInfo {
  triangles: number;
  clips: string[];
  meshNodes: string[];
  bytes: number;
  hasTexture: boolean;
}

interface Accessor {
  count: number;
}
interface Primitive {
  indices?: number;
  attributes: { POSITION?: number };
  mode?: number;
}
interface GltfJson {
  nodes?: { name?: string; mesh?: number }[];
  meshes?: { primitives: Primitive[] }[];
  accessors?: Accessor[];
  animations?: { name?: string }[];
  textures?: unknown[];
}

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"

/** Reads the JSON chunk of a GLB (no three). Triangles count every mesh once per node that uses it. */
export function readGlbInfo(path: string): GlbInfo {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== MAGIC) throw new Error(`${path}: not a GLB`);
  const jsonLength = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== JSON_CHUNK) throw new Error(`${path}: first chunk is not JSON`);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + jsonLength)) as GltfJson;

  const accessors = json.accessors ?? [];
  const meshTriangles = (json.meshes ?? []).map((mesh) =>
    mesh.primitives.reduce((sum, p) => {
      if (p.mode !== undefined && p.mode !== 4) return sum;
      const count = p.indices !== undefined ? accessors[p.indices]!.count : accessors[p.attributes.POSITION!]!.count;
      return sum + count / 3;
    }, 0),
  );

  const nodes = json.nodes ?? [];
  const withMesh = nodes.filter((n) => n.mesh !== undefined);
  return {
    triangles: withMesh.reduce((sum, n) => sum + meshTriangles[n.mesh!]!, 0),
    clips: (json.animations ?? []).map((a, i) => a.name ?? `animation_${i}`),
    meshNodes: withMesh.map((n) => n.name ?? ""),
    bytes: buf.length,
    hasTexture: (json.textures ?? []).length > 0,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const path of process.argv.slice(2)) console.log(path, JSON.stringify(readGlbInfo(path), null, 1));
}
