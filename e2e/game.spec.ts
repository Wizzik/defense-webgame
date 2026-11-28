import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import type { GameSnapshot } from "../client/game/debug";
import { expect, startRun, test } from "./fixtures";
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

const enemies = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "data", "generated", "enemies.json"), "utf8"),
) as { id: string; boss?: true }[];
const worlds = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "data", "generated", "worlds.json"), "utf8"),
) as { bosses?: Record<string, unknown> }[];
/** Common enemy ids from the generated data, so adding a type extends the test. Bosses come by the timeline. */
const enemyIds = enemies.filter((e) => !e.boss).map((e) => e.id);

/** Hero ids from the generated data, so adding a hero extends the test. */
const heroIds = (
  JSON.parse(readFileSync(join(import.meta.dirname, "..", "data", "generated", "heroes.json"), "utf8")) as { id: string }[]
).map((h) => h.id);
/** The item catalogue, for names and rarities of chest cards. */
const ITEMS = JSON.parse(readFileSync(join(import.meta.dirname, "..", "data", "generated", "items.json"), "utf8")) as {
  id: string; rarity: string; slotType: string; name: { en: string; cs: string };
}[];
/** Gear slot ids (sim/gear.ts SLOT_IDS) with their item types. */
const SLOTS: [string, string][] = [
  ["head", "head"], ["neck", "neck"], ["shoulders", "shoulders"], ["back", "back"], ["chest", "chest"], ["wrist", "wrist"],
  ["hands", "hands"], ["waist", "waist"], ["legs", "legs"], ["feet", "feet"], ["ring1", "ring"], ["ring2", "ring"],
  ["trinket1", "trinket"], ["trinket2", "trinket"], ["mainHand", "mainHand"], ["offHand", "offHand"],
];

type Screen = GameSnapshot["screen"];

async function waitForScreen(page: Page, screen: Screen, timeout = 90_000): Promise<void> {
  await page.waitForFunction((s) => window.__game?.screen === s, screen, { timeout, polling: 250 });
}

/**
 * Picks the first level-up card. `window.__game.screen` can lag a slow frame behind the DOM, so the
 * card may already be gone when the click starts: a bounded wait lets the caller's loop read again.
 */
async function pickCard(page: Page): Promise<void> {
  await page
    .locator("button.card")
    .first()
    .click({ timeout: 10_000 })
    .catch(() => undefined);
  // a chest Choice card opens the compare: take the new item (a click in the first 300 ms is ignored, so retry)
  for (let i = 0; i < 10 && (await page.locator("#chest-compare").isVisible()); i++) {
    await page.locator("button.compare-take-button").click({ timeout: 2_000 }).catch(() => undefined);
    await page.waitForTimeout(150);
  }
}

/** Wears the first common item of each type in all 16 gear slots of the run (chest items at level 1). */
/** Wears the first named item of `rarity` in every slot (named items are legendary or mythic since 2026-11-28). */
async function wearNamed(page: Page, rarity = "legendary"): Promise<void> {
  const pairs = SLOTS.map(([slot, type]) => [slot, ITEMS.find((item) => item.slotType === type && item.rarity === rarity)!.id]);
  await page.evaluate((list) => {
    for (const [slot, item] of list) window.__game!.debug!.wear(slot!, item!);
  }, pairs);
}

/**
 * Waits for `screen` and picks the first card of every level-up offer on the way: XP the hero collected can open
 * an offer right before or after a chest (slow software rendering leaves more time for it).
 */
async function waitForScreenPickingLevelUps(page: Page, screen: Screen, timeout = 90_000): Promise<void> {
  const deadline = Date.now() + timeout;
  for (;;) {
    await page.waitForFunction(
      (s) => window.__game?.screen === s || window.__game?.screen === "levelUp",
      screen,
      { timeout: Math.max(1, deadline - Date.now()), polling: 250 },
    );
    if ((await page.evaluate(() => window.__game?.screen)) === screen) return;
    await pickCard(page);
  }
}

/**
 * Plays a debug run to its end: picks cards, and kills the final boss once it has come (the run is won only
 * when it falls). Needs `debug=1`. Returns the last screen it saw.
 */
async function playToEnd(page: Page, timeoutMs = 60_000, pollMs = 250): Promise<Screen | undefined> {
  const deadline = Date.now() + timeoutMs;
  let screen = await page.evaluate(() => window.__game?.screen);
  while (screen !== "won" && screen !== "lost" && Date.now() < deadline) {
    if (screen === "levelUp" || screen === "chest") await pickCard(page);
    else {
      await page.evaluate(() => {
        const g = window.__game!;
        if (g.phase === 21 && g.boss !== null) g.debug!.killBoss();
      });
    }
    await page.waitForTimeout(pollMs);
    screen = await page.evaluate(() => window.__game?.screen);
  }
  return screen;
}

test("menu starts a run on the available backend", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&lang=en");
  const start = page.locator("#start");
  await expect(start).toHaveText("Start", { timeout: 90_000 });
  await startRun(page);
  await page.waitForFunction(() => (window.__game?.frames ?? 0) > 30, undefined, {
    timeout: 90_000,
    polling: 250,
  });

  const expected = testInfo.project.name === "webgpu-swiftshader" ? "WebGPU" : "WebGL2";
  expect(await page.evaluate(() => window.__game?.backend)).toBe(expected);
  expect(await page.evaluate(() => window.__game?.screen)).toBe("playing");
  // one mesh per enemy type and one per boss look of a world
  const bossLooks = worlds.reduce((sum, world) => sum + Object.keys(world.bosses ?? {}).length, 0);
  expect(await page.evaluate(() => window.__game?.render.enemyMeshes)).toBe(enemies.length + bossLooks);

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

test("the shadow map is on unless ?shadows=0 or the GPU is software, and the game draws either way", async ({ page }) => {
  await page.goto("/?seed=1&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  const { shadows, software } = await page.evaluate(() => ({
    shadows: window.__game!.render.shadows,
    software: window.__game!.gpu.software,
  }));
  expect(shadows).toBe(!software);
  await startRun(page);
  await waitForScreen(page, "playing");
  await page.waitForFunction(() => (window.__game?.frames ?? 0) > 30, undefined, { timeout: 90_000, polling: 250 });

  await page.goto("/?seed=1&lang=en&shadows=0");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  expect(await page.evaluate(() => window.__game!.render.shadows)).toBe(false);
  await startRun(page);
  await waitForScreen(page, "playing");
  await page.waitForFunction(() => (window.__game?.frames ?? 0) > 30, undefined, { timeout: 90_000, polling: 250 });
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
  await startRun(page);
  await waitForScreen(page, "playing");
});

test("level-up shows three cards and a pick resumes the run", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&debug=1&lang=cs");
  await startRun(page);
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
  await page.goto("/?seed=1&duration=10&speed=8&debug=1&lang=en");
  await startRun(page);
  // the duration brings the final boss; the run is won when it falls (cards picked on the way: a level-up pauses)
  const bossBy = Date.now() + 90_000;
  while ((await page.evaluate(() => window.__game?.boss?.id)) !== "dread-regent" && Date.now() < bossBy) {
    if ((await page.evaluate(() => window.__game?.screen)) === "levelUp") await pickCard(page);
    await page.waitForTimeout(100);
  }
  expect(await page.evaluate(() => window.__game?.boss?.id)).toBe("dread-regent");
  expect(await page.evaluate(() => window.__game?.screen)).not.toBe("won");
  // fell it at once: the doubled packs can wear the hero down on slow software rendering
  await page.evaluate(() => window.__game!.debug!.killBoss());
  expect(await playToEnd(page)).toBe("won");

  await expect(page.getByText("You held the castle!")).toBeVisible();
  await expect(page.getByText(/^Final boss fell at \d+:\d\d$/)).toBeVisible();
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
  await expect(page.locator("button.hero-button")).toHaveCount(12);
  await page.locator("button.hero-button", { hasText: "Nightglaive" }).click();
  await testInfo.attach(`menu-hero-${testInfo.project.name}`, {
    body: await page.screenshot({ type: "png" }),
    contentType: "image/png",
  });
  await startRun(page);
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
  await startRun(page);
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

test("the menu lists twelve heroes and starts each of the new ones", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  for (const hero of ["razorwind", "dawnhammer", "frostweaver", "deadeye"]) {
    await page.goto(`/?hero=${hero}&seed=1&speed=4&duration=20&debug=1&lang=en`);
    await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
    await expect(page.locator("button.hero-button")).toHaveCount(12);
    await expect(page.locator(`button.hero-button[data-hero="${hero}"]`)).toHaveAttribute("aria-pressed", "true");
    await startRun(page);
    await waitForScreen(page, "playing");
    expect(await page.evaluate(() => window.__game?.hero)).toBe(hero);
    const screen = await playToEnd(page, 60_000, 200);
    expect(["won", "lost"], `${hero} ended`).toContain(screen);
  }
});

