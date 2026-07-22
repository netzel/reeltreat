import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { chromium, type Browser, type Page } from "playwright";
import {
  isImageShot,
  loadManifest,
  resolveShotSettings,
  type Manifest,
  type Shot,
  type ShotDefaults,
} from "./manifest.js";
import { assertManifestReady } from "./doctor.js";

/** Zero-padded 2-digit index, e.g. 1 -> "01". */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Output filename for a shot at a 1-based index — the single source of naming. */
export function screenshotFilename(index: number, shotId: string): string {
  return `${pad2(index)}-${shotId}.png`;
}

/**
 * Delete any .png in `screenshotsDir` that is not in `expectedFilenames`, so a
 * renamed/reordered/removed shot doesn't leave an orphan that still feeds
 * curation. Only touches .png files directly in that directory; never recurses,
 * never removes other file types, and no-ops on a missing/empty directory.
 * Returns the basenames that were pruned.
 */
export function pruneStaleScreenshots(
  screenshotsDir: string,
  expectedFilenames: string[],
): string[] {
  if (!existsSync(screenshotsDir)) return [];
  const expected = new Set(expectedFilenames);
  const pruned: string[] = [];
  for (const name of readdirSync(screenshotsDir)) {
    if (!name.toLowerCase().endsWith(".png")) continue;
    if (expected.has(name)) continue;
    rmSync(join(screenshotsDir, name));
    pruned.push(name);
  }
  return pruned;
}

export interface PruneResult {
  pruned: string[];
  curationRemoved: boolean;
}

/**
 * Prune stale screenshots for a project and, if anything was pruned, delete the
 * now-stale curation.json (it references shots that may no longer exist).
 * `projectOutDir` is out/<project>; screenshots live in its screenshots/ subdir.
 */
export function pruneStaleOutputs(
  projectOutDir: string,
  expectedFilenames: string[],
): PruneResult {
  const pruned = pruneStaleScreenshots(
    join(projectOutDir, "screenshots"),
    expectedFilenames,
  );
  let curationRemoved = false;
  if (pruned.length > 0) {
    const curationPath = join(projectOutDir, "curation.json");
    if (existsSync(curationPath)) {
      rmSync(curationPath);
      curationRemoved = true;
    }
  }
  return { pruned, curationRemoved };
}

export interface ImageShotResult {
  /** Destination PNG written into the screenshots dir. */
  file: string;
  /** Resolved absolute source path that was copied/converted. */
  source: string;
}

/**
 * Resolve a manual image shot — no browser involved. Verify the user-supplied
 * source exists, then write it into `outDir` under the same NN-<id>.png naming
 * as a browser capture, converting to PNG when the source isn't already PNG.
 * Because the file lands in the same place with the same name, everything
 * downstream (curate, and the future render step) is agnostic to how the
 * screenshot was produced.
 *
 * @param manifestDir base dir that a relative `image` path resolves against (the repo root).
 * @param index 1-based position, used for the output filename prefix.
 */
export async function resolveImageShot(
  shot: Shot,
  index: number,
  manifestDir: string,
  outDir: string,
): Promise<ImageShotResult> {
  if (shot.image === undefined) {
    throw new Error(`resolveImageShot called on a non-image shot: "${shot.id}"`);
  }

  const source = isAbsolute(shot.image)
    ? shot.image
    : resolve(manifestDir, shot.image);

  if (!existsSync(source)) {
    throw new Error(
      `image shot "${shot.id}": source file not found at ${source}`,
    );
  }

  const file = join(outDir, screenshotFilename(index, shot.id));
  if (source.toLowerCase().endsWith(".png")) {
    // Already PNG — a straight copy preserves it exactly.
    copyFileSync(source, file);
  } else {
    // JPEG / WebP / etc. — normalize to PNG so downstream never has to care.
    await sharp(source).png().toFile(file);
  }

  return { file, source };
}

/** The methods captureShot drives — kept narrow so tests can stub a fake page. */
type CapturePage = Pick<
  Page,
  "goto" | "waitForSelector" | "waitForTimeout" | "screenshot" | "evaluate"
>;

export interface ShotCaptureResult {
  url: string;
  file: string;
  /** Set when navigation timed out but the page had rendered content anyway. */
  warning?: string;
}

/**
 * True if the page produced a document — used to decide whether a navigation
 * timeout is recoverable (page rendered, connection just stayed open) or a real
 * failure (nothing loaded). Uses the string form of evaluate so no DOM lib is
 * needed at build time.
 */
async function pageHasDocument(page: CapturePage): Promise<boolean> {
  try {
    const readyState = await page.evaluate("document.readyState");
    return typeof readyState === "string" && readyState.length > 0;
  } catch {
    return false;
  }
}

/**
 * Capture a single shot. Exported (and dependency-injected via `page`) so it
 * can be unit-tested without launching a real browser.
 *
 * Navigation uses the shot's `waitUntil`/`timeoutMs`. A navigation-wait timeout
 * does NOT abandon the shot: pages that hold an open connection (streaming,
 * polling, websockets) render fine but never satisfy stricter waits. When goto
 * times out we verify the page has a document and, if so, screenshot it anyway,
 * returning a `warning`. The shot only truly fails if there is no document or
 * the screenshot itself throws.
 *
 * @param index 1-based position, used for the output filename prefix.
 * @returns the final URL, the file written, and an optional warning.
 */
