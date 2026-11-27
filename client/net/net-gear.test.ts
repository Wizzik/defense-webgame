import { describe, expect, it } from "vitest";
import { Rng, rollItem } from "../../sim";
import { gameData } from "../../sim/testing/game-data";
import { fromNet, toNet } from "./net-gear";
import { decodeMessage, type NetGear, PROTOCOL_VERSION } from "./protocol";

const data = gameData();
const rolled = rollItem(data, new Rng(9), "head", "mythic", 9, "int");
const base = data.loot.bases[rolled.base]!.id;
const named = data.items.find((i) => i.slotType === "ring")!.id;

describe("co-op gear on the wire", () => {
  it("a named and a random item survive the trip through a join message", () => {
    const loadout = [
      { slot: "head" as const, item: `rolled-${base}`, level: 3, rolled },
      { slot: "ring1" as const, item: named, level: 2 },
    ];
    const sent = JSON.parse(JSON.stringify({ t: "join", v: PROTOCOL_VERSION, hero: "gravecaller", g: toNet(loadout) }));
    const message = decodeMessage(sent);
    expect(message?.t).toBe("join");
    expect(fromNet(data, (message as { g: NetGear[] }).g)).toEqual(loadout);
  });

  it("leaves out an unknown slot and a roll that does not fit the data", () => {
    const [entry] = toNet([{ slot: "head", item: `rolled-${base}`, level: 1, rolled }]) as [NetGear];
    const roll = entry[3]!;
    const bad: NetGear[] = [
      ["nose", named, 1],
      ["head", "rolled-other", 1, roll],
      ["head", `rolled-${base}`, 1, [9999, ...roll.slice(1)] as typeof roll],
      ["head", `rolled-${base}`, 1, [roll[0], roll[1], roll[2], roll[3], roll[4], [0, 0], [1, 1], [0, 0]]],
      ["head", `rolled-${base}`, 1, [roll[0], roll[1], 999, roll[3], roll[4], roll[5], roll[6], roll[7]]],
    ];
    expect(fromNet(data, bad)).toEqual([]);
  });

  it("the protocol refuses a roll of the wrong shape", () => {
    const join = (g: unknown) => decodeMessage({ t: "join", v: PROTOCOL_VERSION, hero: "x", g });
    const ok = [0, 4, -1, -1, -1, [1], [2.5], [0]];
    expect(join([["head", "rolled-a", 1, ok]])).not.toBeNull();
    expect(join([["head", "rolled-a", 1, [0, 4, -1, -1, -1, [1], [-2], [0]]]])).toBeNull();
    expect(join([["head", "rolled-a", 1, [0, 4, -1, -1, -1, [1, 2], [2], [0]]]])).toBeNull();
    expect(join([["head", "rolled-a", 1, [0, 4, -1, -1, -1, [], [], []]]])).toBeNull();
    expect(join([["head", "rolled-a", 1, [0, 4, -1, -1, -1, [1], [2], [7]]]])).toBeNull();
    expect(join([["head", "rolled-a", 1, "x"]])).toBeNull();
  });
});
