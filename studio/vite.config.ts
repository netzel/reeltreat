/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// reeltreat Studio runs entirely on the local machine — Vite dev server in the
// browser, no deploy target (see ../CLAUDE.md). The pipeline calls it drives
// (capture/curate/render) go to the local bridge (src/bridge/server.ts) started
// with `npm run bridge`. /api and /media are proxied to it so the browser makes
// same-origin requests. Target 127.0.0.1 (the bridge's bind address) rather than
// localhost, which on Windows resolves to ::1 first and wastes a refused hop.
const BRIDGE = "http://127.0.0.1:5179";
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    open: true,
    proxy: {
      "/api": { target: BRIDGE, changeOrigin: true },
      "/media": { target: BRIDGE, changeOrigin: true },
    },
  },
  test: {
    // Workflow logic is factored into pure modules (src/workflow.ts), so tests
    // need no DOM environment or component-render harness.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
