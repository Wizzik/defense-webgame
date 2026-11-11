/** Cuts the game models out of the pinned KayKit sources and rewrites the model rows of `assets/LICENSES.md`. */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Animation, type Document, Logger, type Node, NodeIO } from "@gltf-transform/core";
import { dedup, mergeDocuments, prune, resample, simplify, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import { SOURCE_DIR } from "./fetch";
import { MODELS, type ModelSpec, SOURCES, splitRef } from "./manifest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MODELS_DIR = join(ROOT, "assets", "models");
const LICENSES = join(ROOT, "assets", "LICENSES.md");
const MAX_SIMPLIFY_PASSES = 4;
const BASE_ERROR = 0.02;
const GENERATED_DIRS = ["models/heroes/", "models/enemies/", "models/env/"];

const io = new NodeIO();
io.setLogger(new Logger(Logger.Verbosity.WARN));

function sourcePath(ref: string): string {
  const { key, path } = splitRef(ref);
  const file = join(SOURCE_DIR, key, path);
  if (!existsSync(file)) throw new Error(`missing ${file}; run npm run assets:fetch`);
  return file;
}

function meshNodes(doc: Document): Node[] {
  return doc
    .getRoot()
    .listNodes()
    .filter((n) => n.getMesh());
}

export function countTriangles(doc: Document): number {
  let total = 0;
  for (const node of meshNodes(doc)) {
    for (const prim of node.getMesh()!.listPrimitives()) {
      const indices = prim.getIndices();
      total += (indices ? indices.getCount() : prim.getAttribute("POSITION")!.getCount()) / 3;
    }
  }
  return total;
}

function findNode(doc: Document, name: string, model: string): Node {
  const node = doc
    .getRoot()
    .listNodes()
    .find((n) => n.getName() === name);
  if (!node) throw new Error(`${model}: node ${name} not found`);
  return node;
}

function removeNodes(doc: Document, spec: ModelSpec): void {
  for (const name of spec.removeNodes ?? []) findNode(doc, name, spec.out).dispose();
  if (!spec.keepNodes) return;
  const keep = new Set(spec.keepNodes);
  for (const name of keep) findNode(doc, name, spec.out);
  for (const node of meshNodes(doc)) if (!keep.has(node.getName())) node.dispose();
}

async function attachAll(doc: Document, spec: ModelSpec): Promise<void> {
  for (const { file, slot } of spec.attach ?? []) {
    const part = await io.read(sourcePath(file));
    const scene = part.getRoot().listScenes()[0]!;
    const roots = scene.listChildren();
    const map = mergeDocuments(doc, part);
    const target = findNode(doc, slot, spec.out);
    for (const root of roots) target.addChild(map.get(root) as Node);
    for (const s of doc.getRoot().listScenes()) if (s.listChildren().length === 0) s.dispose();
  }
  singleBuffer(doc);
}

/** A GLB holds one buffer; merging documents brings one per source file. */
function singleBuffer(doc: Document): void {
  const [first, ...rest] = doc.getRoot().listBuffers();
  for (const accessor of doc.getRoot().listAccessors()) accessor.setBuffer(first!);
  for (const buffer of rest) buffer.dispose();
}

/** `Animation.dispose` leaves its channels and samplers (and their accessors) behind. */
function disposeAnimation(anim: Animation): void {
  for (const channel of anim.listChannels()) channel.dispose();
  for (const sampler of anim.listSamplers()) sampler.dispose();
  anim.dispose();
}

function keepClips(doc: Document, spec: ModelSpec): void {
  const bySource = new Map<string, string>();
  for (const [name, source] of Object.entries(spec.clips)) bySource.set(source, name);
  for (const anim of doc.getRoot().listAnimations()) {
    const name = bySource.get(anim.getName());
    if (name === undefined) disposeAnimation(anim);
    else anim.setName(name);
  }
  const have = doc
    .getRoot()
    .listAnimations()
    .map((a) => a.getName());
  for (const name of Object.keys(spec.clips)) {
    if (!have.includes(name)) throw new Error(`${spec.out}: clip ${spec.clips[name]} not found in source`);
  }
}

/** Drops tracks of nodes that are no joint and no hand slot (IK and control helpers): they only cost bytes. */
function dropHelperTracks(doc: Document): void {
  const needed = new Set<Node>();
  for (const skin of doc.getRoot().listSkins()) for (const joint of skin.listJoints()) needed.add(joint);
  for (const node of doc.getRoot().listNodes()) if (node.getName().startsWith("handslot.")) needed.add(node);
  for (const anim of doc.getRoot().listAnimations()) {
    for (const channel of anim.listChannels()) {
      const target = channel.getTargetNode();
      if (!target || !needed.has(target)) channel.dispose();
    }
  }
}

const STATIC_EPSILON = 1e-4;

/** Drops tracks that hold the node's rest value for the whole clip: playing them changes nothing. */
function dropStaticTracks(doc: Document): void {
  for (const anim of doc.getRoot().listAnimations()) {
    for (const channel of anim.listChannels()) {
      const target = channel.getTargetNode();
      const output = channel.getSampler()?.getOutput();
      if (!target || !output) continue;
      const rest =
        channel.getTargetPath() === "translation"
          ? target.getTranslation()
          : channel.getTargetPath() === "rotation"
            ? target.getRotation()
            : channel.getTargetPath() === "scale"
              ? target.getScale()
              : null;
      if (!rest) continue;
      const size = output.getElementSize();
      const values = output.getArray()!;
      let isRest = true;
      for (let i = 0; i < values.length && isRest; i++) {
        isRest = Math.abs(values[i]! - rest[i % size]!) <= STATIC_EPSILON;
      }
      if (isRest) channel.dispose();
    }
    for (const sampler of anim.listSamplers()) {
      if (!anim.listChannels().some((c) => c.getSampler() === sampler)) sampler.dispose();
    }
  }
}

async function limitTriangles(doc: Document, spec: ModelSpec): Promise<void> {
  const max = spec.maxTriangles;
  if (max === undefined) return;
  await MeshoptSimplifier.ready;
  let error = BASE_ERROR;
  for (let pass = 0; pass < MAX_SIMPLIFY_PASSES && countTriangles(doc) > max; pass++) {
    await doc.transform(
      simplify({ simplifier: MeshoptSimplifier, ratio: max / countTriangles(doc), error }),
    );
    error *= 2;
  }
  const triangles = countTriangles(doc);
  if (triangles > max) throw new Error(`${spec.out}: ${triangles} triangles, limit ${max}`);
}

async function buildModel(spec: ModelSpec): Promise<{ triangles: number }> {
  const doc = await io.read(sourcePath(spec.source));
  removeNodes(doc, spec);
  await attachAll(doc, spec);
  keepClips(doc, spec);
  dropHelperTracks(doc);
  await doc.transform(dedup(), prune({ keepLeaves: true }), weld());
  await limitTriangles(doc, spec);
  if (Object.keys(spec.clips).length > 0) await doc.transform(resample());
    dropStaticTracks(doc);
    await doc.transform(dedup());
  await doc.transform(prune({ keepLeaves: true }));
  const out = join(MODELS_DIR, spec.out);
  await mkdir(dirname(out), { recursive: true });
  await io.write(out, doc);
  return { triangles: countTriangles(doc) };
}

function sourceUrl(ref: string): string {
  const { key, path } = splitRef(ref);
  const s = SOURCES[key];
  return `https://raw.githubusercontent.com/KayKit-Game-Assets/${s.repo}/${s.commit}/${s.root}/${path}`;
}

async function licenseRow(spec: ModelSpec): Promise<string> {
  const sha = createHash("sha256")
    .update(await readFile(join(MODELS_DIR, spec.out)))
    .digest("hex");
  const urls = [spec.source, ...(spec.attach ?? []).map((a) => a.file)].map(sourceUrl).join(" + ");
  const author = "Kay Lousberg (KayKit); modified: parts removed or merged, clips renamed, simplified";
  const date = new Date().toISOString().slice(0, 10);
  return `| ${spec.out.replace(/\.glb$/, "")} (\`models/${spec.out}\`) | ${author} | CC0 1.0 | ${urls} | ${date} | \`${sha}\` |`;
}

async function writeLicenses(rows: string[]): Promise<void> {
  const lines = (await readFile(LICENSES, "utf8")).split("\n");
  const kept = lines.filter((l) => !GENERATED_DIRS.some((d) => l.includes(`\`${d}`)));
  while (kept.length > 0 && kept[kept.length - 1] === "") kept.pop();
  await writeFile(LICENSES, `${[...kept, ...rows].join("\n")}\n`);
}

async function main(): Promise<void> {
  const rows: string[] = [];
  for (const spec of MODELS) {
    const { triangles } = await buildModel(spec);
    console.log(`${spec.out}: ${triangles} triangles`);
    rows.push(await licenseRow(spec));
  }
  await writeLicenses(rows);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
