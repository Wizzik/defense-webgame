import { expect, startRun, test } from "./fixtures";

test("the pointer on a spell of the ability bar shows its level and values", async ({ page }) => {
  await page.goto("/?seed=1&debug=1&lang=en&hero=gravecaller");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await startRun(page);
  await page.waitForFunction(() => window.__game?.screen === "playing", undefined, { timeout: 30_000 });
  const tip = page.locator("#ability-tooltip");
  await expect(tip).toBeHidden();
  await page.locator('#hud-abilities .cell[data-slot="0"]').hover();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Level 1 / 6");
  await expect(tip).toContainText("→");
  if (process.env.SHOTS) await page.screenshot({ path: "test-results/shots/ability-tooltip.png" });
  // the blink cell waits for its level
  await expect(page.locator("#hud-abilities .cell.blink")).toContainText("from level 20");
  await page.mouse.move(5, 5);
  await expect(tip).toBeHidden();
});
