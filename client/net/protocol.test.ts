import { describe, expect, it } from "vitest";
import { decodeMessage, inputMessage, PROTOCOL_VERSION, toInput, type NetMessage } from "./protocol";

const roundTrip = (m: unknown): NetMessage | null => decodeMessage(JSON.parse(JSON.stringify(m)));

describe("decodeMessage", () => {
  const valid: NetMessage[] = [
    { t: "hello", v: PROTOCOL_VERSION, seed: 4_000_000_000, hero: "stonehorn" },
    { t: "in", k: 33, p: 3, mx: -1, my: 1, c: 2, a: 15 },
    { t: "in", k: 34, p: 1, mx: 0, my: 0, c: -1, a: 16, ax: -812, ay: 300 },
    { t: "hash", k: 30, p: 2, h: 4_294_967_295 },
    { t: "ping", n: 7, at: 1234.5 },
    { t: "pong", n: 7, at: 1234.5 },
    { t: "bye" },
    { t: "ready" },
    { t: "join", v: PROTOCOL_VERSION, hero: "sparkshot", g: [["head", "travelers-hood", 3]] },
    { t: "start", v: PROTOCOL_VERSION, seed: 9, world: 2, d: "insane", you: 1, heroes: ["stonehorn", "sparkshot"], g: [[], [["ring1", "moonlit-signet", 1]]] },
    { t: "room", v: PROTOCOL_VERSION, you: 2, heroes: ["stonehorn", "sparkshot", "tidecaller"] },
    { t: "room", v: PROTOCOL_VERSION, you: -1, heroes: ["stonehorn", "a", "b", "c"] },
    { t: "left", p: 3 },
    { t: "gear", g: [["head", "travelers-hood", 2]] },
    { t: "gear", g: [] },
  ];

  it("is version 6 (a guest sends new gear after a run ended)", () => {
    expect(PROTOCOL_VERSION).toBe(6);
  });

  it.each(valid.map((m) => [m.t, m] as const))("round-trips %s", (_t, m) => {
    expect(roundTrip(m)).toEqual(m);
  });

  it("keeps only the known fields", () => {
    expect(roundTrip({ t: "bye", extra: 1 })).toEqual({ t: "bye" });
  });

  it.each([
    ["null", null],
    ["a string", "x"],
    ["an empty object", {}],
    ["an unknown type", { t: "nope" }],
    ["a step as a string", { t: "in", k: "1", p: 0, mx: 0, my: 0, c: -1, a: 0 }],
    ["NaN", NaN],
    ["a gear entry of two fields", { t: "join", v: 2, hero: "x", g: [["head", "hood"]] }],
    ["a gear level of 0", { t: "join", v: 2, hero: "x", g: [["head", "hood", 0]] }],
    ["an unknown difficulty", { t: "start", v: 2, seed: 1, world: 1, d: "easy", you: 1, heroes: ["a", "b"], g: [[], []] }],
    ["one hero in a start", { t: "start", v: 2, seed: 1, world: 1, d: "hell", you: 1, heroes: ["a"], g: [[]] }],
    ["gear lists not matching heroes", { t: "start", v: 2, seed: 1, world: 1, d: "hell", you: 1, heroes: ["a", "b"], g: [[]] }],
    ["a NaN step", { t: "in", k: NaN, p: 0, mx: 0, my: 0, c: -1, a: 0 }],
    ["a missing field", { t: "in", k: 1, p: 0, mx: 0, my: 0, c: -1 }],
    ["mx out of range", { t: "in", k: 1, p: 0, mx: 2, my: 0, c: -1, a: 0 }],
    ["a fractional move", { t: "in", k: 1, p: 0, mx: 0.5, my: 0, c: -1, a: 0 }],
    ["c out of range", { t: "in", k: 1, p: 0, mx: 0, my: 0, c: 3, a: 0 }],
    ["a out of range", { t: "in", k: 1, p: 0, mx: 0, my: 0, c: -1, a: 32 }],
    ["aim out of range", { t: "in", k: 1, p: 0, mx: 0, my: 0, c: -1, a: 16, ax: 5000, ay: 0 }],
    ["aim not whole", { t: "in", k: 1, p: 0, mx: 0, my: 0, c: -1, a: 16, ax: 1.5, ay: 0 }],
    ["a huge step", { t: "in", k: 2e6, p: 0, mx: 0, my: 0, c: -1, a: 0 }],
    ["a negative step", { t: "hash", k: -1, p: 0, h: 0 }],
    ["a hash over 32 bits", { t: "hash", k: 30, p: 0, h: 2 ** 32 }],
    ["a long hero id", { t: "hello", v: 1, seed: 1, hero: "x".repeat(100) }],
    ["an infinite ping time", { t: "ping", n: 1, at: Infinity }],
    ["a player of 4", { t: "in", k: 1, p: 4, mx: 0, my: 0, c: -1, a: 0 }],
    ["a hash without a player", { t: "hash", k: 30, h: 1 }],
    ["a start for the host", { t: "start", v: 3, seed: 1, world: 1, d: "hell", you: 0, heroes: ["a", "b"], g: [[], []] }],
    ["a start beyond its heroes", { t: "start", v: 3, seed: 1, world: 1, d: "hell", you: 2, heroes: ["a", "b"], g: [[], []] }],
    ["a room of five", { t: "room", v: 3, you: 1, heroes: ["a", "b", "c", "d", "e"] }],
    ["a left host", { t: "left", p: 0 }],
    ["gear without a list", { t: "gear" }],
    ["gear of a bad entry", { t: "gear", g: [["head", "hood", 0]] }],
    ["an array", [1, 2]],
  ])("rejects %s", (_name, raw) => {
    expect(roundTrip(raw)).toBeNull();
    expect(decodeMessage(raw)).toBeNull();
  });
});

describe("input messages", () => {
  it("carry a TickInput both ways", () => {
    const m = inputMessage(12, 1, { moveX: 1, moveY: -1, card: 0, actions: 4 });
    expect(m).toEqual({ t: "in", k: 12, p: 1, mx: 1, my: -1, c: 0, a: 4 });
    const decoded = roundTrip(m);
    if (decoded === null || decoded.t !== "in") throw new Error("not an input");
    const out = { moveX: 0, moveY: 0, card: -1, actions: 0 };
    expect(toInput(decoded, out)).toBe(out);
    expect(out).toEqual({ moveX: 1, moveY: -1, card: 0, actions: 4 });
  });
});
