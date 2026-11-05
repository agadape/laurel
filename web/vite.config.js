import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // wallet-selector and its wallet SDKs expect Node globals; Buffer is provided in main.jsx
  define: { global: "globalThis", "process.env": {} },
  build: { outDir: "dist", sourcemap: false },
});
