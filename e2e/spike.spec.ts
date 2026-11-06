import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { luminanceStdDev } from "./luminance";

interface SpikeState {
  backend: "WebGPU" | "WebGL2";
  n: number;
  frames: number;
  avgFps: number;
  low1Fps: number;
}

declare global {
  interface Window {
    __spike?: SpikeState;
  }
}

async function waitForFrames(page: Page, min: number): Promise<void> {
  await page.waitForFunction((m) => (window.__spike?.frames ?? 0) > m, min, {
    timeout: 90_000,
    polling: 250,
  });
}

test("renders crowd on available backend", async ({ page }, testInfo) => {
  await page.goto("/spike/");
  await waitForFrames(page, 30);

  const expected = testInfo.project.name === "webgpu-swiftshader" ? "WebGPU" : "WebGL2";
  expect(await page.evaluate(() => window.__spike?.backend)).toBe(expected);

  // Hide the HUD overlay so only the rendered scene is measured.
  await page.evaluate(() => {
    document.querySelector<HTMLElement>("#overlay")!.style.visibility = "hidden";
  });
  const shot = await page.locator("canvas").first().screenshot({ type: "png" });
  await page.evaluate(() => {
    document.querySelector<HTMLElement>("#overlay")!.style.visibility = "";
  });
  await testInfo.attach(`crowd-${testInfo.project.name}`, { body: shot, contentType: "image/png" });

  const stdDev = await luminanceStdDev(page, shot);
  console.log(`crowd luminance stddev (${testInfo.project.name}): ${stdDev.toFixed(2)}`);
  expect(stdDev, `luminance stddev ${stdDev.toFixed(2)}`).toBeGreaterThan(2.5);
});

test("forced webgl2 uses WebGL2", async ({ page }) => {
  await page.goto("/spike/?renderer=webgl2");
  await waitForFrames(page, 30);
  expect(await page.evaluate(() => window.__spike?.backend)).toBe("WebGL2");
});

test("n=600 frames advance", async ({ page }) => {
  await page.goto("/spike/?n=600");
  // Software rendering is slow at n=600 (< 1 fps), so only require initialisation.
  await waitForFrames(page, 0);
  const before = await page.evaluate(() => window.__spike!.frames);
  await page.waitForTimeout(10_000);
  const after = await page.evaluate(() => window.__spike!.frames);
  expect(after).toBeGreaterThan(before);
});
