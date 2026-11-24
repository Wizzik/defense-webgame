import { describe, expect, it } from "vitest";
import { everyoneReady, inboundPlayer, relayTargets } from "./relay";

describe("inboundPlayer", () => {
  it("host takes the player from the link", () => {
    expect(inboundPlayer(0, 2, 1, 3)).toBe(2);
  });

  it("guest takes the player from the message", () => {
    expect(inboundPlayer(1, 0, 2, 3)).toBe(2);
    expect(inboundPlayer(2, 0, 0, 3)).toBe(0);
  });

  it("guest ignores its own player and players out of the run", () => {
    expect(inboundPlayer(1, 0, 1, 3)).toBeNull();
    expect(inboundPlayer(1, 0, 3, 3)).toBeNull();
  });
});

describe("relayTargets", () => {
  it("host relays to every other guest", () => {
    expect(relayTargets(0, 1, [1, 2, 3])).toEqual([2, 3]);
  });

  it("a guest relays nothing", () => {
    expect(relayTargets(2, 0, [0])).toEqual([]);
  });
});

describe("everyoneReady", () => {
  it("needs every guest ready or gone, each counted once", () => {
    expect(everyoneReady(new Set([1]), [1], [1, 2])).toBe(false);
    expect(everyoneReady(new Set([1]), [2], [1, 2])).toBe(true);
    expect(everyoneReady(new Set([1, 2]), [], [1, 2])).toBe(true);
    expect(everyoneReady(new Set(), [], [1])).toBe(false);
  });
});
