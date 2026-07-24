/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// reeltreat Studio runs entirely on the local machine — Vite dev server in the
// browser, no deploy target (see ../CLAUDE.md). The pipeline calls it drives
// (capture/curate/render) are stubbed in src/api.ts until a local bridge exists.
export default defineConfig({
  plugins: [react()],
  server: { port: 5175, open: true },
  test: {
    // Workflow logic is factored into pure modules (src/workflow.ts), so tests
    // need no DOM environment or component-render harness.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
