import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { validateGameData } from "./schema";

const FILES = ["heroes.json", "abilities.json", "enemies.json", "rules.json", "constants.json"] as const;
/** Keys that carry map texts (tooltips) or design-only lookups (mapName). */
const FORBIDDEN_KEYS = new Set(["tooltip", "ubertip", "tip", "mapName", "source", "review", "jassFunctions"]);

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

type Entry = { id: string; name: unknown; description?: unknown; role?: unknown };

function designEntries(file: string): Entry[] {
  return parse(readFileSync(join(import.meta.dirname, "..", "design", file), "utf8")) as Entry[];
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
      const pick = ({ id, name, description, role }: Entry) => ({ id, name, description, role });
      const generated = (JSON.parse(read(json)) as Entry[]).map(pick);
      const design = designEntries(yaml).map(pick);
      expect(generated, `${json} differs from design/${yaml}: run npm run data:build`).toEqual(design);
    }
  });

  it("matches design rules and enemy xp", () => {
    const rules = parse(readFileSync(join(import.meta.dirname, "..", "design", "rules.yaml"), "utf8"));
    expect(JSON.parse(read("rules.json")), "rules.json differs from design/rules.yaml: run npm run data:build").toEqual(rules);
    const xp = (list: { id: string; xp?: number }[]) => list.map(({ id, xp }) => ({ id, xp }));
    expect(xp(JSON.parse(read("enemies.json")))).toEqual(xp(designEntries("enemies.yaml") as { id: string; xp?: number }[]));
  });

  it("enemies have six common types and four bosses with their attack kinds", () => {
    const enemies = JSON.parse(read("enemies.json")) as { id: string; attack: { kind: string }; heal?: unknown; boss?: true }[];
    expect(enemies.map((e) => e.id)).toEqual([
      "shieldbearer", "scout", "musketeer", "chaplain", "lancer", "captain",
      "iron-marshal", "pale-abbot", "gunmaster", "dread-regent",
    ]);
    expect(enemies.filter((e) => e.boss).map((e) => e.id)).toEqual(["iron-marshal", "pale-abbot", "gunmaster", "dread-regent"]);
    const ranged = enemies.filter((e) => e.attack.kind === "ranged").map((e) => e.id);
    expect(ranged).toEqual(["musketeer", "chaplain", "pale-abbot", "gunmaster"]);
    expect(enemies.filter((e) => e.attack.kind !== "ranged").every((e) => e.attack.kind === "melee")).toBe(true);
    expect(enemies.filter((e) => e.heal !== undefined).map((e) => e.id)).toEqual(["chaplain", "pale-abbot"]);
  });

  it("there are 20 phases and the final boss comes at 1000 s", () => {
    const rules = JSON.parse(read("rules.json")) as { phases: unknown[]; run: { durationSeconds: number; phaseSeconds: number; finale: { boss: string } }; events: { atSeconds: number }[] };
    expect(rules.phases).toHaveLength(20);
    expect(rules.run.durationSeconds).toBe(1000);
    expect(rules.run.phaseSeconds).toBe(50);
    expect(rules.run.finale.boss).toBe("dread-regent");
    expect(rules.events.map((e) => e.atSeconds)).toEqual([180, 250, 360, 500, 540, 720, 750, 900]);
  });

  it("boss hp matches the design targets", () => {
    const enemies = JSON.parse(read("enemies.json")) as { id: string; hp: number; boss?: true }[];
    const targets: Record<string, number> = { "iron-marshal": 12000, "pale-abbot": 20000, gunmaster: 30000, "dread-regent": 257000 };
    for (const boss of enemies.filter((e) => e.boss)) {
      const target = targets[boss.id]!;
      expect(Math.abs(boss.hp - target) / target, boss.id).toBeLessThanOrEqual(0.01);
    }
  });

  it("bosses have collision 80, 80, 80, 96", () => {
    const enemies = JSON.parse(read("enemies.json")) as { collision: number; boss?: true }[];
    expect(enemies.filter((e) => e.boss).map((e) => e.collision)).toEqual([80, 80, 80, 96]);
  });

  it("there are eight heroes, each with three signature abilities and an ultimate that exist", () => {
    const heroes = JSON.parse(read("heroes.json")) as { id: string; signatureAbilities: string[]; ultimate: string }[];
    const abilities = new Set((JSON.parse(read("abilities.json")) as { id: string }[]).map((a) => a.id));
    expect(heroes.map((h) => h.id)).toEqual([
      "stonehorn", "nightglaive", "gravecaller", "serpent-shaman", "mistwarden", "sparkshot", "redcleaver", "tidecaller",
    ]);
    for (const hero of heroes) {
      expect(hero.signatureAbilities, hero.id).toHaveLength(3);
      for (const id of [...hero.signatureAbilities, hero.ultimate]) expect(abilities.has(id), `${hero.id}: ${id}`).toBe(true);
    }
  });

  it("the new on_hit abilities carry a bonus, and the chance is a share of 1", () => {
    const abilities = JSON.parse(read("abilities.json")) as { id: string; params: Record<string, number[]> }[];
    const of = (id: string) => abilities.find((a) => a.id === id)!.params;
    expect(of("stunning-tide").chance).toEqual([0.175, 0.175, 0.175, 0.175, 0.175]);
    expect(of("stunning-tide").bonusDamage!.every((v) => v > 0)).toBe(true);
    expect(of("searing-rounds").bonusDamage!.every((v) => v > 0)).toBe(true);
    expect(of("grave-grasp").healPerHit).toEqual([2.5, 5, 7.5, 10, 15]);
  });

  it("every enemy type has its behavior", () => {
    const enemies = JSON.parse(read("enemies.json")) as { id: string; behavior: string }[];
    expect(Object.fromEntries(enemies.map((e) => [e.id, e.behavior]))).toEqual({
      shieldbearer: "siege", scout: "flank", musketeer: "skirmish", chaplain: "support", lancer: "charge", captain: "siege",
      "iron-marshal": "charge", "pale-abbot": "siege", gunmaster: "skirmish", "dread-regent": "charge",
    });
  });

  it("the lancer charges and the captain has an aura", () => {
    const enemies = JSON.parse(read("enemies.json")) as { id: string; charge?: unknown; aura?: unknown }[];
    expect(enemies.filter((e) => e.charge !== undefined).map((e) => e.id)).toEqual(["lancer", "iron-marshal", "dread-regent"]);
    expect(enemies.filter((e) => e.aura !== undefined).map((e) => e.id)).toEqual(["captain", "dread-regent"]);
  });

  it("carries the phase 2a mechanics", () => {
    const abilities = JSON.parse(read("abilities.json")) as { id: string; kind: string; params: Record<string, number[]> }[];
    const heroes = JSON.parse(read("heroes.json")) as { id: string; signatureAbilities: string[] }[];
    const ability = (id: string) => abilities.find((a) => a.id === id)!;
    expect(ability("enhanced-totem").params.empower).toEqual([3, 5, 7, 9, 10]);
    expect(ability("seismic-echo").kind).toBe("on_cast");
    expect(heroes.find((h) => h.id === "nightglaive")!.signatureAbilities[0]).toBe("falling-stars");
    expect(ability("serpent-totem").params.maxAlive).toBeDefined();
  });

  it("carries no map texts", () => {
    for (const file of FILES) {
      const text = read(file);
      expect(text, file).not.toContain("TRIGSTR");
      expect(forbiddenKeyPaths(JSON.parse(text), file)).toEqual([]);
    }
  });
});
