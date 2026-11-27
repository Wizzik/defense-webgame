import { describe, expect, it } from "vitest";
import { createRun, METER_ATTACK } from "../../sim";
import { gameData } from "../../sim/testing/game-data";
import { meterLine, meterOf } from "./meter";

describe("sim-run meter", () => {
  it("names the sources and sums the shares over runs, the biggest first", () => {
    const run = createRun(gameData(), { seed: 1, hero: "stonehorn" });
    const player = run.players[0]!;
    player.meter.add(0, 300, false);
    player.meter.add(METER_ATTACK, 100, false);
    const first = meterOf(player);
    expect(first).toEqual({ [player.abilities[0]!.def.id]: 300, attack: 100 });
    expect(meterLine([first, { attack: 500, thorns: 100 }])).toBe(
      `  meter attack 60 % | ${player.abilities[0]!.def.id} 30 % | thorns 10 %`,
    );
    expect(meterLine([])).toBe("  meter -");
  });
});