test("every hero plays without errors", async ({ page }, testInfo) => {
  test.setTimeout(10 * 60_000);
  for (const hero of heroIds) {
    await page.goto(`/?seed=1&hero=${hero}&debug=1&speed=8&duration=20&lang=en`);
    await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
    await startRun(page);
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
      await pickCard(page);
      await page.waitForTimeout(100);
    }
    await testInfo.attach(`hero-${hero}-${testInfo.project.name}`, {
      body: await page.screenshot({ type: "png" }),
      contentType: "image/png",
    });
    // a level-up pauses the run and the final boss ends it: play until the run ends (within 60 s)
    const screen = await playToEnd(page);
    expect(["won", "lost"], `${hero} ended`).toContain(screen);
  }
});

test("every enemy type renders without errors", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&debug=1&speed=2&duration=60&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  // behind the menu the run is paused, so nobody dies before the count is read; every faction's row (no risen)
  await page.evaluate(() => {
    for (const id of ["human", "orc", "undead", "elf"]) window.__game!.debug!.spawnFaction(id);
  });
  // the snapshot is written per drawn frame; the first frame with every type compiles their meshes, which on a slow
  // software renderer (CI) can take more than 3 s
  await page.waitForFunction((n) => (window.__game?.enemyTypes ?? 0) >= n, enemyIds.length - 1, {
    timeout: 15_000,
    polling: 50,
  });
  await startRun(page);
  await waitForScreen(page, "playing");
  // the row walks to the hero: shooters fire and die next to it, the chaplain heals
  await page.waitForTimeout(1_500);
  while ((await page.evaluate(() => window.__game?.screen)) === "levelUp") {
    await pickCard(page);
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
  await startRun(page);
  await page.waitForFunction(() => (window.__game?.packArrows ?? 0) >= 1, undefined, { timeout: 5_000, polling: 50 });
  await expect(page.locator(".pack-arrow:not([hidden])").first()).toBeVisible();
});

test("a lancer charge renders without errors", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&debug=1&duration=60&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await page.evaluate(() => window.__game!.debug!.spawnEach());
  await startRun(page);
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
  await startRun(page);
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

test("a new run has ten slots; a shared spell and a passive learned by debug show in the HUD and the spell casts", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&hero=stonehorn&debug=1&lang=en");
  await startRun(page);
  await waitForScreen(page, "playing");
  const ids = await page.evaluate(() => window.__game!.abilityIds.slice());
  expect(ids).toHaveLength(10);
  expect(ids.slice(4)).toEqual(["", "", "", "", "", ""]);
  expect(await page.evaluate(() => window.__game!.abilityLevels.slice(4))).toEqual([0, 0, 0, 0, 0, 0]);
  await expect(page.locator('.cell[data-slot="4"]')).toContainText("Empty slot");
  await expect(page.locator(".passive-cell.empty")).toHaveCount(4);

  await page.evaluate(() => {
    window.__game!.debug!.learn(4, "arc-lightning");
    window.__game!.debug!.learn(6, "might");
    window.__game!.debug!.spawnEach();
  });
  await page.waitForFunction(() => window.__game?.abilityIds[4] === "arc-lightning" && window.__game?.abilityIds[6] === "might");
  await expect(page.locator('.cell[data-slot="4"]')).toContainText("Arc Lightning");
  await expect(page.locator('.passive-cell[data-slot="6"]:not(.empty) svg')).toHaveCount(1);
  await expect(page.locator(".passive-cell.empty")).toHaveCount(3);
  // the spell casts on its own once an enemy comes in range
  await page.waitForFunction(() => (window.__game?.abilityCooldowns[4] ?? 0) > 0, undefined, { timeout: 15_000, polling: 50 });
  await testInfo.attach(`shared-spells-${testInfo.project.name}`, {
    body: await page.screenshot({ type: "png" }),
    contentType: "image/png",
  });
  // the rules refuse a passive in a spell slot
  const error = await page.evaluate(() => {
    try {
      window.__game!.debug!.learn(5, "haste");
      return "";
    } catch (e) {
      return (e as Error).message;
    }
  });
  expect(error).toContain("cannot hold");
});

