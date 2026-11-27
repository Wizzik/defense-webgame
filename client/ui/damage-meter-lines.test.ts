import { describe, expect, it } from "vitest";
import { createRun, METER_ATTACK, METER_THORNS, TICKS_PER_SECOND } from "../../sim";
import { gameData } from "../../sim/testing/game-data";
import { meterLines, shortNumber } from "./damage-meter-lines";

describe("damage meter lines", () => {
  it("lists the sources with damage, the biggest first, with share and damage per second", () => {
    const run = createRun(gameData(), { seed: 1, hero: "stonehorn" });
    const player = run.players[0]!;
    player.meter.add(0, 300, false);
    player.meter.add(METER_ATTACK, 600, true);
    player.meter.add(METER_THORNS, 100, false);
    const lines = meterLines("en", player, 10 * TICKS_PER_SECOND);
    expect(lines.total).toBe(1000);
    expect(lines.dps).toBe(100);
    expect(lines.rows.map((row) => [row.name, row.damage, row.share])).toEqual([
      ["Attack", 600, 0.6], [player.abilities[0]!.def.name.en, 300, 0.3], ["Thorns", 100, 0.1],
    ]);
    expect(lines.rows[1]!.ability).toBe(player.abilities[0]!.def.id);
    expect(lines.rows[0]).toMatchObject({ hits: 1, top: 600, kills: 1, dps: 60 });
  });

  it("an empty meter has no rows; the run's first second counts as one", () => {
    const run = createRun(gameData(), { seed: 1 });
    expect(meterLines("en", run.players[0]!, 0)).toEqual({ rows: [], total: 0, dps: 0 });
  });

  it("writes short numbers", () => {
    expect([shortNumber(950.4), shortNumber(1234), shortNumber(12_345), shortNumber(1_250_000)])
      .toEqual(["950", "1.23k", "12.3k", "1.25M"]);
  });
});
