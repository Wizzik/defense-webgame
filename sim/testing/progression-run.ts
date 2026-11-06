// Tests only: a quiet run (no spawns) with explicit progression rules.
import { createRun } from "../run";
import { gameData } from "./game-data";

export interface ProgressionOptions {
  durationSeconds?: number;
  cardsPerOffer?: number;
}

export function progressionRun(options: ProgressionOptions = {}) {
  const data = gameData();
  data.rules.arena = {
    width: 6000, height: 5000, castle: { x: 0, y: -2400 }, heroStart: { x: 0, y: 0 },
    gates: [{ x: -1800, y: 2200 }, { x: 1800, y: 2200 }], gateRadius: 150,
  };
  data.rules.hero = {
    collision: 32, baseRegen: 0.25, regenPerStr: 0.05, spellPowerPerInt: 0.01, cooldownSpeedPerInt: 0.01,
  };
  data.rules.phases[0].spawnPerSecond = 0;
  data.rules.progression = {
    xpFirst: 4, xpStep: 2, magnetRadius: 300, crystalSpeed: 900, pickupRadius: 56,
    attributeCardAmount: 10, cardsPerOffer: options.cardsPerOffer ?? 3,
  };
  return createRun(data, { seed: 7, durationSeconds: options.durationSeconds ?? 100000 });
}
