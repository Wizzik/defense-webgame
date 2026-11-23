import { describe, expect, it } from "vitest";
import { joinCodeOf } from "./coop-setup";

describe("joinCodeOf", () => {
  it("reads ?join, trimmed and lower case", () => {
    expect(joinCodeOf("?join=DWG-abc234")).toBe("dwg-abc234");
    expect(joinCodeOf("?signal=x&join=%20dwg-abc234%20")).toBe("dwg-abc234");
    expect(joinCodeOf("?seed=1")).toBeNull();
  });
});
