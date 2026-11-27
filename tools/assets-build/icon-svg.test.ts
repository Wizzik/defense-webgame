import { describe, expect, it } from "vitest";
import { optimizeIcon } from "./icon-svg";

const HEAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">';

describe("optimizeIcon", () => {
  it("drops the background square and fills the paths with currentColor", () => {
    const out = optimizeIcon(`${HEAD}<path d="M0 0h512v512H0z"/><path fill="#fff" d="M1 2h3z"/><path fill="#fff" d="M5 6v7z"/></svg>`);
    expect(out).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M1 2h3zM5 6v7z"/></svg>\n',
    );
  });

  it("refuses scripts, other elements, attributes and odd path data", () => {
    expect(() => optimizeIcon(`${HEAD}<script>alert(1)</script></svg>`)).toThrow();
    expect(() => optimizeIcon(`${HEAD}<g><path fill="#fff" d="M1 2z"/></g></svg>`)).toThrow();
    expect(() => optimizeIcon(`${HEAD}<path fill="#fff" onload="x" d="M1 2z"/></svg>`)).toThrow();
    expect(() => optimizeIcon(`${HEAD}<path fill="#fff" d="M1 2z&quot;"/></svg>`)).toThrow();
    expect(() => optimizeIcon(`${HEAD}<path fill="red" d="M1 2z"/></svg>`)).toThrow();
    expect(() => optimizeIcon(`${HEAD}<path d="M0 0h512v512H0z"/></svg>`)).toThrow();
    expect(() => optimizeIcon('<svg viewBox="0 0 24 24"><path fill="#fff" d="M1 2z"/></svg>')).toThrow();
  });
});
