import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => {
  const buildBrand = process.env.APP_BRAND;
  const includeBothBrands = command === "serve" || !buildBrand;
  return {
    base: "./",
    plugins: [react()],
    define: {
      __ENABLE_CALIBRATION_WORKBENCHES__: JSON.stringify(command === "serve"),
      __ENABLE_YINYI_INTERFACE_WIRING__: JSON.stringify(includeBothBrands || buildBrand === "yinyi"),
      __ENABLE_YINMAN_INTERFACE_WIRING__: JSON.stringify(includeBothBrands || buildBrand === "yinman")
    },
    build: {
      sourcemap: false,
      minify: "esbuild",
      cssMinify: true,
      assetsInlineLimit: 4096,
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
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
  };
});

