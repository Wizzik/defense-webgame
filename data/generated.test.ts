import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateGameData } from "./schema";

const FILES = ["heroes.json", "abilities.json", "constants.json"] as const;
/** Keys that carry map texts (tooltips, descriptions) or design-only lookups (mapName). */
const FORBIDDEN_KEYS = new Set(["tooltip", "ubertip", "tip", "description", "mapName"]);

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

  it("carries no map texts", () => {
    for (const file of FILES) {
      const text = read(file);
      expect(text, file).not.toContain("TRIGSTR");
      expect(forbiddenKeyPaths(JSON.parse(text), file)).toEqual([]);
    }
  });
});
