import { describe, expect, it } from "vitest";
import type { PeerLink } from "../net/peer-link";
import type { NetGear } from "../net/protocol";
import { Roster } from "./coop-roster";

const link = (): PeerLink => ({ send() {}, onMessage() {}, onClose() {}, close() {}, rejected: 0 });
const ring: NetGear[] = [["ring1", "moonlit-signet", 2]];

describe("Roster", () => {
  it("numbers guests by join order", () => {
    const roster = new Roster();
    const [a, b] = [link(), link()];
    expect(roster.add(a, "sparkshot", [])).toBe(1);
    expect(roster.add(b, "tidecaller", ring)).toBe(2);
    expect(roster.numberOf(b)).toBe(2);
    expect(roster.heroes("stonehorn")).toEqual(["stonehorn", "sparkshot", "tidecaller"]);
    expect(roster.gear([])).toEqual([[], [], ring]);
    expect([...roster.links().keys()]).toEqual([1, 2]);
  });

  it("roster packs players after a guest leaves", () => {
    const roster = new Roster();
    const [a, b, c] = [link(), link(), link()];
    roster.add(a, "sparkshot", []);
    roster.add(b, "tidecaller", []);
    roster.add(c, "gravecaller", []);
    roster.remove(b);
    expect(roster.size).toBe(2);
    expect(roster.numberOf(c)).toBe(2);
    expect(roster.numberOf(b)).toBe(-1);
    expect(roster.heroes("x")).toEqual(["x", "sparkshot", "gravecaller"]);
  });

  it("a fifth player is refused", () => {
    const roster = new Roster();
    for (const hero of ["a", "b", "c"]) expect(roster.add(link(), hero, [])).not.toBeNull();
    expect(roster.add(link(), "d", [])).toBeNull();
    expect(roster.size).toBe(3);
  });

  it("a guest changes his hero and gear in place", () => {
    const roster = new Roster();
    const a = link();
    roster.add(a, "sparkshot", []);
    roster.setHero(a, "redcleaver", ring);
    expect(roster.heroes("x")).toEqual(["x", "redcleaver"]);
    expect(roster.gear([])).toEqual([[], ring]);
  });
});
