import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: "client",
  publicDir: "../assets",
  base: process.env.BASE_PATH ?? "/",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    // three.js is bundled on purpose, so the size warning is noise.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "client/index.html"),
        spike: resolve(import.meta.dirname, "client/spike/index.html"),
        determinism: resolve(import.meta.dirname, "client/determinism/index.html"),
        net: resolve(import.meta.dirname, "client/net-spike/index.html"),
      },
    },
  },
});
