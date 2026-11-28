import { describe, expect, it } from "vitest";
import { Role } from "./enemies";
import { updateHeroCombat } from "./hero";
import { createRun } from "./run";
import { gameData } from "./testing/game-data";
import { silenceSpawns } from "./testing/silence";

function newRun(bounce: { count: number; range: number; falloff: number } | undefined) {
  const data = gameData();
  silenceSpawns(data);
  const hero = data.heroes.find((h) => h.id === "stonehorn")!;
  hero.baseAttack = { ...hero.baseAttack, damageMin: 10, damageMax: 10 };
  if (bounce !== undefined) hero.baseAttack.bounce = bounce;
  data.enemies[0].armor = 0;
  return createRun(data, { seed: 3, hero: "stonehorn", durationSeconds: 100000 });
}

const lost = (run: ReturnType<typeof newRun>, slot: number): number => 100000 - run.enemies.hp[slot];

describe("bouncing base attack", () => {
  it("leaps to the nearest unstruck enemies within range, losing falloff each leap", () => {
    const run = newRun({ count: 2, range: 300, falloff: 0.25 });
    const x = run.hero.x;
    const y = run.hero.y;
    const t = run.enemies.spawn(0, Role.Hunter, x + 100, y, 100000, 1, 0);
    const b1 = run.enemies.spawn(0, Role.Hunter, x + 300, y, 100000, 1, 0);
    const b2 = run.enemies.spawn(0, Role.Hunter, x + 550, y, 100000, 1, 0);
    const b3 = run.enemies.spawn(0, Role.Hunter, x + 800, y, 100000, 1, 0);
    updateHeroCombat(run);
    const main = lost(run, t);
    expect(main).toBeGreaterThan(0);
    expect(lost(run, b1)).toBeCloseTo(main * 0.75, 5);
    expect(lost(run, b2)).toBeCloseTo(main * 0.75 * 0.75, 5);
    expect(lost(run, b3)).toBe(0); // count 2
  });

  it("stops when no unstruck enemy is in range", () => {
    const run = newRun({ count: 3, range: 150, falloff: 0.3 });
    const t = run.enemies.spawn(0, Role.Hunter, run.hero.x + 100, run.hero.y, 100000, 1, 0);
    const far = run.enemies.spawn(0, Role.Hunter, run.hero.x + 600, run.hero.y, 100000, 1, 0);
    updateHeroCombat(run);
    expect(lost(run, t)).toBeGreaterThan(0);
    expect(lost(run, far)).toBe(0);
  });

  it("does nothing without baseAttack.bounce", () => {
    const run = newRun(undefined);
    const t = run.enemies.spawn(0, Role.Hunter, run.hero.x + 100, run.hero.y, 100000, 1, 0);
    const near = run.enemies.spawn(0, Role.Hunter, run.hero.x + 200, run.hero.y, 100000, 1, 0);
    updateHeroCombat(run);
    expect(lost(run, t)).toBeGreaterThan(0);
    expect(lost(run, near)).toBe(0);
  });
});
