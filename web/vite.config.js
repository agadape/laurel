import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";

// `npm run dev` only: serve api/ask.mjs like Vercel does, with the guest key from ../.env, so the landing page's
// "Ask the champion" can be tried locally. Nothing here is part of the build.
const devAsk = () => ({
  name: "laurel-dev-ask",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use("/api/ask", async (req, res) => {
      try {
        const lines = fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n").map((l) => l.trim());
        const env = Object.fromEntries(lines.filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
        process.env.LAUREL_GUEST_ID ||= env.GUEST_ACCOUNT_ID || "";
        process.env.LAUREL_GUEST_KEY ||= env.GUEST_FC_PRIVATE_KEY || "";
        process.env.LAUREL_MAINNET_GUEST_ID ||= env.MAINNET_GUEST_ID || "";
        process.env.LAUREL_MAINNET_GUEST_KEY ||= env.MAINNET_GUEST_FC_PRIVATE_KEY || "";
      } catch {}
      let raw = "";
      for await (const chunk of req) raw += chunk;
      try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
      const { default: handler } = await import(new URL("./api/ask.mjs", import.meta.url).href);
      await handler(req, res);
    });
  },
});

export default defineConfig({
  plugins: [react(), devAsk()],
  // wallet-selector and its wallet SDKs expect Node globals; Buffer is provided in main.jsx
  define: { global: "globalThis", "process.env": {} },
  // @phala/dcap-qvl (Intel TDX quote verification in the browser) requires Node's crypto only to detect Node
  resolve: { alias: { crypto: new URL("./src/shims/crypto.js", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1") } },
  build: { outDir: "dist", sourcemap: false },
});
