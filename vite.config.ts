import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  root: "client",
  build: { outDir: "../dist/client", emptyOutDir: true },
  server: { proxy: { "/api": "http://localhost:3000" } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "Trinity",
        short_name: "Trinity",
        description: "A tua assistente pessoal",
        lang: "pt-PT",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#050607",
        theme_color: "#050607",
        icons: [
          { src: "icone-192.png", sizes: "192x192", type: "image/png" },
          { src: "icone-512.png", sizes: "512x512", type: "image/png" },
          { src: "icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      injectManifest: { globPatterns: ["**/*.{js,css,html,png,svg}"] },
    }),
  ],
});
