import { describe, expect, it } from "vitest";
import { Announcer } from "./announcer";

describe("Announcer", () => {
  it("is empty at the start", () => {
    expect(new Announcer().text).toBe("");
  });

  it("a newer line replaces an older one", () => {
    const announcer = new Announcer();
    announcer.push("first", 100);
    announcer.push("second", 10);
    expect(announcer.text).toBe("second");
    for (let i = 0; i < 10; i++) announcer.step();
    // the older line does not come back
    expect(announcer.text).toBe("");
  });

  it("a line disappears after its ticks", () => {
    const announcer = new Announcer();
    announcer.push("boss", 3);
    announcer.step();
    announcer.step();
    expect(announcer.text).toBe("boss");
    announcer.step();
    expect(announcer.text).toBe("");
    announcer.step();
    expect(announcer.text).toBe("");
  });

  it("clear removes the line at once", () => {
    const announcer = new Announcer();
    announcer.push("boss", 30);
    announcer.clear();
    expect(announcer.text).toBe("");
  });
});
