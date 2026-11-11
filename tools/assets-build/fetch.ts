/** Downloads the pinned source files the manifest needs into `assets-source/` (untracked, untrusted data). */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { MODELS, SOURCES, splitRef } from "./manifest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SOURCE_DIR = join(ROOT, "assets-source");

function url(ref: string): string {
  const { key, path } = splitRef(ref);
  const s = SOURCES[key];
  return `https://raw.githubusercontent.com/KayKit-Game-Assets/${s.repo}/${s.commit}/${s.root}/${path}`;
}

/** Where `path` of source `key` is written; throws when it would land outside `assets-source/<key>/` (a `../` in a downloaded file). */
export function targetPath(key: string, path: string): string {
  const base = resolve(SOURCE_DIR, key);
  const target = resolve(base, path);
  const rel = relative(base, target);
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new Error(`${key}:${path} escapes ${base}`);
  }
  return target;
}

async function download(key: string, path: string, ref: string): Promise<boolean> {
  const target = targetPath(key, path);
  if (existsSync(target)) return false;
  const res = await fetch(url(ref));
  if (!res.ok) throw new Error(`${res.status} for ${url(ref)}`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await res.arrayBuffer()));
  return true;
}

async function main(): Promise<void> {
  const refs = new Set<string>();
  for (const m of MODELS) {
    refs.add(m.source);
    for (const a of m.attach ?? []) refs.add(a.file);
  }
  let fetched = 0;
  for (const ref of refs) {
    const { key, path } = splitRef(ref);
    if (await download(key, path, ref)) fetched++;
    if (!path.endsWith(".gltf")) continue;
    // A .gltf points at its .bin and texture; they sit next to it.
    const json = JSON.parse(await readFile(join(SOURCE_DIR, key, path), "utf8")) as {
      buffers?: { uri?: string }[];
      images?: { uri?: string }[];
    };
    const uris = [...(json.buffers ?? []), ...(json.images ?? [])].map((x) => x.uri);
    for (const uri of uris) {
      if (!uri || uri.startsWith("data:")) continue;
      const rel = posix.join(posix.dirname(path), decodeURIComponent(uri));
      if (await download(key, rel, `${key}:${rel}`)) fetched++;
    }
  }
  console.log(`assets:fetch: ${fetched} downloaded, ${refs.size} model files referenced`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