test("Space dashes", async ({ page }) => {
  await page.goto("/?seed=1&lang=en");
  await startRun(page); // the Start button hides; keyboard focus then falls back to the page, so Space reaches the game
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

test("a miniboss shows its bar and name", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&debug=1&phase=6&speed=4&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  // the run behind the menu already stands at the start of the phase
  await page.waitForFunction(() => window.__game?.phase === 6, undefined, { timeout: 30_000 });
  await startRun(page);
  await page.waitForFunction(() => window.__game?.boss?.id === "iron-marshal", undefined, { timeout: 30_000, polling: 50 });
  const bar = page.locator("#boss-bar");
  await expect(bar).toBeVisible();
  await expect(bar.locator(".boss-name")).toHaveText("Iron Marshal");
  await expect(page.locator(".hud-phase")).toHaveText("Phase 6/20");
  const boss = await page.evaluate(() => window.__game!.boss!);
  expect(boss.hp).toBeGreaterThan(0);
  expect(boss.hp).toBeLessThanOrEqual(boss.maxHp);
  await testInfo.attach(`miniboss-${testInfo.project.name}`, { body: await page.screenshot({ type: "png" }), contentType: "image/png" });
});

test("a run from phase 6 meets the Blood Clan: its news follows the boss's, spawnFaction refuses an unknown id", async ({ page }) => {
  await page.goto("/?seed=1&debug=1&phase=6&speed=2&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await page.waitForFunction(() => window.__game?.phase === 6, undefined, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__game!.faction)).toBe("orc");
  const unknown = await page.evaluate(() => {
    try {
      window.__game!.debug!.spawnFaction("dwarf");
      return "";
    } catch (e) {
      return (e as Error).message;
    }
  });
  expect(unknown).toContain("unknown faction");
  await page.evaluate(() => {
    for (let slot = 0; slot < 4; slot++) window.__game!.debug!.setAbilityLevel(slot, 10);
  });
  await startRun(page);
  const announce = page.locator("#announce");
  const deadline = Date.now() + 60_000;
  const seen: string[] = [];
  while (Date.now() < deadline && !seen.includes("The Blood Clan approaches!")) {
    if ((await page.evaluate(() => window.__game?.screen)) === "levelUp") await pickCard(page);
    const text = (await announce.isVisible()) ? await announce.textContent() : "";
    if (text && seen[seen.length - 1] !== text) seen.push(text);
    await page.waitForTimeout(50);
  }
  expect(seen).toEqual(["Iron Marshal has arrived", "The Blood Clan approaches!"]);
  await page.evaluate(() => window.__game!.debug!.spawnEach());
  await page.waitForFunction(() => (window.__game?.enemyTypes ?? 0) >= 4, undefined, { timeout: 5_000, polling: 50 });
});

test("an elite rush is announced", async ({ page }) => {
  // phase 4 starts at 2:30; the rush of 3:00 is announced 7 s ahead
  await page.goto("/?seed=1&debug=1&phase=4&duration=1200&speed=8&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await page.waitForFunction(() => window.__game?.phase === 4, undefined, { timeout: 30_000 });
  // a full kit, so the hero lives to see the rush whatever XP the phase start gives
  await page.evaluate(() => {
    for (let slot = 0; slot < 4; slot++) window.__game!.debug!.setAbilityLevel(slot, 10);
  });
  await startRun(page);
  // an idle hero outside the castle's defence circle (rules.enemies.heroDefendRange): the packs go for the castle
  await page.evaluate(() => window.__game!.debug!.teleport(0, 1500));
  const announce = page.locator("#announce");
  const deadline = Date.now() + 90_000;
  let seen = false;
  while (!seen && Date.now() < deadline) {
    const screen = await page.evaluate(() => window.__game?.screen);
    expect(screen, "the run ended before the rush was announced").not.toBe("lost");
    if (screen === "levelUp") await pickCard(page);
    seen = (await announce.textContent()) === "An elite rush is coming" && (await announce.isVisible());
    if (!seen) await page.waitForTimeout(50);
  }
  expect(seen).toBe(true);
  // within 30 s of game time from the start of the phase
  expect(await page.evaluate(() => window.__game!.tick)).toBeLessThanOrEqual((150 + 30) * 30);
});

test("the finale shows the final boss and ends with a win", async ({ page }) => {
  await page.goto("/?seed=1&debug=1&phase=21&lang=cs");
  await expect(page.locator("#start")).toHaveText("Hrát", { timeout: 90_000 });
  await page.waitForFunction(() => window.__game?.phase === 21, undefined, { timeout: 30_000 });
  await startRun(page);
  await page.waitForFunction(() => window.__game?.boss?.id === "dread-regent", undefined, { timeout: 30_000, polling: 50 });
  await expect(page.locator(".hud-phase")).toHaveText("Finále");
  await expect(page.locator("#boss-bar .boss-name")).toHaveText("Hrůzný regent");
  await page.evaluate(() => window.__game!.debug!.killBoss());
  await waitForScreen(page, "won", 30_000);
  await expect(page.getByText(/^Finální boss padl v 16:4\d$/)).toBeVisible();
});

test("phase without debug starts a normal run", async ({ page }) => {
  for (const query of ["phase=21", "debug=1&phase=22", "debug=1&phase=abc"]) {
    await page.goto(`/?seed=1&lang=en&${query}`);
    await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
    await page.waitForFunction(() => window.__game?.hero !== "", undefined, { timeout: 30_000 });
    expect(await page.evaluate(() => window.__game?.tick), query).toBe(0);
    expect(await page.evaluate(() => window.__game?.phase), query).toBe(1);
    await startRun(page);
    await waitForScreen(page, "playing");
    await page.waitForFunction(() => (window.__game?.tick ?? 0) > 10, undefined, { timeout: 30_000 });
    expect(await page.evaluate(() => window.__game?.boss), query).toBeNull();
    expect(await page.evaluate(() => window.__game?.tick), query).toBeLessThan(600);
  }
});

test("a restart clears the boss bar", async ({ page }) => {
  await page.goto("/?seed=1&debug=1&phase=21&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await startRun(page);
  await page.waitForFunction(() => window.__game?.boss !== null, undefined, { timeout: 30_000, polling: 50 });
  await expect(page.locator("#boss-bar")).toBeVisible();
  await expect(page.locator("#announce")).toHaveText("Dread Regent has arrived");
  await page.evaluate(() => window.__game!.debug!.killBoss());
  await waitForScreen(page, "won", 30_000);
  await page.locator("#again").click();
  await waitForScreen(page, "menu", 10_000);
  // the new run waits behind the menu: its boss has not come yet
  await page.waitForFunction(() => window.__game?.boss === null, undefined, { timeout: 30_000 });
  await expect(page.locator("#boss-bar")).toBeHidden();
  await expect(page.locator("#announce")).toBeHidden();
  // and the new run brings its own boss and news
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await startRun(page);
  await page.waitForFunction(() => window.__game?.boss !== null, undefined, { timeout: 30_000, polling: 50 });
  await expect(page.locator("#boss-bar")).toBeVisible();
});

test("a slam shows a ring and hides it after the hit", async ({ page }, testInfo) => {
  // the Mistwarden: Stonehorn, standing next to the boss, killed it in about 8 s, before or right at its first slam (7 s)
  await page.goto("/?seed=1&debug=1&phase=6&speed=4&lang=en&hero=mistwarden");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await page.waitForFunction(() => window.__game?.phase === 6, undefined, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__game!.render.slamRings)).toBe(0);
  // legendary gear in every slot: the Blood Clan's lusted warlord and the doubled packs kill a lightly geared
  // Mistwarden before the ring of the first slam is gone
  await wearNamed(page);
  await startRun(page);
  await page.waitForFunction(() => window.__game?.boss?.id === "iron-marshal", undefined, { timeout: 30_000, polling: 50 });
  // stay next to the boss until its slam is ready (7 s after it came) and it winds up
  const deadline = Date.now() + 60_000;
  let rings = 0;
  while (rings === 0 && Date.now() < deadline) {
    rings = await page.evaluate(() => {
      const g = window.__game!;
      if (g.screen === "playing" && g.boss && g.slams === 0) g.debug!.teleport(g.boss.x - 150, g.boss.y);
      return g.render.slamRings;
    });
    if ((await page.evaluate(() => window.__game?.screen)) === "levelUp") await pickCard(page);
    if (rings === 0) await page.waitForTimeout(30);
  }
  expect(rings).toBe(1);
  expect(await page.evaluate(() => window.__game!.slams)).toBeLessThanOrEqual(1);
  await testInfo.attach(`slam-${testInfo.project.name}`, { body: await page.screenshot({ type: "png" }), contentType: "image/png" });
  // step away from the boss and its pack, so the hero lives through the windup (a lost run freezes the ring)
  await page.evaluate(() => {
    const g = window.__game!;
    if (g.boss) g.debug!.teleport(g.boss.x - 1500, g.boss.y);
  });
  // the windup is 1 s and the flash 0.2 s of game time; a level-up card would freeze both
  const gone = Date.now() + 30_000;
  while ((await page.evaluate(() => window.__game!.render.slamRings)) !== 0 && Date.now() < gone) {
    if ((await page.evaluate(() => window.__game?.screen)) === "levelUp") await pickCard(page);
    await page.waitForTimeout(50);
  }
  expect(await page.evaluate(() => window.__game!.render.slamRings)).toBe(0);
});

test("a chest takes gold and offers three rolled items; the pick lands in the gear", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&debug=1&lang=cs");
  await startRun(page);
  await waitForScreen(page, "playing");
  const before = await page.evaluate(() => {
    const g = window.__game!;
    return { chests: g.chests.length, price: g.chestPrice, gold: g.gold, worn: g.gear.filter((slot) => slot !== null).length };
  });
  expect(before).toEqual({ chests: 3, price: 100, gold: 0, worn: 0 });
  await expect(page.locator(".chest-label")).toHaveCount(3);

  await page.evaluate(() => {
    const g = window.__game!;
    g.debug!.grantGold(1000);
    g.debug!.teleport(g.chests[0]!.x, g.chests[0]!.y);
  });
  await waitForScreen(page, "chest");
  await expect(page.locator("button.card")).toHaveCount(3);
  await expect(page.locator(".cards-title")).toHaveText("Truhla: vyber si kořist");
  const cards = await page.evaluate(() => window.__game!.chestCards);
  expect(cards).toHaveLength(3);
  expect(cards!.every((card) => card.action === "new")).toBe(true);
  // a card offers a named item (its name in the catalogue) or a rolled one (a name of its own)
  const first = cards![0]!;
  if (!first.rolled) expect(ITEMS.find((item) => item.id === first.item)!.rarity).toBe(first.rarity);
  await expect(page.locator("button.card").first().locator(".card-name")).toHaveText(first.name.cs);
  await expect(page.locator("button.card").first()).toHaveClass(new RegExp(`rarity-${first.rarity}`));
  // every card shows its item's picture (its base's for a rolled item), and the picture loads
  await expect(page.locator("button.card .chest-glyph .item-icon")).toHaveCount(3);
  const iconUrl = await page.locator("button.card .chest-glyph .item-icon").first().evaluate((node) =>
    new URL(/url\(['"]?([^'")]+)['"]?\)/.exec(getComputedStyle(node).getPropertyValue("--icon"))![1]!, location.href).href);
  expect((await page.request.get(iconUrl)).headers()["content-type"]).toContain("svg");
  await expect(page.locator("#hud-gold")).toContainText("900");
  await testInfo.attach(`chest-${testInfo.project.name}`, {
    body: await page.screenshot({ type: "png" }),
    contentType: "image/png",
  });

  await page.locator("button.card").first().click();
  await waitForScreen(page, "playing");
  const after = await page.evaluate(() => {
    const g = window.__game!;
    return { opened: g.chestsOpened, gold: g.gold, price: g.chestPrice, worn: g.gear.filter((slot) => slot !== null) };
  });
  expect(after.opened).toBe(1);
  expect(after.gold).toBeLessThan(1000);
  expect(after.price).toBe(112);
  expect(after.worn).toHaveLength(1);
  expect(after.worn[0]).toMatchObject({ item: cards![0]!.item, base: 0, temp: 1 });
  expect(await page.evaluate(() => window.__game!.chestCards)).toBeNull();
});

test("a chest card for a worn slot opens the compare; Esc goes back, 1 keeps, the take button takes", async ({ page }) => {
  await page.goto("/?seed=1&debug=1&lang=cs");
  await startRun(page);
  await waitForScreen(page, "playing");
  // random common items everywhere (no named item is common since 2026-11-28): most chest cards are a Choice
  await page.evaluate((slots) => {
    for (const [slot] of slots) window.__game!.debug!.wearRolled(slot!, "common");
  }, SLOTS);
  await page.evaluate(() => {
    const g = window.__game!;
    g.debug!.grantGold(1000);
    g.debug!.teleport(g.chests[0]!.x, g.chests[0]!.y);
  });
  await waitForScreenPickingLevelUps(page, "chest");
  const cards = (await page.evaluate(() => window.__game!.chestCards))!;
  const index = cards.findIndex((card) => card.action === "choice");
  expect(index).toBeGreaterThanOrEqual(0);
  const slot = SLOTS.findIndex(([id]) => id === cards[index]!.slot);
  const worn = (await page.evaluate((s) => window.__game!.gear[s], slot))!;
  expect(worn.temp).toBe(1);

  await page.waitForTimeout(350);
  await page.locator("button.card").nth(index).click();
  await expect(page.locator("#chest-compare")).toBeVisible();
  await expect(page.locator("#chest-compare .compare-col")).toHaveCount(2);
  // the worn item is a random one: its two-word name is its own
  expect(worn.rolled).toBe(true);
  await expect(page.locator(".compare-keep .card-name")).not.toHaveText("");
  await expect(page.locator(".compare-take .card-name")).toHaveText(cards[index]!.name.cs);
  await expect(page.locator("button.card").first()).toBeHidden();
  expect(await page.evaluate(() => window.__game!.chestCompare)).toBe(index);
  const tick = await page.evaluate(() => window.__game!.tick);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__game!.tick)).toBe(tick);

  await page.keyboard.press("Escape");
  await expect(page.locator("#chest-compare")).toBeHidden();
  await expect(page.locator("button.card")).toHaveCount(3);
  await expect(page.locator("button.card").first()).toBeVisible();
  expect(await page.evaluate(() => [window.__game!.chestCompare, window.__game!.screen])).toEqual([null, "chest"]);

  // click and read in one synchronous step, so no frame runs in between: the snapshot must not lag the DOM
  await page.waitForTimeout(350);
  expect(await page.evaluate((i) => {
    (document.querySelectorAll("button.card")[i] as HTMLElement).click();
    return window.__game!.chestCompare;
  }, index)).toBe(index);
  await expect(page.locator("#chest-compare")).toBeVisible();
  await page.waitForTimeout(400);
  await page.keyboard.press("Digit1");
  await waitForScreenPickingLevelUps(page, "playing");
  expect(await page.evaluate((s) => window.__game!.gear[s], slot)).toMatchObject({ item: worn.item, base: 0, temp: 2 });

  // the second chest: take the new item with the button
  await page.evaluate(() => {
    const g = window.__game!;
    g.debug!.teleport(g.chests[1]!.x, g.chests[1]!.y);
  });
  await waitForScreenPickingLevelUps(page, "chest");
  const next = (await page.evaluate(() => window.__game!.chestCards))!;
  const take = next.findIndex((card) => card.action === "choice");
  expect(take).toBeGreaterThanOrEqual(0);
  const takeSlot = SLOTS.findIndex(([id]) => id === next[take]!.slot);
  await page.waitForTimeout(350);
  await page.locator("button.card").nth(take).click();
  await expect(page.locator("#chest-compare")).toBeVisible();
  await page.waitForTimeout(400);
  await page.locator("button.compare-take-button").click();
  await waitForScreenPickingLevelUps(page, "playing");
  expect(await page.evaluate((s) => window.__game!.gear[s], takeSlot)).toMatchObject({ item: next[take]!.item, base: 0 });
});

