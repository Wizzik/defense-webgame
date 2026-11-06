import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { validateGameData } from "./schema";

const FILES = ["heroes.json", "abilities.json", "constants.json"] as const;
/** Keys that carry map texts (tooltips, descriptions) or design-only lookups (mapName). */
const FORBIDDEN_KEYS = new Set(["tooltip", "ubertip", "tip", "description", "mapName", "source", "review", "jassFunctions"]);

function read(file: (typeof FILES)[number]): string {
  return readFileSync(join(import.meta.dirname, "generated", file), "utf8");
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
        constants: JSON.parse(read("constants.json")),
      }),
    ).not.toThrow();
  });

  it("carries no map identifiers", () => {
    const forbidden = new Set<string>();
    for (const file of ["heroes.yaml", "abilities.yaml"]) {
      const entries = parse(readFileSync(join(import.meta.dirname, "..", "design", file), "utf8")) as Record<string, unknown>[];
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

  it("carries no map texts", () => {
    for (const file of FILES) {
      const text = read(file);
      expect(text, file).not.toContain("TRIGSTR");
      expect(forbiddenKeyPaths(JSON.parse(text), file)).toEqual([]);
    }
  });
});
