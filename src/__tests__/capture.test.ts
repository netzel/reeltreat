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
import sharp from "sharp";
import {
  captureProject,
  captureShot,
  pruneStaleOutputs,
  pruneStaleScreenshots,
  resolveImageShot,
  screenshotFilename,
} from "../capture.js";
import { ManifestSchema, ShotSchema, type Shot } from "../manifest.js";

// Mock playwright so captureProject can be exercised without a real browser.
// captureShot's own tests pass a hand-built stub page and never touch this.
const pw = vi.hoisted(() => {
  const screenshot = vi.fn().mockResolvedValue(undefined);
  const page = {
    goto: vi.fn().mockResolvedValue(undefined),
    screenshot,
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue("complete"),
  };
  const context = { newPage: vi.fn().mockResolvedValue(page) };
  const browser = {
    newContext: vi.fn().mockResolvedValue(context),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const launch = vi.fn().mockResolvedValue(browser);
  return { launch, browser, context, page, screenshot };
});

vi.mock("playwright", () => ({ chromium: { launch: pw.launch } }));

/** 8x8 solid image written in the given format, for image-shot tests. */
async function writeImage(path: string, format: "png" | "jpeg"): Promise<void> {
  const img = sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } },
  });
  await (format === "png" ? img.png() : img.jpeg()).toFile(path);
}

/** A solid image of an explicit size (default a distinctive non-black color). */
async function writeSized(
  path: string,
  width: number,
  height: number,
  background = { r: 10, g: 20, b: 30 },
): Promise<void> {
  await sharp({ create: { width, height, channels: 3, background } }).png().toFile(path);
}

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

describe("resolveImageShot", () => {
  let repoRoot: string;
  let outDir: string;

  // A 4:3 viewport, so a square source visibly crops (cover) or pads (contain).
  const viewport = { width: 400, height: 300 };

  const imgShot = (image: string, extra: Partial<Shot> = {}): Shot =>
    ShotSchema.parse({ id: "mic", caption: "Mic", image, ...extra });

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "reeltreat-img-"));
    outDir = join(repoRoot, "out", "screenshots");
    mkdirSync(outDir, { recursive: true });
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it("writes a relative image to NN-<id>.png, resolved against the repo root", async () => {
    await writeImage(join(repoRoot, "mic.png"), "png");
    const { file, source } = await resolveImageShot(imgShot("mic.png"), 2, repoRoot, outDir, viewport);

    expect(file).toBe(join(outDir, "02-mic.png"));
    expect(source).toBe(join(repoRoot, "mic.png"));
    expect(existsSync(file)).toBe(true);
  });

  it("throws a clear error naming the shot id and resolved path when the source is missing", async () => {
    await expect(
      resolveImageShot(imgShot("nope.png"), 1, repoRoot, outDir, viewport),
    ).rejects.toThrow(/image shot "mic": source file not found at .*nope\.png/);
  });

  it("converts a JPEG source to PNG", async () => {
    await writeImage(join(repoRoot, "mic.jpg"), "jpeg");
    const { file } = await resolveImageShot(imgShot("mic.jpg"), 1, repoRoot, outDir, viewport);

    const meta = await sharp(file).metadata();
    expect(meta.format).toBe("png");
  });

  it("honors an absolute source path", async () => {
    const abs = join(repoRoot, "abs.png");
    await writeImage(abs, "png");
    const otherBase = mkdtempSync(join(tmpdir(), "reeltreat-other-"));

    const { source, file } = await resolveImageShot(imgShot(abs), 1, otherBase, outDir, viewport);

    expect(source).toBe(abs); // absolute, not joined onto otherBase
    expect(existsSync(file)).toBe(true);
    rmSync(otherBase, { recursive: true, force: true });
  });

  it("downscales a larger image to exactly the viewport dimensions", async () => {
    await writeSized(join(repoRoot, "big.png"), 1200, 900); // same 4:3 aspect
    const r = await resolveImageShot(imgShot("big.png"), 1, repoRoot, outDir, viewport);

    const meta = await sharp(r.file).metadata();
    expect([meta.width, meta.height]).toEqual([400, 300]);
    expect([r.outputWidth, r.outputHeight]).toEqual([400, 300]);
    expect([r.sourceWidth, r.sourceHeight]).toEqual([1200, 900]);
    expect(r.aspectWarning).toBeUndefined(); // same aspect, no crop/pad
  });

  it("upscales a smaller image to exactly the viewport dimensions", async () => {
    await writeSized(join(repoRoot, "small.png"), 40, 30); // same 4:3 aspect
    const { file } = await resolveImageShot(imgShot("small.png"), 1, repoRoot, outDir, viewport);

    const meta = await sharp(file).metadata();
    expect([meta.width, meta.height]).toEqual([400, 300]);
  });

  it("center-crops a different aspect to the viewport with default fit (cover)", async () => {
    await writeSized(join(repoRoot, "square.png"), 400, 400, { r: 200, g: 50, b: 50 });
    const r = await resolveImageShot(imgShot("square.png"), 1, repoRoot, outDir, viewport);

    expect(r.fit).toBe("cover");
    const img = sharp(r.file);
    const meta = await img.metadata();
    expect([meta.width, meta.height]).toEqual([400, 300]); // exact viewport
    // Cover fills the frame, so the top-left pixel is the (cropped) image, not padding.
    const [r0, g0, b0] = await img.extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
    expect([r0, g0, b0]).toEqual([200, 50, 50]);
  });

  it("pads a different aspect to the viewport with fit 'contain'", async () => {
    await writeSized(join(repoRoot, "square2.png"), 400, 400, { r: 200, g: 50, b: 50 });
    const r = await resolveImageShot(
      imgShot("square2.png", { fit: "contain", background: "#000000" }),
      1,
      repoRoot,
      outDir,
      viewport,
    );

    expect(r.fit).toBe("contain");
    const img = sharp(r.file);
    const meta = await img.metadata();
    expect([meta.width, meta.height]).toEqual([400, 300]); // exact viewport
    // Contain letterboxes a 1:1 source into 4:3: the top-left pixel is padding.
    const [r0, g0, b0] = await img.extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
    expect([r0, g0, b0]).toEqual([0, 0, 0]);
  });

  it("warns when the source aspect differs from the viewport beyond the threshold", async () => {
    await writeSized(join(repoRoot, "wide.png"), 400, 100); // 4:1 vs 4:3
    const { aspectWarning } = await resolveImageShot(imgShot("wide.png"), 1, repoRoot, outDir, viewport);

    expect(aspectWarning).toBeDefined();
    expect(aspectWarning).toContain("mic");
    expect(aspectWarning).toContain("cropping");
  });

  it("does not warn when the source aspect is close to the viewport", async () => {
    await writeSized(join(repoRoot, "near.png"), 396, 300); // ~1% off 4:3
    const { aspectWarning } = await resolveImageShot(imgShot("near.png"), 1, repoRoot, outDir, viewport);

    expect(aspectWarning).toBeUndefined();
  });
});

