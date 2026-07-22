import { defineConfig } from "vitest/config";

// Separate config so `npm test` (default config) never collects the evals.
// Run the evals explicitly and opt in with RUN_EVALS=1 — see evals/README.md.
export default defineConfig({
  test: {
    include: ["**/*.eval.ts"],
  },
});
