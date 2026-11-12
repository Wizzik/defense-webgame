import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { MODELS } from "../tools/assets-build/manifest";
import { readGlbInfo } from "../tools/assets-build/glb-info";

const ASSETS = "assets";
const ids = (file: string): string[] =>
  (JSON.parse(readFileSync(`data/generated/${file}.json`, "utf8")) as { id: string }[]).map((x) => x.id);

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

const sorted = (xs: string[]): string[] => [...xs].sort();

describe("license table", () => {
  const rows = readFileSync(join(ASSETS, "LICENSES.md"), "utf8")
    .split("\n")
    .filter((l) => l.startsWith("| ") && l.includes("(`"));
  const rowPath = (row: string): string => /\(`([^`]+)`\)/.exec(row)![1]!;
  const files = listFiles(ASSETS)
    .map((f) => relative(ASSETS, f))
    .filter((f) => f !== "LICENSES.md");

  it("has exactly one row per asset file, with a matching sha256", () => {
    for (const file of files) {
      const matching = rows.filter((r) => rowPath(r) === file);
      expect(matching, file).toHaveLength(1);
      const sha = /`([0-9a-f]{64})`/.exec(matching[0]!)![1];
      expect(createHash("sha256").update(readFileSync(join(ASSETS, file))).digest("hex"), file).toBe(sha);
    }
  });

  it("has no row for a missing file", () => {
    for (const row of rows) expect(files, rowPath(row)).toContain(rowPath(row));
  });
});

describe("hero models", () => {
  for (const id of ids("heroes")) {
    it(id, () => {
      const info = readGlbInfo(`${ASSETS}/models/heroes/${id}.glb`);
      expect(sorted(info.clips)).toEqual(["Death", "Idle", "Punch", "Running"]);
      expect(info.triangles).toBeLessThanOrEqual(5000);
      expect(info.bytes).toBeLessThanOrEqual(700_000);
      expect(info.hasTexture).toBe(true);
      const spec = MODELS.find((m) => m.out === `heroes/${id}.glb`)!;
      const allowed = new Set([...spec.keepNodes!, ...(spec.attach ?? []).map((a) => basename(a.file, ".gltf"))]);
      for (const node of info.meshNodes) expect(allowed.has(node), `${id}: unexpected mesh node ${node}`).toBe(true);
    });
  }

  it("stonehorn carries no shield", () => {
    expect(readGlbInfo(`${ASSETS}/models/heroes/stonehorn.glb`).meshNodes).not.toContain("Round_Shield");
  });
});

describe("enemy models", () => {
  for (const id of ids("enemies")) {
    it(id, () => {
      const info = readGlbInfo(`${ASSETS}/models/enemies/${id}.glb`);
      expect(sorted(info.clips)).toEqual(["Idle", "Punch", "Walking"]);
      expect(info.triangles).toBeLessThanOrEqual(3000);
      expect(info.bytes).toBeLessThanOrEqual(700_000);
      expect(info.hasTexture).toBe(true);
    });
  }
});

describe("environment models", () => {
  const names = ["castle", "tower", "flag", "tree-a", "tree-b", "trees-a", "trees-b", "trees-c", "rock-a", "rock-b", "rock-c"];
  for (const name of names) {
    it(name, () => {
      const info = readGlbInfo(`${ASSETS}/models/env/${name}.glb`);
      expect(info.hasTexture).toBe(true);
      if (name === "castle") expect(info.triangles).toBeLessThanOrEqual(6000);
    });
  }

  it("has exactly the listed files", () => {
    expect(sorted(readdirSync(`${ASSETS}/models/env`))).toEqual(sorted(names.map((n) => `${n}.glb`)));
  });
});

describe("model budget", () => {
  it("keeps all models together within 6 MB", () => {
    const total = listFiles(`${ASSETS}/models`)
      .filter((f) => f.endsWith(".glb"))
      .reduce((sum, f) => sum + statSync(f).size, 0);
    expect(total).toBeLessThanOrEqual(6_000_000);
  });
});
