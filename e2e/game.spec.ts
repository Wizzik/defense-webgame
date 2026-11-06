import { expect, test } from "@playwright/test";
import type { GameSnapshot } from "../client/game/debug";
import { luminanceStdDev } from "./luminance";

declare global {
  interface Window {
    __game?: GameSnapshot;
  }
}

test("renders the arena and the hero", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/?fps=1&seed=1");
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

  // Hide the overlay so only the rendered scene is measured.
  await page.evaluate(() => {
    document.querySelector<HTMLElement>("#overlay")!.style.visibility = "hidden";
  });
  const shot = await page.locator("canvas").first().screenshot({ type: "png" });
  await page.evaluate(() => {
    document.querySelector<HTMLElement>("#overlay")!.style.visibility = "";
  });
  await testInfo.attach(`game-${testInfo.project.name}`, { body: shot, contentType: "image/png" });

  const stdDev = await luminanceStdDev(page, shot);
  console.log(`game luminance stddev (${testInfo.project.name}): ${stdDev.toFixed(2)}`);
  expect(stdDev, `luminance stddev ${stdDev.toFixed(2)}`).toBeGreaterThan(2.5);

  expect(errors).toEqual([]);
});
