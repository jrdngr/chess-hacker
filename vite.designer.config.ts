import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

import { decksWriter } from "./src/designer/vite-decks-plugin";

// The Content Designer is a separate Vite app sharing the same source tree
// as the game. It runs on a different port (5174) and uses `designer.html`
// as its entry. We don't need cross-origin isolation here (no Stockfish),
// so the COEP/COOP plugin from `vite.config.ts` is intentionally omitted.
//
// `serveDesignerAtRoot` rewrites `/` to `/designer.html` so opening the
// dev URL lands on the designer directly.

const serveDesignerAtRoot: Plugin = {
  name: "chess-hacker-designer-root-rewrite",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === "/" || req.url === "") {
        req.url = "/designer.html";
      }
      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), serveDesignerAtRoot, decksWriter()],
  server: { port: 5174, strictPort: true },
  build: {
    outDir: "dist-designer",
    rollupOptions: {
      input: { designer: "designer.html" },
    },
  },
});
