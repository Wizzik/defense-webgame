// Tests only: a quiet run (no spawns) with explicit progression rules.
import { createRun } from "../run";
import { gameData } from "./game-data";
import { silenceSpawns } from "./silence";

export interface ProgressionOptions {
  durationSeconds?: number;
  cardsPerOffer?: number;
}

export function progressionRun(options: ProgressionOptions = {}) {
  const data = gameData();
  data.rules.arena = {
    width: 6000, height: 5000, castle: { x: 0, y: -2400 }, heroStart: { x: 0, y: 0 },
    spawn: { radius: 2000, spread: 150 },
  };
  data.rules.hero = {
    collision: 32, baseRegen: 0.25, regenPerStr: 0.05, spellPowerPerInt: 0.01, cooldownSpeedPerInt: 0.01,
    dash: { distance: 350, seconds: 0.15, cooldownSeconds: 4 },
  };
  silenceSpawns(data);
  data.rules.progression = {
    xpFirst: 4, xpStep: 2, magnetRadius: 300, crystalSpeed: 900, pickupRadius: 56,
    attributeCardAmount: 10, cardsPerOffer: options.cardsPerOffer ?? 3,
    ultimateFromLevel: 6, ultimateLevelStep: 6,
  };
  return createRun(data, { seed: 7, durationSeconds: options.durationSeconds ?? 100000 });
}
