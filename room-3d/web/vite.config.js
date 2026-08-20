import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "../../assets/room3d/app",
    emptyOutDir: true,
    sourcemap: false,
    lib: {
      entry: "src/main.js",
      formats: ["es"],
      fileName: "room-webgl"
    },
    rollupOptions: {
      output: {
        assetFileNames: "[name][extname]"
      }
    }
  }
});
