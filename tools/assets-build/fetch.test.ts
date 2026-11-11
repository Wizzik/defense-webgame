import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SOURCE_DIR, targetPath } from "./fetch";

describe("targetPath", () => {
  it("keeps files inside the source folder of their key", () => {
    expect(targetPath("kay", "models/a.gltf")).toBe(join(SOURCE_DIR, "kay", "models", "a.gltf"));
    expect(targetPath("kay", "models/../tex/a.png")).toBe(join(SOURCE_DIR, "kay", "tex", "a.png"));
  });

  it("throws when a path escapes the folder", () => {
    expect(() => targetPath("kay", "../x.bin")).toThrow(/escapes/);
    expect(() => targetPath("kay", "models/../../../etc/passwd")).toThrow(/escapes/);
    expect(() => targetPath("kay", "/etc/passwd")).toThrow(/escapes/);
    expect(() => targetPath("kay", "..")).toThrow(/escapes/);
  });
});