test("C opens the gear panel and pauses the run; C closes it; C does nothing under the cards", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&debug=1&lang=cs");
  await startRun(page);
  await waitForScreen(page, "playing");
  await expect(page.locator("#gear-panel")).toBeHidden();

  // a chest pick first, so the doll has something to show
  await page.evaluate(() => {
    const g = window.__game!;
    g.debug!.grantGold(1000);
    g.debug!.teleport(g.chests[0]!.x, g.chests[0]!.y);
  });
  await waitForScreenPickingLevelUps(page, "chest");
  await page.keyboard.press("KeyC");
  await expect(page.locator("#gear-panel")).toBeHidden();
  // a click in the first 300 ms after the cards appear is ignored (cards.ts PICK_DELAY_MS), and on slow software
  // WebGPU this step comes sooner than that: click until the chest closes. One click may take seconds on a slow CI
  // runner's software rendering, so it gets 5 s.
  await expect(async () => {
    if ((await page.evaluate(() => window.__game?.screen)) === "chest") await page.locator("button.card").first().click({ timeout: 5_000 });
    expect(await page.evaluate(() => window.__game?.screen)).not.toBe("chest");
  }).toPass({ timeout: 30_000, intervals: [400] });
  await waitForScreenPickingLevelUps(page, "playing");

  await page.keyboard.press("KeyC");
  await expect(page.locator("#gear-panel")).toBeVisible();
  await expect(page.locator("#gear-panel .doll-slot")).toHaveCount(16);
  await expect(page.locator("#gear-panel .doll-slot:not(.empty)")).toHaveCount(1);
  await expect(page.locator("#gear-panel .gear-title")).toHaveText("Výbava");
  const tick = await page.evaluate(() => window.__game!.tick);
  await page.locator("#gear-panel .doll-slot:not(.empty)").hover();
  await expect(page.locator("#gear-panel .item-tooltip")).toContainText("jen na tento běh");
  await testInfo.attach(`gear-panel-${testInfo.project.name}`, {
    body: await page.screenshot({ type: "png" }),
    contentType: "image/png",
  });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__game!.tick)).toBe(tick);

  await page.keyboard.press("KeyC");
  await expect(page.locator("#gear-panel")).toBeHidden();
  await page.waitForFunction((t) => window.__game!.tick > t, tick);
});

