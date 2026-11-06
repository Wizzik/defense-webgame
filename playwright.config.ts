import { defineConfig } from "@playwright/test";

const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

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
      use: { launchOptions: { executablePath } },
    },
    {
      name: "webgpu-swiftshader",
      use: { launchOptions: { executablePath, args: swiftshaderArgs } },
    },
  ],
});
