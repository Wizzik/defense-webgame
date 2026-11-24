import { expect, startRun, test } from "./fixtures";

// Multiplayer migration step 7: the co-op HUD and cards in one window. ?debug=1&mate=<id> runs a co-op run of two
// heroes locally (the autopilot steers the second), so the client's co-op parts are tested without a network.
// The lockstep over WebRTC is tested by hand with two windows (docs/DECISIONS.md, step 7).

test("a local co-op run shows two heroes, non-pausing cards and the teammate", async ({ page }) => {
  await page.goto("/?debug=1&mate=gravecaller&hero=sparkshot&seed=4&lang=en");
  await page.waitForFunction(() => (window.__game?.frames ?? 0) > 30, undefined, { timeout: 90_000, polling: 250 });
  await startRun(page);
  await page.waitForFunction(() => window.__game!.tick > 30, undefined, { timeout: 60_000, polling: 100 });
  const players = await page.evaluate(() => window.__game!.players.map((p) => p.hero));
  expect(players).toEqual(["sparkshot", "gravecaller"]);
  expect(await page.evaluate(() => window.__game!.render.heroModels)).toBe(2);
  await expect(page.locator("#team")).toBeVisible();
  await expect(page.locator(".team-name").first()).toHaveText("Gravecaller");

  // a level-up opens the cards as a panel and the run goes on
  await page.evaluate(() => window.__game!.debug!.grantXp(40));
  await page.waitForFunction(() => window.__game!.players[0]!.offer === "card", undefined, { timeout: 30_000, polling: 100 });
  await expect(page.locator("#cards.coop")).toBeVisible();
  await expect(page.locator("#cards-timer")).toBeVisible();
  const before = await page.evaluate(() => window.__game!.tick);
  await page.waitForFunction((t) => window.__game!.tick > t + 15, before, { timeout: 30_000, polling: 100 });
  expect(await page.evaluate(() => window.__game!.screen)).toBe("playing");
  const levels = await page.evaluate(() => window.__game!.abilityLevels.reduce((a, b) => a + b, 0));
  await page.waitForTimeout(400);
  await page.keyboard.press("Digit1");
  await page.waitForFunction((n) => window.__game!.abilityLevels.reduce((a, b) => a + b, 0) > n, levels, { timeout: 30_000, polling: 100 });

  // the local hero falls: the banner shows, the autopilot's hero walks over and revives him
  await page.evaluate(() => window.__game!.debug!.down(0));
  await expect(page.locator("#team-banner")).toBeVisible();
  await page.waitForFunction(() => !window.__game!.players[0]!.down, undefined, { timeout: 60_000, polling: 100 });
  expect(await page.evaluate(() => window.__game!.screen)).toBe("playing");
  expect(await page.evaluate(() => window.__game!.heroHp)).toBeGreaterThan(0);
});

test("a local four-player run shows four heroes and three teammates", async ({ page }) => {
  await page.goto("/?debug=1&mate=gravecaller,tidecaller,stonehorn&hero=sparkshot&seed=4&lang=en");
  await page.waitForFunction(() => (window.__game?.frames ?? 0) > 30, undefined, { timeout: 90_000, polling: 250 });
  await startRun(page);
  await page.waitForFunction(() => window.__game!.tick > 30, undefined, { timeout: 60_000, polling: 100 });
  const players = await page.evaluate(() => window.__game!.players.map((p) => p.hero));
  expect(players).toEqual(["sparkshot", "gravecaller", "tidecaller", "stonehorn"]);
  expect(await page.evaluate(() => window.__game!.render.heroModels)).toBe(4);
  await expect(page.locator(".team-name")).toHaveCount(3);
  // the autopilot heroes walk on their own
  const start = await page.evaluate(() => window.__game!.players.slice(1).map((p) => [p.x, p.y]));
  await page.waitForFunction((s) => window.__game!.players.slice(1).every((p, i) => p.x !== s[i]![0] || p.y !== s[i]![1]), start, { timeout: 30_000, polling: 200 });
});
