import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import type { GameSnapshot } from "../client/game/debug";
import { expect, test } from "./fixtures";
import { luminanceStdDev } from "./luminance";

declare global {
  interface Window {
    __game?: GameSnapshot;
  }
}

/** XP of the first level-up, read from the generated rules so a retune does not break the test. */
const xpFirst = (
  JSON.parse(readFileSync(join(import.meta.dirname, "..", "data", "generated", "rules.json"), "utf8")) as {
    progression: { xpFirst: number };
  }
).progression.xpFirst;

type Screen = GameSnapshot["screen"];

async function waitForScreen(page: Page, screen: Screen, timeout = 90_000): Promise<void> {
  await page.waitForFunction((s) => window.__game?.screen === s, screen, { timeout, polling: 250 });
}

test("menu starts a run on the available backend", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&lang=en");
  const start = page.locator("#start");
  await expect(start).toHaveText("Start", { timeout: 90_000 });
  await start.click();
  await page.waitForFunction(() => (window.__game?.frames ?? 0) > 30, undefined, {
    timeout: 90_000,
    polling: 250,
  });

  const expected = testInfo.project.name === "webgpu-swiftshader" ? "WebGPU" : "WebGL2";
  expect(await page.evaluate(() => window.__game?.backend)).toBe(expected);
  expect(await page.evaluate(() => window.__game?.screen)).toBe("playing");

  // enemies spawn a few seconds into the run
  await page.waitForFunction(() => (window.__game?.enemies ?? 0) > 0, undefined, {
    timeout: 90_000,
    polling: 250,
  });

  // Hide the UI and the overlay so only the rendered scene is measured.
  const hide = (visibility: string) =>
    page.evaluate((v) => {
      for (const id of ["overlay", "ui"]) document.querySelector<HTMLElement>(`#${id}`)!.style.visibility = v;
    }, visibility);
  await hide("hidden");
  const shot = await page.locator("canvas").first().screenshot({ type: "png" });
  await hide("");
  await testInfo.attach(`game-${testInfo.project.name}`, { body: shot, contentType: "image/png" });

  const stdDev = await luminanceStdDev(page, shot);
  console.log(`game luminance stddev (${testInfo.project.name}): ${stdDev.toFixed(2)}`);
  expect(stdDev, `luminance stddev ${stdDev.toFixed(2)}`).toBeGreaterThan(2.5);
});

test("level-up shows three cards and a pick resumes the run", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&debug=1&lang=cs");
  await page.locator("#start").click();
  await waitForScreen(page, "playing");
  await page.evaluate((n) => window.__game!.debug!.grantXp(n), xpFirst);
  await waitForScreen(page, "levelUp");

  await expect(page.locator("button.card")).toHaveCount(3);
  await expect(page.locator(".cards-title")).toHaveText("Vyber vylepšení");
  await testInfo.attach(`levelup-${testInfo.project.name}`, {
    body: await page.screenshot({ type: "png" }),
    contentType: "image/png",
  });

  await page.locator("button.card").first().click();
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => window.__game?.level)).toBe(2);
});

test("run ends with the end screen", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&duration=10&speed=8&lang=en");
  await page.locator("#start").click();
  await waitForScreen(page, "won");

  await expect(page.getByText("You held the castle!")).toBeVisible();
  await testInfo.attach(`end-${testInfo.project.name}`, {
    body: await page.screenshot({ type: "png" }),
    contentType: "image/png",
  });

  await page.locator("#again").click();
  await expect(page.locator("#start")).toBeVisible();
  await waitForScreen(page, "menu", 10_000);
});
