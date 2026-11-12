import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Whole-run simulations take several seconds on CI runners.
    testTimeout: 30_000,
    include: [
      "tests/**/*.test.ts",
      "data/**/*.test.ts",
      "tools/**/*.test.ts",
      "client/**/*.test.ts",
      "sim/**/*.test.ts",
    ],
  },
});
