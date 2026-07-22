import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureShot,
  pruneStaleOutputs,
  pruneStaleScreenshots,
  screenshotFilename,
} from "../capture.js";
import { ShotSchema, type Shot } from "../manifest.js";

/** A stub Page with vi.fn() for every method captureShot touches. */
function stubPage() {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(undefined),
    // Defaults to a valid document so a goto timeout is treated as recoverable.
    evaluate: vi.fn().mockResolvedValue("complete"),
  };
}

/** Build a real Shot (defaults applied) so waitUntil/timeoutMs are populated. */
function shot(overrides: Partial<Shot> = {}): Shot {
  return ShotSchema.parse({
    id: "dashboard",
    path: "/dashboard",
    caption: "Overview",
    ...overrides,
  });
}

const baseUrl = "https://myapp.example.com";
const outDir = join("out", "myapp", "screenshots");

describe("captureShot", () => {
  it("resolves the shot path against the base URL", async () => {
    const page = stubPage();
    const { url } = await captureShot(page, shot(), 1, baseUrl, outDir);
    expect(url).toBe("https://myapp.example.com/dashboard");
  });

  it("navigates with the default waitUntil 'load' and default timeout when unset", async () => {
    const page = stubPage();
    await captureShot(page, shot(), 1, baseUrl, outDir);
    expect(page.goto).toHaveBeenCalledWith("https://myapp.example.com/dashboard", {
      waitUntil: "load",
      timeout: 30000,
    });
  });

  it("passes the shot's waitUntil and timeoutMs to goto", async () => {
    const page = stubPage();
    await captureShot(
      page,
      shot({ waitUntil: "domcontentloaded", timeoutMs: 5000 }),
      1,
      baseUrl,
      outDir,
    );
    expect(page.goto).toHaveBeenCalledWith("https://myapp.example.com/dashboard", {
      waitUntil: "domcontentloaded",
      timeout: 5000,
    });
  });

  it("awaits waitFor with the shot timeout when present", async () => {
    const page = stubPage();
    await captureShot(
      page,
      shot({ waitFor: "#ready", timeoutMs: 12345 }),
      1,
      baseUrl,
      outDir,
    );
    expect(page.waitForSelector).toHaveBeenCalledWith("#ready", { timeout: 12345 });
  });

  it("skips waitForSelector when waitFor is absent", async () => {
    const page = stubPage();
    await captureShot(page, shot(), 1, baseUrl, outDir);
    expect(page.waitForSelector).not.toHaveBeenCalled();
  });

  it("applies delayMs when present", async () => {
    const page = stubPage();
    await captureShot(page, shot({ delayMs: 500 }), 1, baseUrl, outDir);
    expect(page.waitForTimeout).toHaveBeenCalledWith(500);
  });

  it("screenshots to a zero-padded, indexed filename", async () => {
    const page = stubPage();
    const { file } = await captureShot(page, shot(), 3, baseUrl, outDir);

    const expected = join(outDir, "03-dashboard.png");
    expect(file).toBe(expected);
    expect(page.screenshot).toHaveBeenCalledWith({
      path: expected,
      fullPage: false,
    });
  });

  it("passes fullPage through to screenshot", async () => {
    const page = stubPage();
    await captureShot(page, shot({ fullPage: true }), 1, baseUrl, outDir);
    expect(page.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({ fullPage: true }),
    );
  });

  describe("navigation timeout handling", () => {
    it("still screenshots and returns a warning when goto times out but a document exists", async () => {
      const page = stubPage();
      page.goto.mockRejectedValue(new Error("Timeout 30000ms exceeded"));
      page.evaluate.mockResolvedValue("interactive"); // document present

      const result = await captureShot(page, shot(), 1, baseUrl, outDir);

      expect(result.warning).toBeDefined();
      expect(result.warning).toMatch(/exceeded/);
      expect(page.screenshot).toHaveBeenCalledTimes(1); // captured anyway
    });

    it("fails when goto times out and the page has no document", async () => {
      const page = stubPage();
      page.goto.mockRejectedValue(new Error("Timeout 30000ms exceeded"));
      page.evaluate.mockRejectedValue(new Error("no execution context"));

      await expect(captureShot(page, shot(), 1, baseUrl, outDir)).rejects.toThrow(
        /Timeout/,
      );
      expect(page.screenshot).not.toHaveBeenCalled();
    });

    it("does not warn on a normal successful navigation", async () => {
      const page = stubPage();
      const result = await captureShot(page, shot(), 1, baseUrl, outDir);
      expect(result.warning).toBeUndefined();
      expect(page.evaluate).not.toHaveBeenCalled();
    });
  });

  it("always fails when the screenshot itself throws", async () => {
    const page = stubPage();
    page.screenshot.mockRejectedValue(new Error("screenshot failed"));
    await expect(captureShot(page, shot(), 1, baseUrl, outDir)).rejects.toThrow(
      "screenshot failed",
    );
  });

  describe("manifest defaults", () => {
    it("applies a manifest default when the shot omits the field", async () => {
      const page = stubPage();
      await captureShot(page, shot(), 1, baseUrl, outDir, {
        delayMs: 2000,
        waitUntil: "domcontentloaded",
      });
      expect(page.waitForTimeout).toHaveBeenCalledWith(2000);
      expect(page.goto).toHaveBeenCalledWith(
        "https://myapp.example.com/dashboard",
        { waitUntil: "domcontentloaded", timeout: 30000 },
      );
    });

    it("lets a per-shot value override the manifest default", async () => {
      const page = stubPage();
      await captureShot(
        page,
        shot({ delayMs: 500, waitUntil: "load" }),
        1,
        baseUrl,
        outDir,
        { delayMs: 2000, waitUntil: "domcontentloaded" },
      );
      expect(page.waitForTimeout).toHaveBeenCalledWith(500);
      expect(page.goto).toHaveBeenCalledWith(
        "https://myapp.example.com/dashboard",
        { waitUntil: "load", timeout: 30000 },
      );
    });
  });
});

