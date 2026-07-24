// Pure workflow model for the top bar and step nav.
//
// Kept free of React so it can be unit-tested directly (see __tests__/workflow.test.ts).
// The Studio walks a fixed five-step pipeline that mirrors the reeltreat CLI:
//   target(init) → capture → curate → frame(edit) → preview(render/export).

import type { Screen } from "./types";

/** [title, breadcrumb] shown in the top bar for each screen. */
export const SCREEN_TITLES: Record<Screen, [string, string]> = {
  projects: ["Projects", "~/reeltreat/projects"],
  target: ["New Project", "Step 1 · Target"],
  manifest: ["Manifest & Shots", "myapp · manifest.json"],
  auth: ["Authenticate", "myapp · session"],
  capture: ["Capture", "Step 2 · Capturing 8 shots"],
  curate: ["Curation Review", "Step 3 · AI curation"],
  frame: ["Frame Editor", "Step 4 · myapp — 15s cut"],
  preview: ["Preview & Export", "Step 5 · render & export"],
};

/** The ordered pipeline steps, as [screen, label]. */
export const PIPELINE: ReadonlyArray<[Screen, string]> = [
  ["target", "Target"],
  ["capture", "Capture"],
  ["curate", "Curate"],
  ["frame", "Edit"],
  ["preview", "Preview & Export"],
];

export type StepStatus = "done" | "active" | "available";

export interface StepModel {
  screen: Screen;
  num: number;
  name: string;
  status: StepStatus;
  /** Index in PIPELINE. */
  index: number;
}

/**
 * Given the current screen, produce the status of every pipeline step.
 * Screens that aren't part of the pipeline (projects, manifest, auth) fall back
 * to treating "frame" (index 3) as current, matching the prototype.
 */
export function stepModels(screen: Screen): StepModel[] {
  const activeIdx = PIPELINE.findIndex(([s]) => s === screen);
  const curIdx = activeIdx < 0 ? 3 : activeIdx;
  return PIPELINE.map(([s, name], i) => ({
    screen: s,
    num: i + 1,
    name,
    index: i,
    status: i < curIdx ? "done" : i === curIdx ? "active" : "available",
  }));
}