test("a boss that falls drops an item into the collection and the end screen lists it", async ({ page }) => {
  await page.goto("/?seed=1&debug=1&phase=6&lang=cs");
  await startRun(page);
  await waitForScreen(page, "playing");
  await expect(page.locator("#save-warning")).toBeHidden();
  expect(await page.evaluate(() => ({
    collection: window.__game!.collection, size: window.__game!.collectionSize, saved: window.__game!.gearSaved,
  }))).toEqual({ collection: {}, size: 0, saved: false });
  await page.waitForFunction(() => window.__game!.boss !== null);
  await page.evaluate(() => window.__game!.debug!.killBoss());
  await expect(page.locator("#announce")).toContainText("Kořist:");
  await expect(page.locator("#announce")).toHaveClass(/loot rarity-(common|rare)/);
  // the snapshot follows the collection once a frame; a common or rare drop is a random item, not a named one
  await page.waitForFunction(() => window.__game!.collectionSize === 1);
  await expect.poll(() => page.evaluate(() => window.__game!.collection)).toEqual({});

  // the item is kept when the run is lost, and the end screen names it
  await page.evaluate(() => window.__game!.debug!.grantItem("oaken-shield", 9));
  expect(await page.evaluate(() => window.__game!.collection["oaken-shield"])).toBe(5);
  await page.goto("/?seed=1&debug=1&phase=21&lang=cs");
  await startRun(page);
  await waitForScreen(page, "playing");
  await page.waitForFunction(() => window.__game!.boss !== null);
  await page.evaluate(() => window.__game!.debug!.killBoss());
  await waitForScreen(page, "won");
  await expect(page.locator("#end .end-drops-title")).toHaveText("Kořist z tohoto běhu");
  await expect(page.locator("#end .end-drop")).toHaveCount(1);
});

test("the collection is stored in the browser and read again after a reload", async ({ page }) => {
  await page.goto("/?seed=1");
  await page.waitForFunction(() => window.__game?.screen === "menu");
  expect(await page.evaluate(() => window.__game!.gearSaved)).toBe(true);
  await expect(page.locator("#save-warning")).toBeHidden();
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open("defense-webgame", 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const save = { version: 1, items: { "oaken-shield": 3, "no-such-item": 2 }, loadouts: { stonehorn: { offHand: "oaken-shield" } } };
      const put = open.result.transaction("save", "readwrite").objectStore("save").put(save, "gear");
      put.onerror = () => reject(put.error);
      put.onsuccess = () => resolve();
    };
  }));
  await page.reload();
  await page.waitForFunction(() => window.__game?.screen === "menu");
  expect(await page.evaluate(() => window.__game!.collection)).toEqual({ "oaken-shield": 3 });
  // the paused run behind the menu already wears the stored doll
  await page.waitForFunction(() => window.__game!.gear.some((slot) => slot?.item === "oaken-shield" && slot.base === 3));
});

test("the gear screen equips an item for one hero; the run starts with it", async ({ page }, testInfo) => {
  await page.goto("/?seed=1&debug=1&lang=cs&hero=stonehorn");
  await page.waitForFunction(() => window.__game?.screen === "menu");
  await page.evaluate(() => {
    const debug = window.__game!.debug!;
    debug.grantItem("oaken-shield", 3);
    debug.grantItem("band-of-resolve", 1);
    debug.grantItem("moonlit-signet", 2);
  });
  await page.locator("#gear").click();
  await expect(page.locator("#gear-screen")).toBeVisible();
  await expect(page.locator("#gear-screen .gear-title")).toHaveText("Výbava");
  await expect(page.locator("#gear-screen .gear-grid .doll-slot")).toHaveCount(70);
  await expect(page.locator("#gear-screen .gear-grid .doll-slot:not(.missing)")).toHaveCount(3);
  await expect(page.locator("#gear-screen .gear-count")).toHaveText("Sbírka: 3 z 200");
  const hp = Number(await page.locator("#gear-screen .doll-total-value").nth(3).textContent());

  await page.locator('#gear-screen .gear-filter[data-filter="ring"]').click();
  await expect(page.locator("#gear-screen .gear-grid .doll-slot")).toHaveCount(5);
  await page.locator('#gear-screen .gear-filter[data-filter="all"]').click();

  await page.locator('#gear-screen .gear-grid [data-item="oaken-shield"]').click();
  await page.locator('#gear-screen .gear-grid [data-item="band-of-resolve"]').click();
  await page.locator('#gear-screen .gear-grid [data-item="moonlit-signet"]').click();
  await expect(page.locator("#gear-screen .gear-left .doll-slot:not(.empty)")).toHaveCount(3);
  await expect(page.locator("#gear-screen .gear-grid .doll-slot.equipped")).toHaveCount(3);
  // the shield and the ring carry strength, so the hero's hp grew
  expect(Number(await page.locator("#gear-screen .doll-total-value").nth(3).textContent())).toBeGreaterThan(hp);
  await page.locator('#gear-screen .gear-grid [data-item="helm-of-the-unbroken-line"]').hover();
  await expect(page.locator("#gear-screen .item-tooltip")).toContainText("nevlastníš");
  await expect(page.locator("#gear-screen .item-tooltip")).toContainText("Padá:");
  await testInfo.attach(`gear-screen-${testInfo.project.name}`, { body: await page.screenshot({ type: "png" }), contentType: "image/png" });

  // a click on a doll slot takes the item off
  await page.locator('#gear-screen .gear-left .doll-slot[data-slot="ring2"]').click();
  await expect(page.locator("#gear-screen .gear-left .doll-slot:not(.empty)")).toHaveCount(2);

  // a file that is not an export changes nothing; an export of this game comes back
  await page.locator("#gear-import-file").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{ not json") });
  await expect(page.locator("#gear-message")).toHaveText("Tento soubor není export výbavy. Nic se nezměnilo.");
  expect(Object.keys(await page.evaluate(() => window.__game!.collection))).toHaveLength(3);
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#gear-export").click()]);
  expect(download.suggestedFilename()).toBe("defense-webgame-gear.json");

  await page.locator("#gear-back").click();
  await expect(page.locator("#gear-screen")).toBeHidden();
  await startRun(page);
  await waitForScreen(page, "playing");
  const worn = await page.evaluate(() => window.__game!.gear.filter((slot) => slot !== null));
  expect(worn).toEqual([
    { item: "band-of-resolve", base: 1, temp: 0, rolled: false, rows: [] },
    { item: "oaken-shield", base: 3, temp: 0, rolled: false, rows: [] },
  ]);
});

test("a save file of version 2 brings a random item; the gear screen lists it and the run wears it", async ({ page }) => {
  await page.goto("/?seed=1&debug=1&lang=cs&hero=stonehorn");
  await page.waitForFunction(() => window.__game?.screen === "menu");
  const save = {
    version: 2, nextUid: 2, loadouts: {},
    items: [{
      uid: 1, rarity: "epic", level: 3, base: "iron-helm", name: [2, 1],
      rows: [["armor", 0.5, -1], ["cooldownSpeed", 0.034, 1], ["regen", 0.56, 0], ["thorns", 0.27, 0]],
    }],
  };
  await page.locator("#gear").click();
  await page.locator("#gear-import-file").setInputFiles({
    name: "gear.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(save)),
  });
  await expect(page.locator("#gear-screen .gear-count")).toHaveText("Sbírka: 1 z 200");
  const cell = page.locator('#gear-screen .gear-grid [data-uid="1"]');
  await expect(cell).toHaveClass(/rarity-epic/);
  await expect(cell.locator(".slot-level")).toHaveText("3");
  await expect(cell.locator(".item-icon")).toHaveAttribute("style", /icons\/lorc-visored-helm\.svg/);
  await cell.hover();
  await expect(page.locator("#gear-screen .item-tooltip")).toContainText("Kostěná kukla");
  await cell.click();
  await expect(page.locator('#gear-screen .gear-left .doll-slot[data-slot="head"]')).not.toHaveClass(/empty/);
  await expect(page.locator('#gear-screen .gear-left .doll-slot[data-slot="head"] .item-icon')).toHaveCount(1);
  await expect(page.locator('#gear-screen .gear-left .doll-slot[data-slot="chest"] .item-icon')).toHaveCount(0);
  await page.locator("#gear-back").click();
  await startRun(page);
  await waitForScreen(page, "playing");
  const worn = await page.evaluate(() => window.__game!.gear.filter((slot) => slot !== null));
  expect(worn).toMatchObject([{ item: "rolled-iron-helm", base: 3, temp: 0, rolled: true }]);
  expect(worn[0]!.rows.map((row) => [row.stat, row.tier])).toEqual([["armor", 0], ["cooldownSpeed", 2], ["regen", 1], ["thorns", 1]]);
});

test("the gear screen filters random items, sorts them by power and salvages them into the next run's gold", async ({ page }) => {
  await page.goto("/?seed=1&debug=1&hero=stonehorn");
  await page.waitForFunction(() => window.__game?.screen === "menu");
  const uids = await page.evaluate(() => {
    const debug = window.__game!.debug!;
    return [debug.grantRolled("head", "mythic", 12), debug.grantRolled("ring1", "rare", 2), debug.grantRolled("feet", "common", 0)];
  });
  expect(uids).toEqual([1, 2, 3]);
  await page.locator("#gear").click();
  await expect(page.locator("#gear-count")).toHaveText("Collection: 3 of 200");
  // the rarity filter: only the mythic one
  await page.locator('#gear-screen .gear-filter[data-rarity="mythic"]').click();
  await expect(page.locator("#gear-screen .gear-grid .doll-slot:not(.missing)")).toHaveCount(1);
  await page.locator('#gear-screen .gear-grid [data-uid="1"]').hover();
  await expect(page.locator("#gear-screen .item-tooltip")).toContainText("Mythic random item");
  await expect(page.locator("#gear-screen .item-tooltip .tier-mark").first()).toBeVisible();
  await page.locator('#gear-screen .gear-filter[data-rarity="all"]').click();
  // the sort by power puts the mythic first
  await page.locator("#gear-sort").click();
  await expect(page.locator("#gear-screen .gear-grid .doll-slot").first()).toHaveAttribute("data-uid", "1");
  // wear the rare ring, then salvage: the worn ring stays, the common boots turn into gold
  await page.locator("#gear-sort").click();
  await page.locator('#gear-screen .gear-grid [data-uid="2"]').click();
  await page.locator("#gear-salvage").click();
  await page.locator('#gear-screen .gear-grid [data-uid="2"]').click();
  await expect(page.locator("#gear-message")).toHaveText("Only items that no hero wears can be salvaged.");
  await page.locator('#gear-screen .gear-grid [data-uid="3"]').click();
  await expect(page.locator("#gear-message")).toHaveText("Salvaged for 10 gold.");
  await expect(page.locator('#gear-screen .gear-grid [data-uid="3"]')).toHaveCount(0);
  await expect(page.locator("#gear-bank")).toContainText("Bank: 10 gold");
  await page.locator("#gear-back").click();
  await startRun(page);
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => window.__game!.gold)).toBeGreaterThanOrEqual(10);
  expect(await page.evaluate(() => window.__game!.collectionSize)).toBe(2);
});

