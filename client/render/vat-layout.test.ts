import { describe, expect, it } from "vitest";
import { vatLayout, vatTexel } from "./vat";

describe("vat layout", () => {
  it("tiles a wide mesh into 2048 columns", () => {
    expect(vatLayout(7214)).toEqual({ width: 2048, rowsPerFrame: 4 });
  });

  it("keeps a narrow mesh in one row", () => {
    expect(vatLayout(500)).toEqual({ width: 500, rowsPerFrame: 1 });
  });

  it("texel of a vertex", () => {
    expect(vatTexel(vatLayout(7214), 5000, 3)).toEqual([904, 14]);
  });
});
