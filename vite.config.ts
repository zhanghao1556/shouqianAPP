import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  base: "./",
  plugins: [react()],
  define: {
    __ENABLE_CALIBRATION_WORKBENCHES__: JSON.stringify(command === "serve")
  },
  build: {
    sourcemap: false,
    minify: "esbuild",
    cssMinify: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        entryFileNames: "assets/app-[hash].js",
        chunkFileNames: "assets/chunk-[hash].js",
        assetFileNames: "assets/asset-[hash][extname]"
      }
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    watch: {
      ignored: ["**/docx_2/**", "**/input/**", "**/inputs/**", "**/output/**", "**/outputs/**", "**/work/**", "**/logs/**"]
    }
  }
}));