test("a named item nobody wears salvages for its rarity's gold x its level and can drop again", async ({ page }) => {
  await page.goto("/?seed=1&debug=1&hero=stonehorn");
  await page.waitForFunction(() => window.__game?.screen === "menu");
  await page.evaluate(() => window.__game!.debug!.grantItem("skysplitter", 2));
  await page.locator("#gear").click();
  await page.locator("#gear-salvage").click();
  await page.locator('#gear-screen .gear-grid [data-item="skysplitter"]').hover();
  await expect(page.locator("#gear-screen .item-tooltip")).toContainText("Salvage: 180 gold");
  await page.locator('#gear-screen .gear-grid [data-item="skysplitter"]').click();
  await expect(page.locator("#gear-message")).toHaveText("Salvaged for 180 gold.");
  await expect(page.locator("#gear-bank")).toContainText("Bank: 180 gold");
  await expect(page.locator('#gear-screen .gear-grid [data-item="skysplitter"]')).toHaveClass(/missing/);
  await expect.poll(() => page.evaluate(() => window.__game!.collection)).toEqual({});
});

test("every hero has its own doll", async ({ page }) => {
  await page.goto("/?seed=1&debug=1&lang=cs&hero=stonehorn");
  await page.waitForFunction(() => window.__game?.screen === "menu");
  await page.evaluate(() => window.__game!.debug!.grantItem("oaken-shield", 1));
  await page.locator("#gear").click();
  await page.locator('#gear-screen .gear-grid [data-item="oaken-shield"]').click();
  await page.locator("#gear-back").click();
  await page.locator('button[data-hero="sparkshot"]').click();
  await page.locator("#gear").click();
  await expect(page.locator("#gear-screen .doll-title")).toHaveText("Jiskrostřelec");
  await expect(page.locator("#gear-screen .gear-left .doll-slot:not(.empty)")).toHaveCount(0);
  await expect(page.locator("#gear-screen .gear-grid .doll-slot:not(.missing)")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("#gear-screen")).toBeHidden();
  await page.locator('button[data-hero="stonehorn"]').click();
  await page.locator("#gear").click();
  await expect(page.locator("#gear-screen .gear-left .doll-slot:not(.empty)")).toHaveCount(1);
});

test("orbs lie on the map; a berserk orb shows in the HUD; a heart heals the hurt hero", async ({ page }) => {
  // speed 1: a slow renderer runs at most 0.25 s of the game per frame, so the weak hero of the batch 2 balance
  // cannot die among the hunters between two frames before it steps away
  await page.goto("/?seed=1&lang=en&debug=1&speed=1&hero=stonehorn");
  await startRun(page);
  await waitForScreen(page, "playing");
  // an idle hero outside the castle's defence circle (rules.enemies.heroDefendRange): the packs go for the castle
  await page.evaluate(() => window.__game!.debug!.teleport(0, 1500));
  // the first orb comes at 8 s; level-up cards pause the run on the way
  for (let i = 0; i < 400; i++) {
    const { tick, screen } = await page.evaluate(() => ({ tick: window.__game!.tick, screen: window.__game!.screen }));
    if (screen === "levelUp") await pickCard(page);
    else if (tick >= 300) break;
    await page.waitForTimeout(100);
  }
  expect(await page.evaluate(() => window.__game!.orbs.length)).toBeGreaterThanOrEqual(1);

  await page.evaluate(() => window.__game!.debug!.spawnOrb("berserk"));
  await page.waitForFunction(() => window.__game!.orbs.some((o) => o.type === "berserk"), undefined, { timeout: 5_000 });
  await page.evaluate(() => {
    const g = window.__game!;
    const orb = g.orbs.find((o) => o.type === "berserk")!;
    g.debug!.teleport(orb.x, orb.y);
  });
  // a level-up card may pause the run before the hero picks the orb up
  const buffBy = Date.now() + 10_000;
  while ((await page.evaluate(() => window.__game!.buffs.berserk)) <= 0 && Date.now() < buffBy) {
    const screen = await page.evaluate(() => window.__game!.screen);
    if (screen === "levelUp" || screen === "chest") await pickCard(page);
    await page.waitForTimeout(50);
  }
  expect(await page.evaluate(() => window.__game!.buffs.berserk)).toBeGreaterThan(0);
  await expect(page.locator(".buff-cell.berserk")).toBeVisible();

  // let the hunters hurt the hero, then step away from them and drop a heart
  const full = await page.evaluate(() => window.__game!.heroHp);
  await page.evaluate(() => window.__game!.debug!.spawnEach());
  // the hero steps away in the same frame its hp drops (a weak hero with no gear dies fast on a slow renderer)
  for (let i = 0; i < 30; i++) {
    const hurt = await page.waitForFunction((limit) => {
      const g = window.__game!;
      if (g.screen === "levelUp" || g.screen === "chest") return "card";
      if (g.heroHp >= limit) return false;
      g.debug!.teleport(2600, 2200);
      return "hurt";
    }, full - 120, { polling: "raf", timeout: 30_000 }).then((h) => h.jsonValue());
    if (hurt === "hurt") break;
    await pickCard(page);
  }
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.__game!.heroHp);
  expect(before).toBeLessThan(full - 60);
  await page.evaluate(() => window.__game!.debug!.dropHeart());
  // more enemies bring more XP: a level-up card pauses the healing, so pick on the way
  const healBy = Date.now() + 10_000;
  while ((await page.evaluate(() => window.__game!.heroHp)) < before + 30 && Date.now() < healBy) {
    const screen = await page.evaluate(() => window.__game!.screen);
    if (screen === "levelUp" || screen === "chest") await pickCard(page);
    await page.waitForTimeout(50);
  }
  expect(await page.evaluate(() => window.__game!.heroHp)).toBeGreaterThanOrEqual(before + 30);
});