describe("captureProject", () => {
  let repoRoot: string;
  let outDir: string;

  const manifest = (shots: unknown[]) =>
    ManifestSchema.parse({
      name: "myapp",
      baseUrl: "https://myapp.example.com",
      shots,
    });

  beforeEach(() => {
    pw.launch.mockClear();
    pw.screenshot.mockClear();
    repoRoot = mkdtempSync(join(tmpdir(), "reeltreat-run-"));
    outDir = join(repoRoot, "out", "screenshots");
    mkdirSync(outDir, { recursive: true });
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it("never launches a browser for an all-image manifest", async () => {
    await writeImage(join(repoRoot, "a.png"), "png");

    const result = await captureProject({
      manifest: manifest([{ id: "a", caption: "A", image: "a.png" }]),
      repoRoot,
      outDir,
      statePath: "unused.json",
    });

    expect(pw.launch).not.toHaveBeenCalled();
    expect(result.browserLaunched).toBe(false);
    expect(result.results).toEqual([
      { id: "a", file: join(outDir, "01-a.png"), kind: "manual" },
    ]);
    expect(existsSync(join(outDir, "01-a.png"))).toBe(true);
  });

  it("captures browser shots and resolves image shots into correctly ordered filenames", async () => {
    await writeImage(join(repoRoot, "mic.png"), "png");

    const result = await captureProject({
      manifest: manifest([
        { id: "home", path: "/home", caption: "Home" },
        { id: "mic", caption: "Mic", image: "mic.png" },
        { id: "about", path: "/about", caption: "About" },
      ]),
      repoRoot,
      outDir,
      statePath: "auth.json",
    });

    expect(pw.launch).toHaveBeenCalledTimes(1);
    expect(result.results.map((r) => r.file)).toEqual([
      join(outDir, "01-home.png"),
      join(outDir, "02-mic.png"),
      join(outDir, "03-about.png"),
    ]);
    expect(result.results.map((r) => r.kind)).toEqual(["browser", "manual", "browser"]);

    // Browser shots screenshot to their ordered paths; the image shot is a real file.
    expect(pw.screenshot).toHaveBeenCalledWith({
      path: join(outDir, "01-home.png"),
      fullPage: false,
    });
    expect(pw.screenshot).toHaveBeenCalledWith({
      path: join(outDir, "03-about.png"),
      fullPage: false,
    });
    expect(existsSync(join(outDir, "02-mic.png"))).toBe(true);
  });
});
