import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

export default defineConfig({
  plugins: [{
    name: 'room-dependency-licenses',
    generateBundle() {
      const license = name => readFileSync(new URL(`./node_modules/${name}/LICENSE`, import.meta.url), 'utf8');
      this.emitFile({type:'asset',fileName:'LICENSES.txt',source:`Three.js\n${license('three')}\nChess.js 1.4.0\n${license('chess.js')}`});
    }
  }],
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
        banner: '/*! Bundled dependency licenses: ./LICENSES.txt */',
        assetFileNames: "[name][extname]"
      }
    }
  }
});
