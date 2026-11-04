import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

function listTs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return listTs(p);
    return e.name.endsWith(".ts") ? [p] : [];
  });
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
      const importsClient = /(from\s+|import\s+|import\()\s*["'][^"']*client\/[^"']*["']/.test(src);
      const usesDom = /\b(window|document|navigator)\./.test(src);
      if (importsThree || importsClient || usesDom) offenders.push(file.slice(root.length + 1));
    }
    expect(offenders).toEqual([]);
  });
});
