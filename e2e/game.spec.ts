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

/** Enemy ids from the generated data, so adding a type extends the test. */
const enemyIds = (
  JSON.parse(readFileSync(join(import.meta.dirname, "..", "data", "generated", "enemies.json"), "utf8")) as { id: string }[]
).map((e) => e.id);

/** Hero ids from the generated data, so adding a hero extends the test. */
const heroIds = (
  JSON.parse(readFileSync(join(import.meta.dirname, "..", "data", "generated", "heroes.json"), "utf8")) as { id: string }[]
).map((h) => h.id);

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
  expect(await page.evaluate(() => window.__game?.render.enemyMeshes)).toBe(6);

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

test("menu warns about software rendering only on a software GPU", async ({ page }) => {
  await page.goto("/?seed=1&lang=en");
  const start = page.locator("#start");
  await expect(start).toHaveText("Start", { timeout: 90_000 });
  const gpu = await page.evaluate(() => window.__game!.gpu);
  expect(gpu.name.length).toBeGreaterThan(0);
  const warning = page.locator("#gpu-warning");
  if (gpu.software) await expect(warning).toBeVisible();
  else await expect(warning).toBeHidden();
  // the warning never blocks the start
  await start.click();
  await waitForScreen(page, "playing");
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

test("menu lets you pick a hero", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await expect(page.locator("button.hero-button")).toHaveCount(8);
  await page.locator("button.hero-button", { hasText: "Nightglaive" }).click();
  await testInfo.attach(`menu-hero-${testInfo.project.name}`, {
    body: await page.screenshot({ type: "png" }),
    contentType: "image/png",
  });
  await page.locator("#start").click();
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => window.__game?.hero)).toBe("nightglaive");
  expect(await page.evaluate(() => window.__game?.screen)).toBe("playing");
});

test("every hero has its own model", async ({ page }) => {
  await page.goto("/?seed=1&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  for (const hero of heroIds) {
    await page.locator(`button.hero-button[data-hero="${hero}"]`).click();
    // Start is disabled while the model loads, and the run behind the menu then has the new hero
    await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
    await expect(page.locator("#start")).toBeEnabled();
    await page.waitForFunction((id) => window.__game?.hero === id, hero, { timeout: 10_000 });
    // exactly one hero model stands in the scene: the old one is gone
    await page.waitForFunction(() => window.__game?.render.heroModels === 1, undefined, { timeout: 10_000 });
    expect(await page.evaluate(() => window.__game?.render.heroModels), `${hero} models`).toBe(1);
  }
  // a restart puts a fresh model in place of the old one
  await page.locator("#start").click();
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => window.__game?.render.heroModels)).toBe(1);
});

test.describe("a missing hero model", () => {
  test.use({ allowedConsoleErrors: [/mistwarden\.glb/] });

  test("shows an error", async ({ page }) => {
    await page.route("**/models/heroes/mistwarden.glb", (route) => route.abort());
    await page.goto("/?seed=1&hero=mistwarden&lang=en");
    const error = page.locator("#error");
    await expect(error).toBeVisible({ timeout: 90_000 });
    await expect(error).toContainText("Something went wrong");
    expect((await error.textContent())?.length ?? 0).toBeGreaterThan(0);
    // no run without a hero
    await expect(page.locator("#start")).toBeDisabled();
  });
});

test("the menu lists eight heroes and starts each of the new ones", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  for (const hero of ["mistwarden", "sparkshot", "redcleaver", "tidecaller"]) {
    await page.goto(`/?hero=${hero}&seed=1&speed=4&duration=20&lang=en`);
    await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
    await expect(page.locator("button.hero-button")).toHaveCount(8);
    await expect(page.locator(`button.hero-button[data-hero="${hero}"]`)).toHaveAttribute("aria-pressed", "true");
    await page.locator("#start").click();
    await waitForScreen(page, "playing");
    expect(await page.evaluate(() => window.__game?.hero)).toBe(hero);
    const deadline = Date.now() + 60_000;
    let screen = await page.evaluate(() => window.__game?.screen);
    while (screen !== "won" && screen !== "lost" && Date.now() < deadline) {
      if (screen === "levelUp") await page.locator("button.card").first().click();
      await page.waitForTimeout(200);
      screen = await page.evaluate(() => window.__game?.screen);
    }
    expect(["won", "lost"], `${hero} ended`).toContain(screen);
  }
});

