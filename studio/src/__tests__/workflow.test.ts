import { describe, expect, it } from "vitest";
import { PIPELINE, SCREEN_TITLES, stepModels } from "../workflow";
import type { Screen } from "../types";

describe("stepModels", () => {
  it("marks earlier steps done, the current active, later available", () => {
    const steps = stepModels("curate"); // index 2 in the pipeline
    expect(steps.map((s) => s.status)).toEqual(["done", "done", "active", "available", "available"]);
  });

  it("treats the first pipeline screen as active with nothing done", () => {
    expect(stepModels("target").map((s) => s.status)).toEqual([
      "active",
      "available",
      "available",
      "available",
      "available",
    ]);
  });

  it("falls back to the edit step (index 3) for non-pipeline screens", () => {
    for (const screen of ["projects", "manifest", "auth"] as Screen[]) {
      const steps = stepModels(screen);
      expect(steps.find((s) => s.status === "active")?.screen).toBe("frame");
    }
  });

  it("numbers steps 1..5 in pipeline order", () => {
    const steps = stepModels("preview");
    expect(steps.map((s) => s.num)).toEqual([1, 2, 3, 4, 5]);
    expect(steps.map((s) => s.screen)).toEqual(PIPELINE.map(([s]) => s));
  });
});

describe("SCREEN_TITLES", () => {
  it("has a [title, crumb] pair for every screen", () => {
    const screens: Screen[] = ["projects", "target", "manifest", "auth", "capture", "curate", "frame", "preview"];
    for (const s of screens) {
      expect(SCREEN_TITLES[s]).toHaveLength(2);
      expect(SCREEN_TITLES[s][0].length).toBeGreaterThan(0);
    }
  });
});
