import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  base: "/",

  server: {
    host: "::",
    port: 8080,
  },

  build: {
    rollupOptions: {
      output: {
        // Static hosts must serve the PDF worker with a JavaScript MIME type.
        assetFileNames: (asset) => asset.name === "pdf.worker.min.mjs"
          ? "assets/[name]-[hash].js"
          : "assets/[name]-[hash][extname]",
      },
    },
  },

  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
