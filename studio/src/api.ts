// reeltreat Studio — backend client (PLACEHOLDER).
//
// The browser can't run Playwright, call Anthropic, or shell out to Remotion
// directly, so each pipeline action here will eventually POST to a small local
// bridge server that invokes the existing CLI (src/*.ts) and streams progress.
// That bridge does not exist yet — per the current deployment spec these are
// stubs that resolve after a short delay with sample data, so the whole UI is
// navigable today. Replace the bodies (not the signatures) when the bridge lands.
//
// Mapping to the CLI verbs:
//   createProject → `npm run init`     detectTarget → introspection
//   openAuth      → `npm run login`    runCapture   → `npm run capture`
//   runCurate     → `npm run curate`   runRender    → `npm run render`

import { PROJECTS, SHOTS, RANKED, CAPTURE_LOG, tierCuts, type Project } from "./data/mock";
import type { Tier } from "./types";

/** TODO: replace with the local bridge base URL once it exists. */
export const BRIDGE_URL = "http://localhost:5179";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const api = {
  async listProjects(): Promise<Project[]> {
    await delay(120);
    return PROJECTS;
  },

  /** Introspect a local repo or deployed URL (framework, routes, brand). */
  async detectTarget(_input: { repoPath?: string; url?: string }) {
    await delay(400);
    return {
      framework: "Next.js App Router",
      routes: 7,
      brand: { primary: "#6D5EF6", accent: "#22D3AA", font: "Inter", baseUrl: "http://localhost:3000" },
    };
  },

  /** `npm run init` — write projects/<name>.yaml. */
  async createProject(_input: { name: string; baseUrl: string }) {
    await delay(300);
    return { ok: true as const };
  },

  /** `npm run login` — open Chrome, save auth/<project>.json. */
  async openAuth(_input: { project: string; mode: "stealth" | "attach" }) {
    await delay(900);
    return { savedTo: "auth/myapp.json" };
  },

  /** `npm run capture` — screenshot each shot; returns the log + shots. */
  async runCapture(_project: string) {
    await delay(600);
    return { shots: SHOTS, log: CAPTURE_LOG, captured: 7, warnings: 1, failed: 0 };
  },

  /** `npm run curate` — one Claude call; returns hero, tagline, ranked cut. */
  async runCurate(_project: string) {
    await delay(500);
    return {
      hero: "dashboard",
      tagline: "Your product's trailer — rendered in one click.",
      ranked: RANKED,
      cached: true,
    };
  },

  /** `npm run render` — Remotion render for a tier; returns output paths. */
  async runRender(_input: { project: string; tier: Tier }) {
    await delay(2400);
    const tier = _input.tier;
    return {
      video: `out/${_input.project}/demo-${tier}s.mp4`,
      poster: `out/${_input.project}/poster.png`,
      cut: tierCuts(tier),
      sizeMb: 8.4,
    };
  },
};