test("settings open with O, pause the run and persist", async ({ page }) => {
  await page.goto("/?seed=1&debug=1&lang=cs");
  await startRun(page);
  await waitForScreenPickingLevelUps(page, "playing");
  await page.keyboard.press("KeyO");
  await page.waitForFunction(() => window.__game!.settingsOpen === true);
  await expect(page.locator("#settings-panel .gear-title")).toHaveText("Nastavení");
  const tick = await page.evaluate(() => window.__game!.tick);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__game!.tick)).toBe(tick);
  await page.locator('#settings-panel input[data-setting="music"]').fill("20");
  await page.locator('#settings-panel input[data-setting="shake"]').uncheck();
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => window.__game!.settingsOpen === false);
  await page.waitForFunction((t) => window.__game!.tick > t, tick);

  await page.reload();
  await page.waitForFunction(() => window.__game?.screen === "menu");
  await page.locator("#settings").click();
  await expect(page.locator('#settings-panel input[data-setting="music"]')).toHaveValue("20");
  await expect(page.locator('#settings-panel input[data-setting="shake"]')).not.toBeChecked();
  await page.locator("#settings-close").click();
  await page.waitForFunction(() => window.__game!.settingsOpen === false);
});

test("no audio request fails", async ({ page }) => {
  const failed: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/audio/") && response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/?seed=1&debug=1");
  await startRun(page);
  await waitForScreenPickingLevelUps(page, "playing");
  await page.waitForTimeout(1500);
  expect(failed).toEqual([]);
});

test("the world choice opens only world 1 on normal at first", async ({ page }) => {
  await page.goto("/?seed=1&lang=en");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await page.locator("#start").click();
  await expect(page.locator("#world-screen")).toBeVisible();
  await expect(page.locator('#world-screen [data-world="1"]')).toBeEnabled();
  for (const w of ["2", "3", "4", "5"]) await expect(page.locator(`#world-screen [data-world="${w}"]`)).toBeDisabled();
  await expect(page.locator('#world-screen [data-difficulty="normal"]')).toBeEnabled();
  await expect(page.locator('#world-screen [data-difficulty="insane"]')).toBeDisabled();
  await expect(page.locator('#world-screen [data-difficulty="hell"]')).toBeDisabled();
  await expect(page.locator("#world-detail")).toContainText("No extra reward");
  // Back returns to the menu, Esc too
  await page.locator("#world-back").click();
  await expect(page.locator("#start")).toBeVisible();
  await page.locator("#start").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#world-screen")).toBeHidden();
  await startRun(page);
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => [window.__game!.world, window.__game!.difficulty])).toEqual([1, "normal"]);
  expect(await page.evaluate(() => window.__game!.unlocked)).toEqual(["1-normal"]);
});

test("a locked course from the URL falls back to world 1 on normal", async ({ page }) => {
  await page.goto("/?seed=1&lang=en&world=4&difficulty=hell");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await page.locator("#start").click();
  await expect(page.locator('#world-screen [data-world="1"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('#world-screen [data-difficulty="normal"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator("#world-start").click();
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => [window.__game!.world, window.__game!.difficulty])).toEqual([1, "normal"]);
});

test("debug opens every course; hell world 3 makes enemies tougher", async ({ page }) => {
  await page.goto("/?seed=1&lang=cs&debug=1");
  await expect(page.locator("#start")).toHaveText("Hrát", { timeout: 90_000 });
  expect(await page.evaluate(() => window.__game!.unlocked.length)).toBe(15);
  await page.locator("#start").click();
  await page.locator('#world-screen [data-difficulty="hell"]').click();
  await page.locator('#world-screen [data-world="3"]').click();
  // the strength follows the tuning of rules.difficulty: only check that it is above x1
  const strength = await page.locator("#world-detail .world-line").first().textContent();
  expect(Number(/×([\d,]+)/.exec(strength ?? "")?.[1]?.replace(",", "."))).toBeGreaterThan(1);
  await page.locator("#world-start").click();
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => [window.__game!.world, window.__game!.difficulty])).toEqual([3, "hell"]);
});

test("a won run shows a star on its world card", async ({ page }) => {
  await page.goto("/?seed=1&lang=en&debug=1&duration=5");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await startRun(page);
  expect(await playToEnd(page)).toBe("won");
  expect(await page.evaluate(() => window.__game!.progressSaved)).toBe(false);
  await page.locator("#end button.primary").click();
  await expect(page.locator("#start")).toBeVisible();
  await page.locator("#start").click();
  await expect(page.locator('#world-screen [data-world="1"] .world-card-status')).toHaveText("★ win");
});

test("world 1 has its wall and islands; the storm's bolt warns with a circle", async ({ page }) => {
  await page.goto("/?seed=1&lang=en&debug=1&phase=3&hero=stonehorn");
  await startRun(page);
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => window.__game!.obstacles)).toBeGreaterThanOrEqual(35);
  // the warning lasts 1.2 s of the game: a slow software frame can step past it, and the first ring compiles its shader
  // (10 s limit). The wave and the pause (O opens the settings) come in one evaluate, so no step runs between them
  await page.evaluate(() => {
    window.__game!.debug!.hazard();
    dispatchEvent(new KeyboardEvent("keydown", { code: "KeyO" }));
  });
  await page.waitForFunction(
    () => window.__game!.settingsOpen && window.__game!.render.hazardRings > 0 && window.__game!.hazard.pending > 0,
    undefined, { timeout: 10_000, polling: 50 },
  );
  await expect(page.locator(".buff-cell.storm")).toBeVisible();
});

test("world 2: river, bridges and a sandstorm", async ({ page }) => {
  await page.goto("/?seed=1&lang=en&debug=1&world=2&hero=stonehorn");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await startRun(page);
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => window.__game!.hazard.kind)).toBe("weather");
  expect(await page.evaluate(() => window.__game!.obstacles)).toBeGreaterThanOrEqual(7 + 28);
  await page.evaluate(() => window.__game!.debug!.hazard());
  await page.waitForFunction(
    () => window.__game!.hazard.weather > 0 && window.__game!.render.particles > 0,
    undefined, { timeout: 2_000, polling: 50 },
  );
  await expect(page.locator(".buff-cell.sand")).toBeVisible();
  await page.evaluate(() => window.__game!.debug!.teleport(-2200, 1000));
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1_000);
  await page.keyboard.up("KeyW");
  // the river's axis at x = -2200 lies at y = 1337; half its thickness is 75
  expect(await page.evaluate(() => window.__game!.heroY)).toBeLessThan(1337 - 75);
});

