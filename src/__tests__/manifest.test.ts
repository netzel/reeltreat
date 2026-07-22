import { describe, expect, it } from "vitest";
import { ManifestSchema } from "../manifest.js";

/** A minimal valid manifest object, spread and overridden per test. */
function base(): Record<string, unknown> {
  return {
    name: "myapp",
    baseUrl: "https://myapp.example.com",
    shots: [{ id: "dashboard", path: "/dashboard", caption: "Overview" }],
  };
}

describe("ManifestSchema", () => {
  it("parses a valid manifest and applies defaults", () => {
    const result = ManifestSchema.safeParse(base());
    expect(result.success).toBe(true);
    if (!result.success) return;

    const m = result.data;
    expect(m.viewport).toEqual({ width: 1440, height: 900 });
    expect(m.shots[0].fullPage).toBe(false);
    expect(m.shots[0].waitUntil).toBe("load");
    expect(m.shots[0].timeoutMs).toBe(30000);
    expect(m.brand).toEqual({});
  });

  it("accepts valid waitUntil values and a positive timeoutMs", () => {
    const result = ManifestSchema.safeParse({
      ...base(),
      shots: [
        {
          id: "live",
          path: "/live",
          caption: "Live",
          waitUntil: "domcontentloaded",
          timeoutMs: 5000,
        },
      ],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.shots[0].waitUntil).toBe("domcontentloaded");
    expect(result.data.shots[0].timeoutMs).toBe(5000);
  });

  it("rejects an invalid waitUntil value", () => {
    const result = ManifestSchema.safeParse({
      ...base(),
      shots: [{ id: "a", path: "/a", caption: "A", waitUntil: "commit" }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => i.path.includes("waitUntil"))).toBe(true);
  });

  it("rejects a zero or negative timeoutMs", () => {
    for (const timeoutMs of [0, -1]) {
      const result = ManifestSchema.safeParse({
        ...base(),
        shots: [{ id: "a", path: "/a", caption: "A", timeoutMs }],
      });
      expect(result.success).toBe(false);
      if (result.success) continue;
      expect(result.error.issues.some((i) => i.path.includes("timeoutMs"))).toBe(true);
    }
  });

  it("preserves explicit viewport and fullPage values", () => {
    const result = ManifestSchema.safeParse({
      ...base(),
      viewport: { width: 800, height: 600 },
      shots: [
        { id: "settings", path: "/settings", caption: "Settings", fullPage: true },
      ],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.viewport).toEqual({ width: 800, height: 600 });
    expect(result.data.shots[0].fullPage).toBe(true);
  });

  it("rejects a missing name", () => {
    const { name, ...rest } = base();
    void name;
    const result = ManifestSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => i.path.includes("name"))).toBe(true);
  });

  it("rejects a bad baseUrl", () => {
    const result = ManifestSchema.safeParse({ ...base(), baseUrl: "not-a-url" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => i.path.includes("baseUrl"))).toBe(true);
  });

  it("rejects an empty shots array", () => {
    const result = ManifestSchema.safeParse({ ...base(), shots: [] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => i.path.includes("shots"))).toBe(true);
  });

  it("rejects duplicate shot ids", () => {
    const result = ManifestSchema.safeParse({
      ...base(),
      shots: [
        { id: "dupe", path: "/a", caption: "A" },
        { id: "dupe", path: "/b", caption: "B" },
      ],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => /unique/i.test(i.message))).toBe(true);
  });

  it("rejects a shot id with spaces or uppercase", () => {
    const spaces = ManifestSchema.safeParse({
      ...base(),
      shots: [{ id: "bad id", path: "/a", caption: "A" }],
    });
    expect(spaces.success).toBe(false);

    const upper = ManifestSchema.safeParse({
      ...base(),
      shots: [{ id: "BadId", path: "/a", caption: "A" }],
    });
    expect(upper.success).toBe(false);
  });

  it("rejects a negative delayMs", () => {
    const result = ManifestSchema.safeParse({
      ...base(),
      shots: [{ id: "a", path: "/a", caption: "A", delayMs: -100 }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => i.path.includes("delayMs"))).toBe(true);
  });
});
