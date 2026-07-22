import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { captureShot } from "../capture.js";
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
});
