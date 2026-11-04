import { expect, test, type Page } from "@playwright/test";

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
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

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

  // Luminance stddev computed in the page; only the number leaves it.
  const stdDev = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    const count = d.length / 4;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!;
      sum += y;
      sumSq += y * y;
    }
    const mean = sum / count;
    return Math.sqrt(Math.max(0, sumSq / count - mean * mean));
  }, shot.toString("base64"));
  console.log(`crowd luminance stddev (${testInfo.project.name}): ${stdDev.toFixed(2)}`);
  expect(stdDev, `luminance stddev ${stdDev.toFixed(2)}`).toBeGreaterThan(2.5);

  expect(errors).toEqual([]);
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
