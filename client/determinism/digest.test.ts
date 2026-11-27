import { describe, expect, it } from "vitest";
import { gameData } from "../../sim/testing/game-data";
import { matrixCases, matrixDigest, runCase } from "./matrix";

/**
 * The regression test of the multiplayer migration (docs/multiplayer/single-hero-inventory.md, chapter 4):
 * a refactor must keep the one-player game, so the matrix digest stays. A change of the game on purpose
 * (balance, a new mechanic) changes it too: then put the new digest here (`npm run sim:digest`) and say so in the PR.
 */
const EXPECTED_DIGEST = "4d1136d4";

describe("determinism matrix digest", () => {
  it("stays the digest of the one-player game", () => {
    const data = gameData();
    const results = matrixCases(data).map((c) => runCase(data, c));
    expect(matrixDigest(results)).toBe(EXPECTED_DIGEST);
  }, 60_000);
});
