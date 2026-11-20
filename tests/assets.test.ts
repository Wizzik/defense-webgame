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
  const enemies = JSON.parse(readFileSync("data/generated/enemies.json", "utf8")) as { id: string; model?: string }[];
  // the same rule as enemyModelId in client/render/models.ts (client code is outside this TypeScript project)
  for (const id of new Set(enemies.map((e) => e.model ?? e.id))) {
    it(id, () => {
      const info = readGlbInfo(`${ASSETS}/models/enemies/${id}.glb`);
      expect(sorted(info.clips)).toEqual(["Idle", "Punch", "Walking"]);
      expect(info.triangles).toBeLessThanOrEqual(3000);
      expect(info.bytes).toBeLessThanOrEqual(700_000);
      expect(info.hasTexture).toBe(true);
    });
  }
});

describe("faction models", () => {
  const enemies = JSON.parse(readFileSync("data/generated/enemies.json", "utf8")) as { id: string; model?: string; boss?: true }[];

  it("every common enemy type has a model of its own", () => {
    expect(enemies.filter((e) => !e.boss && e.model !== undefined).map((e) => e.id)).toEqual([]);
  });

  it("the human types wear adventurer bodies, the undead skeletons", () => {
    const body = (id: string) => MODELS.find((m) => m.out === `enemies/${id}.glb`)!.source;
    for (const id of ["shieldbearer", "scout", "musketeer", "chaplain", "lancer", "captain"]) expect(body(id), id).toMatch(/^adv:/);
    for (const id of ["ghoul", "webcrawler", "rotgut", "gravebinder", "risen", "bone-tyrant"]) expect(body(id), id).toMatch(/^skel:/);
  });

  it("no enemy wears exactly the parts of a hero", () => {
    const parts = (out: string) => {
      const m = MODELS.find((x) => x.out === out)!;
      return [m.source, ...(m.keepNodes ?? []), ...(m.attach ?? []).map((a) => a.file)].sort().join("|");
    };
    const heroes = new Set(ids("heroes").map((id) => parts(`heroes/${id}.glb`)));
    for (const e of enemies.filter((x) => x.model === undefined)) expect(heroes.has(parts(`enemies/${e.id}.glb`)), e.id).toBe(false);
  });
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
  it("keeps all models together within 10 MB", () => {
    const total = listFiles(`${ASSETS}/models`)
      .filter((f) => f.endsWith(".glb"))
      .reduce((sum, f) => sum + statSync(f).size, 0);
    expect(total).toBeLessThanOrEqual(10_000_000);
  });
});

describe("audio", () => {
  const dir = join(ASSETS, "audio");
  const files = (sub: string): string[] => {
    try {
      return listFiles(join(dir, sub));
    } catch {
      return [];
    }
  };
  const size = (list: string[]): number => list.reduce((n, f) => n + statSync(f).size, 0);

  it("audio budgets", () => {
    const sfx = files("sfx");
    const music = files("music");
    expect(size(sfx)).toBeLessThanOrEqual(3 * 1024 * 1024);
    expect(size(music)).toBeLessThanOrEqual(15 * 1024 * 1024);
    for (const f of [...sfx, ...music]) expect(f.endsWith(".ogg"), f).toBe(true);
  });

  it("every audio file is used by audio.json and every used file exists", () => {
    const audio = JSON.parse(readFileSync("data/generated/audio.json", "utf8")) as {
      cues: { files: string[] }[];
      tracks: { file: string }[];
    };
    const used = new Set([...audio.cues.flatMap((c) => c.files), ...audio.tracks.map((t) => t.file)]);
    const present = [...files("sfx"), ...files("music")].map((f) => relative(ASSETS, f));
    expect(sorted(present)).toEqual(sorted([...used]));
  });
});
