import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { loadManifest, type Shot } from "./manifest.js";
import { assertManifestReady } from "./doctor.js";

/** Zero-padded 2-digit index, e.g. 1 -> "01". */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
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
): Promise<ShotCaptureResult> {
  const url = new URL(shot.path, baseUrl).href;

  let warning: string | undefined;
  try {
    await page.goto(url, { waitUntil: shot.waitUntil, timeout: shot.timeoutMs });
  } catch (err) {
    // Recover only if the page actually loaded a document; otherwise this is a
    // genuine navigation failure and should propagate.
    if (!(await pageHasDocument(page))) {
      throw err instanceof Error ? err : new Error(String(err));
    }
    warning = `navigation wait "${shot.waitUntil}" exceeded ${shot.timeoutMs}ms; captured the page as-is`;
  }

  if (shot.waitFor) {
    await page.waitForSelector(shot.waitFor, { timeout: shot.timeoutMs });
  }
  if (shot.delayMs) await page.waitForTimeout(shot.delayMs);

  const file = join(outDir, `${pad2(index)}-${shot.id}.png`);
  await page.screenshot({ path: file, fullPage: shot.fullPage });

  return { url, file, warning };
}

async function main(): Promise<void> {
  const project = process.argv[2];
  if (!project) {
    console.error("Usage: npm run capture -- <project>");
    process.exit(1);
  }

  assertManifestReady(project);
  const manifest = loadManifest(project);

  // Unchanged across login modes: both stealth and attach login write
  // auth/<project>.json, so capture consumes the same file either way.
  const statePath = resolve("auth", `${project}.json`);
  if (!existsSync(statePath)) {
    console.error(
      `No saved session at ${statePath}. Run: npm run login -- ${project} first`,
    );
    process.exit(1);
  }

  const outDir = resolve("out", project, "screenshots");
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: manifest.viewport,
    storageState: statePath,
  });
  const page = await context.newPage();

  const failed: string[] = [];
  const warned: string[] = [];
  for (let i = 0; i < manifest.shots.length; i++) {
    const shot = manifest.shots[i];
    try {
      const { url, file, warning } = await captureShot(
        page,
        shot,
        i + 1,
        manifest.baseUrl,
        outDir,
      );
      if (warning) {
        warned.push(shot.id);
        console.warn(`WARN ${shot.id}: ${warning}`);
      }
      console.log(`${shot.id}  ${url}  ->  ${file}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`FAILED ${shot.id}: ${msg}`);
      failed.push(shot.id);
    }
  }

  await browser.close();

  const captured = manifest.shots.length - failed.length;
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
  console.log(`\nCaptured ${captured} shot(s) to ${outDir}`);
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
