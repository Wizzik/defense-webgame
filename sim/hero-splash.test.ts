import { describe, expect, it } from "vitest";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { updateHeroCombat } from "./hero";
import { createRun } from "./run";
import { gameData } from "./testing/game-data";
import { silenceSpawns } from "./testing/silence";

function newRun(strikes: number | undefined, splash: { radius: number; share: number } | undefined) {
  const data = gameData();
  silenceSpawns(data);
  const hero = data.heroes.find((h) => h.id === "stonehorn")!;
  hero.baseAttack = { ...hero.baseAttack, damageMin: 10, damageMax: 10 };
  if (strikes !== undefined) hero.baseAttack.strikes = strikes;
  if (splash !== undefined) hero.baseAttack.splash = splash;
  data.enemies[0].armor = 0;
  return createRun(data, { seed: 3, hero: "stonehorn", durationSeconds: 100000 });
}

function hitsOn(run: ReturnType<typeof newRun>, slot: number): number {
  let n = 0;
  for (let k = 0; k < run.events.count; k++) if (run.events.kind[k] === EventKind.Hit && run.events.a[k] === slot) n++;
  return n;
}

describe("base attack blows and splash", () => {
  it("two strikes hit the target twice", () => {
    const run = newRun(2, undefined);
    const t = run.enemies.spawn(0, Role.Hunter, run.hero.x + 100, run.hero.y, 100000, 1, 0);
    updateHeroCombat(run);
    expect(hitsOn(run, t)).toBe(2);
  });

  it("splash hurts an enemy near the target for its share, not one far away", () => {
    const run = newRun(undefined, { radius: 160, share: 0.5 });
    const t = run.enemies.spawn(0, Role.Hunter, run.hero.x + 100, run.hero.y, 100000, 1, 0);
    const near = run.enemies.spawn(0, Role.Hunter, run.hero.x + 250, run.hero.y, 100000, 1, 0);
    const far = run.enemies.spawn(0, Role.Hunter, run.hero.x + 900, run.hero.y, 100000, 1, 0);
    updateHeroCombat(run);
    const lostMain = 100000 - run.enemies.hp[t];
    const lostNear = 100000 - run.enemies.hp[near];
    expect(lostNear).toBeCloseTo(lostMain * 0.5, 5);
    expect(run.enemies.hp[far]).toBe(100000);
  });
});
