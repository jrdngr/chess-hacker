import { defineConfig, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Fairy-Stockfish.wasm uses pthreads + SharedArrayBuffer, which require
// cross-origin isolation. Both the dev server and the preview server must
// emit COEP: require-corp + COOP: same-origin so the engine worker can
// spawn pthread workers and share memory. Production deployments need the
// same headers configured at the host level (see docs/technical/ai.md).
const crossOriginIsolation: Plugin = {
  name: "chess-hacker-cross-origin-isolation",
  configureServer(server) {
    server.middlewares.use(setIsolationHeaders);
  },
  configurePreviewServer(server) {
    server.middlewares.use(setIsolationHeaders);
  },
};

const setIsolationHeaders: Connect.NextHandleFunction = (_req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
};

export default defineConfig({
  plugins: [react(), crossOriginIsolation],
});