describe("pruneStaleScreenshots", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "reeltreat-prune-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("removes orphan pngs, keeps expected ones, and ignores non-png files", () => {
    writeFileSync(join(dir, "01-home.png"), "keep");
    writeFileSync(join(dir, "02-old.png"), "orphan");
    writeFileSync(join(dir, "notes.txt"), "not a png");

    const pruned = pruneStaleScreenshots(dir, ["01-home.png"]);

    expect(pruned).toEqual(["02-old.png"]);
    expect(existsSync(join(dir, "01-home.png"))).toBe(true);
    expect(existsSync(join(dir, "02-old.png"))).toBe(false);
    expect(existsSync(join(dir, "notes.txt"))).toBe(true); // untouched
  });

  it("no-ops on an empty directory", () => {
    expect(pruneStaleScreenshots(dir, ["01-home.png"])).toEqual([]);
  });

  it("no-ops on a missing directory", () => {
    expect(pruneStaleScreenshots(join(dir, "nope"), ["01-home.png"])).toEqual([]);
  });

  it("uses the same filename scheme capture writes", () => {
    expect(screenshotFilename(3, "dashboard")).toBe("03-dashboard.png");
  });
});

describe("pruneStaleOutputs", () => {
  let projectOutDir: string;
  let shotsDir: string;

  beforeEach(() => {
    projectOutDir = mkdtempSync(join(tmpdir(), "reeltreat-outputs-"));
    shotsDir = join(projectOutDir, "screenshots");
    mkdirSync(shotsDir, { recursive: true });
  });
  afterEach(() => {
    rmSync(projectOutDir, { recursive: true, force: true });
  });

  it("deletes curation.json when something was pruned", () => {
    writeFileSync(join(shotsDir, "01-home.png"), "keep");
    writeFileSync(join(shotsDir, "02-old.png"), "orphan");
    writeFileSync(join(projectOutDir, "curation.json"), "{}");

    const result = pruneStaleOutputs(projectOutDir, ["01-home.png"]);

    expect(result.pruned).toEqual(["02-old.png"]);
    expect(result.curationRemoved).toBe(true);
    expect(existsSync(join(projectOutDir, "curation.json"))).toBe(false);
  });

  it("keeps curation.json when nothing was pruned", () => {
    writeFileSync(join(shotsDir, "01-home.png"), "keep");
    writeFileSync(join(projectOutDir, "curation.json"), "{}");

    const result = pruneStaleOutputs(projectOutDir, ["01-home.png"]);

    expect(result.pruned).toEqual([]);
    expect(result.curationRemoved).toBe(false);
    expect(existsSync(join(projectOutDir, "curation.json"))).toBe(true);
  });
});
