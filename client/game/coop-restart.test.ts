import { describe, expect, it } from "vitest";
import type { NetGear } from "../net/protocol";
import { restartGroup } from "./coop-restart";

const g = (id: string): NetGear[] => [["weapon", id, 1]];

describe("restartGroup", () => {
  const heroes = ["stonehorn", "sparkshot", "gravecaller", "tidecaller"];
  const gear = [g("a"), g("b"), g("c"), g("d")];
  const links = new Map([[1, "L1"], [2, "L2"], [3, "L3"]]);

  it("keeps the whole group in order, with the host's gear read again", () => {
    const next = restartGroup(heroes, gear, links, [], g("new"))!;
    expect(next.heroes).toEqual(heroes);
    expect(next.gear).toEqual([g("new"), g("b"), g("c"), g("d")]);
    expect([...next.links]).toEqual([[1, "L1"], [2, "L2"], [3, "L3"]]);
  });

  it("leaves out a guest who left and numbers the rest again", () => {
    const next = restartGroup(heroes, gear, links, [2], g("a"))!;
    expect(next.heroes).toEqual(["stonehorn", "sparkshot", "tidecaller"]);
    expect(next.gear).toEqual([g("a"), g("b"), g("d")]);
    expect([...next.links]).toEqual([[1, "L1"], [2, "L3"]]);
  });

  it("is null when every guest left", () => {
    expect(restartGroup(heroes, gear, links, [1, 2, 3], g("a"))).toBeNull();
  });
});
