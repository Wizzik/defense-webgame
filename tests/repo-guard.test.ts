import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const root = join(import.meta.dirname, "..");

function listFiles(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return listFiles(p, pattern);
    return pattern.test(e.name) ? [p] : [];
  });
}

function listTs(dir: string): string[] {
  return listFiles(dir, /\.ts$/);
}

/** Collects every `source` and `mapName` string value and every `jassFunctions` entry anywhere in a parsed design file. */
function collectMapNames(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectMapNames(item, out);
  } else if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if ((key === "source" || key === "mapName") && typeof value === "string" && value !== "") {
        out.add(value);
      } else if (key === "jassFunctions" && Array.isArray(value)) {
        for (const fn of value) if (typeof fn === "string" && fn !== "") out.add(fn);
      } else {
        collectMapNames(value, out);
      }
    }
  }
}

describe("repo guard", () => {
  it("tracks no map data", () => {
    const files = execSync("git ls-files", { cwd: root, encoding: "utf8" }).split("\n");
    expect(files.filter((f) => /^(data-source|xhero)\/|\.w3x$|(^|\/)war3map\./i.test(f))).toEqual([]);
  });

  it("keeps sim/ free of three, client/ and DOM", () => {
    const offenders: string[] = [];
    for (const file of listTs(join(root, "sim"))) {
      const src = readFileSync(file, "utf8");
      const importsThree = /(from\s+|import\s+|import\()\s*["']three(\/[^"']*)?["']/.test(src);
      const importsClient = /(from\s+|import\s+|import\()\s*["'][^"']*client(\/[^"']*)?["']/.test(src);
      const usesDom = /\b(window|document|navigator|globalThis)\b/.test(src);
      if (importsThree || importsClient || usesDom) offenders.push(file.slice(root.length + 1));
    }
    expect(offenders).toEqual([]);
  });

  it("keeps sim/ deterministic", () => {
    const banned: RegExp[] = [
      /\bMath\.random\b/,
      /\bDate\b/,
      /\bperformance\b/,
      /\b(setTimeout|setInterval|requestAnimationFrame)\b/,
      /\bMath\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|exp|expm1|log|log1p|log2|log10|pow|cbrt|hypot)\b/,
      /[\w)\]]\s*\*\*(?!\/)/,
    ];
    const offenders: string[] = [];
    for (const file of listTs(join(root, "sim"))) {
      const src = readFileSync(file, "utf8");
      for (const pattern of banned) {
        if (pattern.test(src)) offenders.push(`${file.slice(root.length + 1)}: ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps map identifiers out of client/ and sim/", () => {
    const names = new Set<string>();
    for (const file of readdirSync(join(root, "design")).filter((f) => f.endsWith(".yaml"))) {
      const doc = parse(readFileSync(join(root, "design", file), "utf8")) as unknown;
      collectMapNames(doc, names);
    }
    expect(names.size).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const dir of ["client", "sim"]) {
      for (const file of listFiles(join(root, dir), /\.(ts|html|css|json)$/)) {
        const src = readFileSync(file, "utf8");
        for (const name of names) {
          const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          if (new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`).test(src)) {
            offenders.push(`${file.slice(root.length + 1)}: ${name}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("lists every asset in LICENSES.md", () => {
    const licenses = readFileSync(join(root, "assets/LICENSES.md"), "utf8");
    const files = execSync("git ls-files assets", { cwd: root, encoding: "utf8" })
      .split("\n")
      .filter((f) => f !== "" && f !== "assets/LICENSES.md" && !f.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThan(0);
    const missing = files.filter((f) => !licenses.includes(f.slice("assets/".length)));
    expect(missing).toEqual([]);
  });
});
