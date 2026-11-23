import { describe, expect, it } from "vitest";
import { EventKind } from "./events";
import { NO_INPUT } from "./input";
import { createRun } from "./run";
import { gameData } from "./testing/game-data";

// Multiplayer migration step 7: every event names the player whose system pushed it, so the client draws a
// teammate's casts with his abilities and from his hero.

describe("event player column", () => {
  it("credits casts to the player whose hero cast", () => {
    const run = createRun(gameData(), { seed: 5, players: [{ hero: "stonehorn" }, { hero: "sparkshot" }] });
    const seen = [new Set<number>(), new Set<number>()];
    for (let k = 0; k < 900; k++) {
      run.step([NO_INPUT, NO_INPUT]);
      const { events } = run;
      for (let i = 0; i < events.count; i++) {
        if (events.kind[i] !== EventKind.Cast) continue;
        const p = events.player[i]!;
        expect(p).toBeLessThan(2);
        seen[p]!.add(events.a[i]!);
        // the cast's slot is learned by that player's hero
        expect(run.players[p]!.abilities[events.a[i]!]!.level).toBeGreaterThan(0);
      }
      expect(run.current).toBe(0);
      expect(run.events.who).toBe(0);
    }
    expect(seen[0]!.size).toBeGreaterThan(0);
    expect(seen[1]!.size).toBeGreaterThan(0);
  });

  it("is 0 for every event of one player", () => {
    const run = createRun(gameData(), { seed: 5 });
    for (let k = 0; k < 300; k++) {
      run.step(NO_INPUT);
      for (let i = 0; i < run.events.count; i++) expect(run.events.player[i]).toBe(0);
    }
  });
});