test("every hero plays without errors", async ({ page }, testInfo) => {
  test.setTimeout(10 * 60_000);
  for (const hero of heroIds) {
    await page.goto(`/?seed=1&hero=${hero}&debug=1&speed=8&duration=20&lang=en`);
    await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
    await page.locator("#start").click();
    await waitForScreen(page, "playing");
    expect(await page.evaluate(() => window.__game?.hero)).toBe(hero);
    await page.evaluate(() => {
      for (let slot = 0; slot < 4; slot++) window.__game!.debug!.setAbilityLevel(slot, 1);
    });
    // mid-run: enemies are on screen and abilities have fired
    await page.waitForFunction(
      () => {
        const g = window.__game;
        return g !== undefined && (g.screen !== "playing" || (g.tick > 240 && g.enemies > 0));
      },
      undefined,
      { timeout: 60_000, polling: 100 },
    );
    // no screenshot of the level-up overlay: pick a card first
    while ((await page.evaluate(() => window.__game?.screen)) === "levelUp") {
      await page.locator("button.card").first().click();
      await page.waitForTimeout(100);
    }
    await testInfo.attach(`hero-${hero}-${testInfo.project.name}`, {
      body: await page.screenshot({ type: "png" }),
      contentType: "image/png",
    });
    // a level-up pauses the run; pick a card until the run ends (within 60 s)
    const deadline = Date.now() + 60_000;
    let screen = await page.evaluate(() => window.__game?.screen);
    while (screen !== "won" && screen !== "lost" && Date.now() < deadline) {
      if (screen === "levelUp") await page.locator("button.card").first().click();
      await page.waitForTimeout(250);
      screen = await page.evaluate(() => window.__game?.screen);
    }
    expect(["won", "lost"], `${hero} ended`).toContain(screen);
  }
});

test("every enemy type renders without errors", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&debug=1&speed=2&duration=60&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  // behind the menu the run is paused, so nobody dies before the count is read
  await page.evaluate(() => window.__game!.debug!.spawnEach());
  await page.waitForFunction((n) => (window.__game?.enemyTypes ?? 0) >= n, enemyIds.length, {
    timeout: 3_000,
    polling: 50,
  });
  await page.locator("#start").click();
  await waitForScreen(page, "playing");
  // the row walks to the hero: shooters fire and die next to it, the chaplain heals
  await page.waitForTimeout(1_500);
  while ((await page.evaluate(() => window.__game?.screen)) === "levelUp") {
    await page.locator("button.card").first().click();
    await page.waitForTimeout(100);
  }
  await testInfo.attach(`enemy-types-${testInfo.project.name}`, {
    body: await page.screenshot({ type: "png" }),
    contentType: "image/png",
  });
  await page.waitForTimeout(2_000);
  expect(["playing", "levelUp", "won", "lost"]).toContain(await page.evaluate(() => window.__game?.screen));
});

test("pack arrows point at a new pack", async ({ page }) => {
  await page.goto("/?seed=1&speed=2&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  expect(await page.evaluate(() => window.__game?.packArrows)).toBe(0);
  await page.locator("#start").click();
  await page.waitForFunction(() => (window.__game?.packArrows ?? 0) >= 1, undefined, { timeout: 5_000, polling: 50 });
  await expect(page.locator(".pack-arrow:not([hidden])").first()).toBeVisible();
});

test("a lancer charge renders without errors", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&debug=1&duration=60&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await page.evaluate(() => window.__game!.debug!.spawnEach());
  await page.locator("#start").click();
  await page.waitForFunction(() => (window.__game?.charging ?? 0) >= 1, undefined, { timeout: 6_000, polling: 30 });
  await testInfo.attach(`lancer-charge-${testInfo.project.name}`, {
    body: await page.screenshot({ type: "png" }),
    contentType: "image/png",
  });
  await page.waitForTimeout(1_500);
  expect(["playing", "levelUp", "won", "lost"]).toContain(await page.evaluate(() => window.__game?.screen));
});

test("R casts the ultimate and T switches auto", async ({ page }) => {
  await page.goto("/?seed=1&hero=stonehorn&debug=1&lang=en");
  await page.locator("#start").click();
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => window.__game?.ultimateAuto)).toBe(true);

  // auto off first, then learn the ultimate: nothing can cast it before R
  await page.keyboard.press("t");
  await page.waitForFunction(() => window.__game?.ultimateAuto === false, undefined, { timeout: 10_000 });
  await page.evaluate(() => window.__game!.debug!.setAbilityLevel(3, 1));
  expect(await page.evaluate(() => window.__game?.abilityCooldowns[3])).toBe(0);

  await page.keyboard.press("r");
  await page.waitForFunction(() => (window.__game?.abilityCooldowns[3] ?? 0) > 0, undefined, { timeout: 10_000 });
});

test("Space dashes", async ({ page }) => {
  await page.goto("/?seed=1&lang=en");
  await page.locator("#start").click(); // the Start button hides; keyboard focus then falls back to the page, so Space reaches the game
  await waitForScreen(page, "playing");
  await page.waitForFunction(() => (window.__game?.tick ?? 0) > 5, undefined, { timeout: 30_000 });
  const before = await page.evaluate(() => ({ x: window.__game!.heroX, y: window.__game!.heroY }));
  await page.keyboard.press("Space");
  await page.waitForFunction(
    (b) => Math.hypot(window.__game!.heroX - b.x, window.__game!.heroY - b.y) >= 300,
    before,
    { timeout: 10_000, polling: 50 },
  );
});
