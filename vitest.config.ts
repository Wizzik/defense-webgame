import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "assets/**/*.test.ts",
      "tests/**/*.test.ts",
      "data/**/*.test.ts",
      "tools/**/*.test.ts",
      "client/**/*.test.ts",
      "sim/**/*.test.ts",
    ],
  },
});
