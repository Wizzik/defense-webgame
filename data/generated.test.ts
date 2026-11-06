import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { validateGameData } from "./schema";

const FILES = ["heroes.json", "abilities.json", "enemies.json", "rules.json", "constants.json"] as const;
/** Keys that carry map texts (tooltips, descriptions) or design-only lookups (mapName). */
const FORBIDDEN_KEYS = new Set(["tooltip", "ubertip", "tip", "description", "mapName", "source", "review", "jassFunctions"]);

function read(file: (typeof FILES)[number]): string {
  return readFileSync(join(import.meta.dirname, "generated", file), "utf8");
}

/** The entry lists of every design/*.yaml that is a list (rules.yaml is a mapping and has none). */
function designLists(): Record<string, unknown>[][] {
  const dir = join(import.meta.dirname, "..", "design");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => parse(readFileSync(join(dir, f), "utf8")) as unknown)
    .filter((v): v is Record<string, unknown>[] => Array.isArray(v));
}

function designEntries(file: string): { id: string; name: unknown }[] {
  return parse(readFileSync(join(import.meta.dirname, "..", "design", file), "utf8")) as { id: string; name: unknown }[];
}

function forbiddenKeyPaths(value: unknown, path: string): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => forbiddenKeyPaths(v, `${path}.${i}`));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, v]) => [
    ...(FORBIDDEN_KEYS.has(key) ? [`${path}.${key}`] : []),
    ...forbiddenKeyPaths(v, `${path}.${key}`),
  ]);
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("generated game data", () => {
  it("passes validateGameData", () => {
    expect(() =>
      validateGameData({
        heroes: JSON.parse(read("heroes.json")),
        abilities: JSON.parse(read("abilities.json")),
        enemies: JSON.parse(read("enemies.json")),
        rules: JSON.parse(read("rules.json")),
        constants: JSON.parse(read("constants.json")),
      }),
    ).not.toThrow();
  });

  it("carries no map identifiers", () => {
    const forbidden = new Set<string>();
    for (const entries of designLists()) {
      for (const e of entries) {
        for (const key of ["source", "mapName"]) if (typeof e[key] === "string") forbidden.add(e[key]);
      }
    }
    expect(forbidden.size).toBeGreaterThan(0);
    for (const file of FILES) {
      for (const text of strings(JSON.parse(read(file)))) {
        expect(text, file).not.toMatch(/\b(Init)?Trig_|war3map/);
        expect(forbidden.has(text), `${file}: ${text}`).toBe(false);
      }
    }
  });

  it("matches design ids and names", () => {
    // data-build cannot run in CI, so this catches a design change that was not regenerated.
    const pairs = [
      ["heroes.json", "heroes.yaml"],
      ["abilities.json", "abilities.yaml"],
      ["enemies.json", "enemies.yaml"],
    ] as const;
    for (const [json, yaml] of pairs) {
      const generated = (JSON.parse(read(json)) as { id: string; name: unknown }[]).map(({ id, name }) => ({ id, name }));
      const design = designEntries(yaml).map(({ id, name }) => ({ id, name }));
      expect(generated, `${json} differs from design/${yaml}: run npm run data:build`).toEqual(design);
    }
  });

  it("matches design rules and enemy xp", () => {
    const rules = parse(readFileSync(join(import.meta.dirname, "..", "design", "rules.yaml"), "utf8"));
    expect(JSON.parse(read("rules.json")), "rules.json differs from design/rules.yaml: run npm run data:build").toEqual(rules);
    const xp = (list: { id: string; xp?: number }[]) => list.map(({ id, xp }) => ({ id, xp }));
    expect(xp(JSON.parse(read("enemies.json")))).toEqual(xp(designEntries("enemies.yaml") as { id: string; xp?: number }[]));
  });

  it("carries no map texts", () => {
    for (const file of FILES) {
      const text = read(file);
      expect(text, file).not.toContain("TRIGSTR");
      expect(forbiddenKeyPaths(JSON.parse(text), file)).toEqual([]);
    }
  });
});
