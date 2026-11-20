import { defineConfig } from "@playwright/test";

const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

// the screenshot spec asserts nothing; it runs only through `npm run shots`
const gameIgnore = process.env.SHOTS ? ["**/determinism.spec.ts"] : ["**/shots.spec.ts", "**/determinism.spec.ts"];
// the determinism matrix (spec 2026-11-20 multiplayer spike) runs in every engine; sim-firefox and sim-webkit only in CI
const determinism = "**/determinism.spec.ts";

const swiftshaderArgs = [
  "--enable-unsafe-webgpu",
  "--enable-unsafe-swiftshader",
  "--enable-features=Vulkan",
  "--use-vulkan=swiftshader",
  "--use-angle=swiftshader",
];

export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : [["line"]],
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: { baseURL: "http://localhost:4173", screenshot: "only-on-failure" },
  projects: [
    {
      name: "webgl2-fallback",
      testIgnore: gameIgnore,
      use: { launchOptions: { executablePath } },
    },
    {
      name: "webgpu-swiftshader",
      testIgnore: gameIgnore,
      use: { launchOptions: { executablePath, args: swiftshaderArgs } },
    },
    { name: "sim-chromium", testMatch: determinism, use: { launchOptions: { executablePath } } },
    { name: "sim-firefox", testMatch: determinism, use: { browserName: "firefox" } },
    { name: "sim-webkit", testMatch: determinism, use: { browserName: "webkit" } },
  ],
});
