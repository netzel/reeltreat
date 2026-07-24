import { describe, expect, it } from "vitest";
import {
  capturesDir,
  curatedDir,
  curationPath,
  manifestPath,
  manualDir,
  projectDir,
  renderRunDir,
  renderRunId,
  rendersDir,
} from "../paths.js";

describe("project path helpers", () => {
  it("place every asset under a single projects/<name>/ folder", () => {
    const dir = projectDir("myapp");
    for (const p of [
      manifestPath("myapp"),
      manualDir("myapp"),
      capturesDir("myapp"),
      curatedDir("myapp"),
      curationPath("myapp"),
      rendersDir("myapp"),
    ]) {
      expect(p.startsWith(dir + "/")).toBe(true);
    }
    expect(manifestPath("myapp").endsWith("/manifest.yaml")).toBe(true);
    expect(capturesDir("myapp").endsWith("/captures")).toBe(true);
  });
});

describe("renderRunId", () => {
  it("formats a sortable, filesystem-safe id from the start time", () => {
    const id = renderRunId(new Date(2026, 6, 24, 16, 45, 12, 789));
    expect(id).toBe("2026-07-24_164512-789");
    // No path separators or characters that would break a folder name.
    expect(id).not.toMatch(/[/\\:]/);
  });

  it("is unique per millisecond and sorts chronologically", () => {
    const a = renderRunId(new Date(2026, 0, 1, 0, 0, 0, 0));
    const b = renderRunId(new Date(2026, 0, 1, 0, 0, 0, 1));
    const c = renderRunId(new Date(2026, 0, 1, 0, 0, 1, 0));
    expect(new Set([a, b, c]).size).toBe(3);
    // Lexical order matches time order, so listing runs sorts newest-last.
    expect([c, a, b].sort()).toEqual([a, b, c]);
  });

  it("nests each run under renders/<runId>/ so renders never collide", () => {
    const id1 = renderRunId(new Date(2026, 0, 1, 9, 0, 0, 0));
    const id2 = renderRunId(new Date(2026, 0, 1, 9, 0, 0, 5));
    const d1 = renderRunDir("myapp", id1);
    const d2 = renderRunDir("myapp", id2);
    expect(d1).not.toBe(d2);
    expect(d1.startsWith(rendersDir("myapp") + "/")).toBe(true);
  });
});
