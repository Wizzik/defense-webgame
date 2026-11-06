import type { Page } from "@playwright/test";

/** Luminance standard deviation of a PNG, computed in the page; only the number leaves it. */
export async function luminanceStdDev(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(async (b64) => {
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
  }, png.toString("base64"));
}