export async function captureShot(
  page: CapturePage,
  shot: Shot,
  index: number,
  baseUrl: string,
  outDir: string,
  defaults: ShotDefaults = {},
): Promise<ShotCaptureResult> {
  if (shot.path === undefined) {
    throw new Error(`captureShot called on an image shot: "${shot.id}"`);
  }
  const settings = resolveShotSettings(shot, defaults);
  const url = new URL(shot.path, baseUrl).href;

  let warning: string | undefined;
  try {
    await page.goto(url, {
      waitUntil: settings.waitUntil,
      timeout: settings.timeoutMs,
    });
  } catch (err) {
    // Recover only if the page actually loaded a document; otherwise this is a
    // genuine navigation failure and should propagate.
    if (!(await pageHasDocument(page))) {
      throw err instanceof Error ? err : new Error(String(err));
    }
    warning = `navigation wait "${settings.waitUntil}" exceeded ${settings.timeoutMs}ms; captured the page as-is`;
  }

  if (settings.waitFor) {
    await page.waitForSelector(settings.waitFor, { timeout: settings.timeoutMs });
  }
  if (settings.delayMs) await page.waitForTimeout(settings.delayMs);

  const file = join(outDir, screenshotFilename(index, shot.id));
  await page.screenshot({ path: file, fullPage: settings.fullPage });

  return { url, file, warning };
}

/** One shot's outcome from a capture run. */
export interface ShotRunResult {
  id: string;
  file: string;
  kind: "browser" | "manual";
}

export interface CaptureRunResult {
  results: ShotRunResult[];
  failed: string[];
  warned: string[];
  browserLaunched: boolean;
}

export interface CaptureProjectOptions {
  manifest: Manifest;
  /** Base dir relative image paths resolve against (the repo root). */
  repoRoot: string;
  /** out/<project>/screenshots — where every shot is written. */
  outDir: string;
  /** Saved Playwright session, used only when there is a browser shot. */
  statePath: string;
}

/**
 * Run every shot in a manifest. Manual image shots skip the browser entirely; a
 * browser is launched only if at least one shot is an actual browser capture,
 * so an image-only manifest never starts Chromium. Exported and free of
 * argv/exit concerns so it can be tested with a mocked playwright.
 */
export async function captureProject(
  opts: CaptureProjectOptions,
): Promise<CaptureRunResult> {
  const { manifest, repoRoot, outDir, statePath } = opts;
  const results: ShotRunResult[] = [];
  const failed: string[] = [];
  const warned: string[] = [];

  const hasBrowserShot = manifest.shots.some((s) => !isImageShot(s));

  let browser: Browser | undefined;
  let page: CapturePage | undefined;
  if (hasBrowserShot) {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: manifest.viewport,
      storageState: statePath,
    });
    page = await context.newPage();
  }

  for (let i = 0; i < manifest.shots.length; i++) {
    const shot = manifest.shots[i];
    const index = i + 1;
    try {
      if (isImageShot(shot)) {
        const { file, source } = await resolveImageShot(
          shot,
          index,
          repoRoot,
          outDir,
        );
        console.log(`${shot.id}  (manual: ${source})  ->  ${file}`);
        results.push({ id: shot.id, file, kind: "manual" });
      } else {
        if (!page) {
          throw new Error(`internal: no browser page for shot "${shot.id}"`);
        }
        const { url, file, warning } = await captureShot(
          page,
          shot,
          index,
          manifest.baseUrl,
          outDir,
          manifest.defaults,
        );
        if (warning) {
          warned.push(shot.id);
          console.warn(`WARN ${shot.id}: ${warning}`);
        }
        console.log(`${shot.id}  ${url}  ->  ${file}`);
        results.push({ id: shot.id, file, kind: "browser" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`FAILED ${shot.id}: ${msg}`);
      failed.push(shot.id);
    }
  }

  if (browser) await browser.close();

  return { results, failed, warned, browserLaunched: browser !== undefined };
}

async function main(): Promise<void> {
  const project = process.argv[2];
  if (!project) {
    console.error("Usage: npm run capture -- <project>");
    process.exit(1);
  }

  assertManifestReady(project);
  const manifest = loadManifest(project);
  const repoRoot = resolve(".");

  // A saved session is only needed when we actually drive a browser; an
  // image-only manifest can run with no login at all.
  const hasBrowserShot = manifest.shots.some((s) => !isImageShot(s));
  // Unchanged across login modes: both stealth and attach login write
  // auth/<project>.json, so capture consumes the same file either way.
  const statePath = resolve("auth", `${project}.json`);
  if (hasBrowserShot && !existsSync(statePath)) {
    console.error(
      `No saved session at ${statePath}. Run: npm run login -- ${project} first`,
    );
    process.exit(1);
  }

  const projectOutDir = resolve("out", project);
  const outDir = join(projectOutDir, "screenshots");
  mkdirSync(outDir, { recursive: true });

  // Prune screenshots left over from a previous run (renamed/reordered/removed
  // shots) before capturing, so curation never sees an orphan.
  const expected = manifest.shots.map((s, i) => screenshotFilename(i + 1, s.id));
  const { pruned, curationRemoved } = pruneStaleOutputs(projectOutDir, expected);
  for (const name of pruned) console.log(`pruned stale screenshot: ${name}`);
  if (curationRemoved) {
    console.log(
      "removed stale curation.json — re-run curate after capture to regenerate it",
    );
  }

  const { results, failed, warned } = await captureProject({
    manifest,
    repoRoot,
    outDir,
    statePath,
  });

  if (warned.length > 0) {
    console.log(
      `\n${warned.length} shot(s) captured with warnings: ${warned.join(", ")}`,
    );
  }
  if (failed.length > 0) {
    // Only genuine failures drive a non-zero exit; warnings still produced a shot.
    console.error(`\n${failed.length} shot(s) failed: ${failed.join(", ")}`);
    process.exit(1);
  }
  console.log(`\nCaptured ${results.length} shot(s) to ${outDir}`);
}

/** True when this file is run directly (not imported by tests). */
function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
