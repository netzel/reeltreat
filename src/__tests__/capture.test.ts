import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { captureShot } from "../capture.js";
import type { Shot } from "../manifest.js";

/** A stub Page with vi.fn() for every method captureShot touches. */
function stubPage() {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(undefined),
  };
}

function shot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: "dashboard",
    path: "/dashboard",
    caption: "Overview",
    fullPage: false,
    ...overrides,
  };
}

const baseUrl = "https://myapp.example.com";
const outDir = join("out", "myapp", "screenshots");

describe("captureShot", () => {
  it("resolves the shot path against the base URL", async () => {
    const page = stubPage();
    const { url } = await captureShot(page, shot(), 1, baseUrl, outDir);

    expect(url).toBe("https://myapp.example.com/dashboard");
    expect(page.goto).toHaveBeenCalledWith("https://myapp.example.com/dashboard");
    expect(page.waitForLoadState).toHaveBeenCalledWith("networkidle");
  });

  it("awaits waitFor when present", async () => {
    const page = stubPage();
    await captureShot(page, shot({ waitFor: "#ready" }), 1, baseUrl, outDir);
    expect(page.waitForSelector).toHaveBeenCalledWith("#ready");
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

  it("propagates an error thrown by page.goto", async () => {
    const page = stubPage();
    page.goto.mockRejectedValue(new Error("navigation failed"));
    await expect(captureShot(page, shot(), 1, baseUrl, outDir)).rejects.toThrow(
      "navigation failed",
    );
  });
});