test("world 3: the thicket slows the hero", async ({ page }) => {
  await page.goto("/?seed=1&lang=en&debug=1&world=3&hero=stonehorn");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await startRun(page);
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => window.__game!.hazard.kind)).toBe("thicket");
  await page.evaluate(() => window.__game!.debug!.teleport(0, 900));
  await page.waitForFunction(() => Math.abs(window.__game!.hazard.ground - 0.7) < 0.01, undefined, { timeout: 2_000, polling: 50 });
  await expect(page.locator(".buff-cell.thicket")).toBeVisible();
  expect(await page.evaluate(() => window.__game!.render.particles)).toBeGreaterThan(0);
  await page.evaluate(() => window.__game!.debug!.teleport(0, -600));
  await page.waitForFunction(() => window.__game!.hazard.ground === 1, undefined, { timeout: 2_000, polling: 50 });
});

test("switching worlds rebuilds the arena", async ({ page }) => {
  const envRequests: string[] = [];
  page.on("request", (r) => {
    const m = /\/models\/env\/([\w-]+)\.glb/.exec(r.url());
    if (m) envRequests.push(m[1]!);
  });
  await page.goto("/?seed=1&lang=en&debug=1&duration=5&hero=stonehorn");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await page.locator("#start").click();
  await page.locator('#world-screen [data-world="2"]').click();
  await page.locator("#world-start").click();
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => [window.__game!.world, window.__game!.hazard.kind])).toEqual([2, "weather"]);
  const riverMap = await page.evaluate(() => window.__game!.obstacles);
  expect(await playToEnd(page)).toBeDefined();
  await page.locator("#again").click();
  await waitForScreen(page, "menu", 10_000);
  await page.locator("#start").click();
  await page.locator('#world-screen [data-world="3"]').click();
  await page.locator("#world-start").click();
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => [window.__game!.world, window.__game!.hazard.kind])).toEqual([3, "thicket"]);
  const ring = await page.evaluate(() => window.__game!.obstacles);
  expect(ring).not.toBe(riverMap);
  expect(ring).toBeGreaterThanOrEqual(16 + 34);
  // every env model is fetched once, however often the worlds change
  expect(envRequests.length).toBe(new Set(envRequests).size);
  expect(new Set(envRequests).has("tent")).toBe(true);
  expect(new Set(envRequests).has("bush")).toBe(true);
});

test("world 4: the ridge, a blizzard and chill", async ({ page }) => {
  await page.goto("/?seed=1&lang=en&debug=1&world=4&hero=stonehorn");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await startRun(page);
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => window.__game!.hazard.kind)).toBe("weather");
  await page.evaluate(() => window.__game!.debug!.hazard());
  await page.waitForFunction(
    () => window.__game!.hazard.weather > 0 && window.__game!.render.particles >= 600,
    undefined, { timeout: 2_000, polling: 50 },
  );
  await expect(page.locator(".buff-cell.snow")).toBeVisible();
  // standing 3 s in the blizzard chills the hero; walking thaws him
  await page.waitForFunction(() => window.__game!.hazard.chilled, undefined, { timeout: 12_000, polling: 100 });
  await expect(page.locator(".buff-cell.chill")).toBeVisible();
  await page.keyboard.down("KeyD");
  await page.waitForFunction(() => !window.__game!.hazard.chilled, undefined, { timeout: 3_000, polling: 50 });
  await page.keyboard.up("KeyD");
  await page.evaluate(() => window.__game!.debug!.teleport(0, 1200));
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1_000);
  await page.keyboard.up("KeyW");
  // the ridge's axis at x = 0 lies at y = 1477; half its thickness is 90
  expect(await page.evaluate(() => window.__game!.heroY)).toBeLessThan(1477 - 90);
});

test("world 5: meteors leave fire", async ({ page }) => {
  await page.goto("/?seed=1&lang=en&debug=1&world=5&hero=stonehorn");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await startRun(page);
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => window.__game!.hazard.kind)).toBe("meteors");
  expect(await page.evaluate(() => window.__game!.render.particles)).toBe(200);
  await page.evaluate(() => window.__game!.debug!.hazard());
  await page.waitForFunction(() => window.__game!.render.hazardRings > 0, undefined, { timeout: 2_000, polling: 50 });
  await expect(page.locator(".buff-cell.meteor")).toBeVisible();
  await page.waitForFunction(
    () => window.__game!.hazard.pools > 0 && window.__game!.render.pools > 0,
    undefined, { timeout: 6_000, polling: 50 },
  );
});

test("a blizzard and fire do not outlive their world", async ({ page }) => {
  await page.goto("/?seed=1&lang=en&debug=1&duration=5&hero=stonehorn");
  await expect(page.locator("#start")).toHaveText("Start", { timeout: 90_000 });
  await page.locator("#start").click();
  await page.locator('#world-screen [data-world="5"]').click();
  await page.locator("#world-start").click();
  await waitForScreen(page, "playing");
  await page.evaluate(() => window.__game!.debug!.hazard());
  await page.waitForFunction(() => window.__game!.render.pools > 0, undefined, { timeout: 6_000, polling: 50 });
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  expect(await playToEnd(page)).toBeDefined();
  await page.locator("#again").click();
  await waitForScreen(page, "menu", 10_000);
  await page.locator("#start").click();
  await page.locator('#world-screen [data-world="4"]').click();
  await page.locator("#world-start").click();
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => [window.__game!.world, window.__game!.hazard.kind])).toEqual([4, "weather"]);
  expect(await page.evaluate(() => window.__game!.render.pools)).toBe(0);
  // light snow only: no blizzard yet, and no embers left over
  expect(await page.evaluate(() => window.__game!.render.particles)).toBe(150);
  expect(errors).toEqual([]);
});

test("F teleports the hero to the mouse point at once, far beyond a dash", async ({ page }) => {
  // a debug start at phase 20 spends its level-ups by the autopilot's rule: the hero is past the blink's level 20
  await page.goto("/?seed=1&debug=1&phase=20&lang=cs");
  await startRun(page);
  await waitForScreen(page, "playing");
  expect(await page.evaluate(() => window.__game!.level)).toBeGreaterThanOrEqual(20);
  const before = await page.evaluate(() => ({ x: window.__game!.heroX, y: window.__game!.heroY }));
  const box = (await page.locator("canvas").first().boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.keyboard.press("KeyF");
  await page.waitForFunction(
    (from) => Math.hypot(window.__game!.heroX - from.x, window.__game!.heroY - from.y) > 1000,
    before,
  );
  const after = await page.evaluate(() => ({ x: window.__game!.heroX, y: window.__game!.heroY }));
  // the top left corner of the screen lies to the north west
  expect(after.x).toBeLessThan(before.x);
  expect(after.y).toBeGreaterThan(before.y);
});

test("the damage meter lists the hero's sources, the biggest first; N hides it", async ({ page }) => {
  await page.goto("/?seed=1&debug=1&hero=tidecaller&phase=3&speed=4");
  await waitForScreen(page, "menu");
  await startRun(page);
  await waitForScreen(page, "playing");
  await page.evaluate(() => window.__game!.debug!.spawnEach());
  await page.waitForFunction(() => window.__game!.meter.rows.length >= 2, null, { timeout: 60_000 });
  const meter = await page.evaluate(() => window.__game!.meter);
  const damages = meter.rows.map((row) => row.damage);
  expect([...damages].sort((a, b) => b - a)).toEqual(damages);
  expect(meter.rows.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1, 5);
  await expect(page.locator("#damage-meter")).toBeVisible();
  await expect(page.locator("#damage-meter .meter-row").first()).toBeVisible();
  await page.keyboard.press("KeyN");
  await expect(page.locator("#damage-meter")).toBeHidden();
  await page.keyboard.press("KeyN");
  await expect(page.locator("#damage-meter")).toBeVisible();
});
