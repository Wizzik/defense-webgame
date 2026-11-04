import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: "client",
  publicDir: "../assets",
  base: process.env.BASE_PATH ?? "/",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "client/index.html"),
        spike: resolve(import.meta.dirname, "client/spike/index.html"),
      },
    },
  },
});
