import { describe, expect, it } from "vitest";
import { decodeMessage, inputMessage, PROTOCOL_VERSION, toInput, type NetMessage } from "./protocol";

const roundTrip = (m: unknown): NetMessage | null => decodeMessage(JSON.parse(JSON.stringify(m)));

describe("decodeMessage", () => {
  const valid: NetMessage[] = [
    { t: "hello", v: PROTOCOL_VERSION, seed: 4_000_000_000, hero: "stonehorn" },
    { t: "in", k: 33, mx: -1, my: 1, c: 2, a: 15 },
    { t: "hash", k: 30, h: 4_294_967_295 },
    { t: "ping", n: 7, at: 1234.5 },
    { t: "pong", n: 7, at: 1234.5 },
    { t: "bye" },
  ];

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
    ["a step as a string", { t: "in", k: "1", mx: 0, my: 0, c: -1, a: 0 }],
    ["NaN", NaN],
    ["a NaN step", { t: "in", k: NaN, mx: 0, my: 0, c: -1, a: 0 }],
    ["a missing field", { t: "in", k: 1, mx: 0, my: 0, c: -1 }],
    ["mx out of range", { t: "in", k: 1, mx: 2, my: 0, c: -1, a: 0 }],
    ["a fractional move", { t: "in", k: 1, mx: 0.5, my: 0, c: -1, a: 0 }],
    ["c out of range", { t: "in", k: 1, mx: 0, my: 0, c: 3, a: 0 }],
    ["a out of range", { t: "in", k: 1, mx: 0, my: 0, c: -1, a: 16 }],
    ["a huge step", { t: "in", k: 2e6, mx: 0, my: 0, c: -1, a: 0 }],
    ["a negative step", { t: "hash", k: -1, h: 0 }],
    ["a hash over 32 bits", { t: "hash", k: 30, h: 2 ** 32 }],
    ["a long hero id", { t: "hello", v: 1, seed: 1, hero: "x".repeat(100) }],
    ["an infinite ping time", { t: "ping", n: 1, at: Infinity }],
    ["an array", [1, 2]],
  ])("rejects %s", (_name, raw) => {
    expect(roundTrip(raw)).toBeNull();
    expect(decodeMessage(raw)).toBeNull();
  });
});

describe("input messages", () => {
  it("carry a TickInput both ways", () => {
    const m = inputMessage(12, { moveX: 1, moveY: -1, card: 0, actions: 4 });
    expect(m).toEqual({ t: "in", k: 12, mx: 1, my: -1, c: 0, a: 4 });
    const decoded = roundTrip(m);
    if (decoded === null || decoded.t !== "in") throw new Error("not an input");
    const out = { moveX: 0, moveY: 0, card: -1, actions: 0 };
    expect(toInput(decoded, out)).toBe(out);
    expect(out).toEqual({ moveX: 1, moveY: -1, card: 0, actions: 4 });
  });
});
