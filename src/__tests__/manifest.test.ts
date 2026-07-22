import { describe, expect, it } from "vitest";
import { ManifestSchema, ShotSchema, resolveShotSettings } from "../manifest.js";

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
    // Per-shot capture fields carry no schema-level default now; built-ins are
    // applied by resolveShotSettings at capture time, so they are unset here.
    expect(m.shots[0].fullPage).toBeUndefined();
    expect(m.shots[0].waitUntil).toBeUndefined();
    expect(m.shots[0].timeoutMs).toBeUndefined();
    expect(m.defaults).toEqual({});
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

  describe("defaults block", () => {
    it("accepts a valid defaults block with the same fields as a shot", () => {
      const result = ManifestSchema.safeParse({
        ...base(),
        defaults: {
          waitUntil: "domcontentloaded",
          timeoutMs: 5000,
          delayMs: 2000,
          waitFor: "#app-ready",
          fullPage: true,
        },
      });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.defaults).toEqual({
        waitUntil: "domcontentloaded",
        timeoutMs: 5000,
        delayMs: 2000,
        waitFor: "#app-ready",
        fullPage: true,
      });
    });

    it("enforces the same constraints as per-shot fields", () => {
      for (const bad of [
        { waitUntil: "commit" },
        { timeoutMs: 0 },
        { timeoutMs: -1 },
        { delayMs: -5 },
      ]) {
        const result = ManifestSchema.safeParse({ ...base(), defaults: bad });
        expect(result.success).toBe(false);
      }
    });
  });
});

describe("resolveShotSettings", () => {
  const shot = (overrides: Record<string, unknown> = {}) =>
    ShotSchema.parse({ id: "a", path: "/a", caption: "A", ...overrides });

  it("falls back to built-in defaults when nothing is set (behaves as today)", () => {
    expect(resolveShotSettings(shot())).toEqual({
      waitUntil: "load",
      timeoutMs: 30000,
      waitFor: undefined,
      delayMs: undefined,
      fullPage: false,
    });
  });

  it("uses the manifest default when the shot omits the field", () => {
    const defaults = {
      waitUntil: "domcontentloaded" as const,
      timeoutMs: 5000,
      delayMs: 2000,
      waitFor: "#x",
      fullPage: true,
    };
    expect(resolveShotSettings(shot(), defaults)).toEqual(defaults);
  });

  it("uses built-in defaults for image shots too (though capture ignores them)", () => {
    // image shots skip the browser, but resolveShotSettings stays total.
    const parsed = ShotSchema.parse({ id: "mic", caption: "Mic", image: "m.png" });
    expect(resolveShotSettings(parsed)).toEqual({
      waitUntil: "load",
      timeoutMs: 30000,
      waitFor: undefined,
      delayMs: undefined,
      fullPage: false,
    });
  });

  it("lets an explicit per-shot value win over the manifest default, per field", () => {
    const defaults = {
      waitUntil: "domcontentloaded" as const,
      timeoutMs: 5000,
      delayMs: 2000,
      waitFor: "#default",
      fullPage: true,
    };
    const resolved = resolveShotSettings(
      shot({
        waitUntil: "networkidle",
        timeoutMs: 1000,
        delayMs: 0, // a real 0 must beat the default, not be treated as unset
        waitFor: "#shot",
        fullPage: false,
      }),
      defaults,
    );
    expect(resolved).toEqual({
      waitUntil: "networkidle",
      timeoutMs: 1000,
      delayMs: 0,
      waitFor: "#shot",
      fullPage: false,
    });
  });
});

describe("image shots", () => {
  it("parses a shot that supplies image instead of path", () => {
    const shot = ShotSchema.safeParse({
      id: "mic",
      caption: "Live transcription",
      image: "manual/myapp/mic.png",
    });
    expect(shot.success).toBe(true);

    const manifest = ManifestSchema.safeParse({
      name: "myapp",
      baseUrl: "https://myapp.example.com",
      shots: [{ id: "mic", caption: "Live transcription", image: "manual/myapp/mic.png" }],
    });
    expect(manifest.success).toBe(true);
  });

  it("rejects a shot that sets both path and image", () => {
    const result = ShotSchema.safeParse({
      id: "mic",
      caption: "Mic",
      path: "/mic",
      image: "mic.png",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => /not both/.test(i.message))).toBe(true);
  });

  it("rejects a shot that sets neither path nor image", () => {
    const result = ShotSchema.safeParse({ id: "mic", caption: "Mic" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.some((i) => /either 'path' .* or 'image'/.test(i.message)),
    ).toBe(true);
  });

  it("rejects every browser-only field on an image shot, naming the field", () => {
    for (const field of ["waitFor", "delayMs", "waitUntil", "timeoutMs", "fullPage"]) {
      const value =
        field === "waitUntil"
          ? "load"
          : field === "waitFor"
            ? "#x"
            : field === "fullPage"
              ? true
              : 1000;
      const result = ShotSchema.safeParse({
        id: "mic",
        caption: "Mic",
        image: "mic.png",
        [field]: value,
      });
      expect(result.success, `${field} should be rejected`).toBe(false);
      if (result.success) continue;
      const named = result.error.issues.some(
        (i) => i.path.includes(field) && i.message.includes(field),
      );
      expect(named, `error should name ${field}`).toBe(true);
    }
  });
});
