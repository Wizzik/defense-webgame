import { describe, expect, it } from "vitest";
import { botInput } from "./bot";
import { DamageMeter, METER_ATTACK, METER_SOURCES } from "./damage-meter";
import { stateHash } from "./hash";
import { createRun } from "./run";
import { gameData } from "./testing/game-data";

describe("damage meter", () => {
  it("adds damage, hits, the top hit and kills per source", () => {
    const meter = new DamageMeter();
    meter.add(2, 40, false);
    meter.add(2, 90, true);
    meter.add(METER_ATTACK, 15, false);
    meter.add(-1, 999, true);
    meter.add(METER_SOURCES, 999, true);
    expect(meter.damage[2]).toBe(130);
    expect(meter.hits[2]).toBe(2);
    expect(meter.top[2]).toBe(90);
    expect(meter.kills[2]).toBe(1);
    expect(meter.total()).toBe(145);
  });

  it("an autopilot run fills it with the hero's own damage, and the state hash ignores it", () => {
    const data = gameData();
    const run = createRun(data, { seed: 3, hero: "tidecaller", startPhase: 3 });
    const input = { moveX: 0, moveY: 0, card: -1, actions: 0 };
    for (let t = 0; t < 1800 && run.state !== "lost"; t++) run.step(botInput(run, input));
    const { meter } = run.players[0]!;
    expect(meter.damage[METER_ATTACK]).toBeGreaterThan(0);
    // at least one spell slot dealt damage
    expect(meter.damage.slice(0, 10).some((d) => d > 0)).toBe(true);
    // the world's hazards count for nobody, and overkill is left out
    expect(meter.total()).toBeLessThanOrEqual(run.stats.damageDealt + 1e-6);
    const hash = stateHash(run);
    meter.add(0, 12345, true);
    expect(stateHash(run)).toBe(hash);
  });
});
