import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import {
  CHECKPOINT_EVERY, firstDifference, matrixCases, runCase, type CaseResult,
} from "../client/determinism/matrix";
import { validateGameData, type GameData } from "../data/schema";
import { expect, test } from "./fixtures";

interface DeterminismState {
  done: boolean;
  results: CaseResult[];
  digest: string;
  ms: number;
}

declare global {
  interface Window {
    __determinism?: DeterminismState;
  }
}

// Playwright's loader needs import attributes for JSON, so the data is read from disk.
function gameData(): GameData {
  const read = (name: string): unknown =>
    JSON.parse(readFileSync(new URL(`../data/generated/${name}.json`, import.meta.url), "utf8"));
  return validateGameData({
    heroes: read("heroes"), abilities: read("abilities"), enemies: read("enemies"),
    rules: read("rules"), items: read("items"), constants: read("constants"), worlds: read("worlds"),
  });
}

async function pageResults(page: Page, query: string): Promise<DeterminismState> {
  await page.goto(`/determinism/${query}`);
  await page.waitForFunction(() => window.__determinism?.done === true, undefined, {
    timeout: 170_000, polling: 500,
  });
  return page.evaluate(() => window.__determinism!);
}

function describeDifference(reference: CaseResult[], got: CaseResult[], every: number): string {
  const diff = firstDifference(reference, got);
  if (diff === null) return "match";
  return `case ${diff.id} differs at checkpoint ${diff.index} (about step ${(diff.index + 1) * every})`;
}

test("the browser matches the Node reference on the whole matrix", async ({ page }) => {
  test.setTimeout(200_000);
  const data = gameData();
  const reference = matrixCases(data).map((c) => runCase(data, c));
  const got = await pageResults(page, "");
  console.log(`${test.info().project.name}: digest ${got.digest} in ${Math.round(got.ms)} ms`);
  expect(describeDifference(reference, got.results, CHECKPOINT_EVERY)).toBe("match");
});

test("every step matches for the first 600 steps of p16", async ({ page }) => {
  const data = gameData();
  const c = matrixCases(data).find((m) => m.id === "p16")!;
  const reference = [runCase(data, { ...c, maxTicks: 600 }, 1)];
  const got = await pageResults(page, "?case=p16&every=1&ticks=600");
  expect(got.results[0]!.checkpoints).toHaveLength(600);
  expect(describeDifference(reference, got.results, 1)).toBe("match");
});
