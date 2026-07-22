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

/**
 * Capture a single shot. Exported (and dependency-injected via `page`) so it
 * can be unit-tested without launching a real browser.
 *
 * @param index 1-based position, used for the output filename prefix.
 * @returns the final URL and the file it was written to.
 */
export async function captureShot(
  page: Pick<
    Page,
    "goto" | "waitForLoadState" | "waitForSelector" | "waitForTimeout" | "screenshot"
  >,
  shot: Shot,
  index: number,
  baseUrl: string,
  outDir: string,
): Promise<{ url: string; file: string }> {
  const url = new URL(shot.path, baseUrl).href;
  await page.goto(url);
  await page.waitForLoadState("networkidle");

  if (shot.waitFor) await page.waitForSelector(shot.waitFor);
  if (shot.delayMs) await page.waitForTimeout(shot.delayMs);

  const file = join(outDir, `${pad2(index)}-${shot.id}.png`);
  await page.screenshot({ path: file, fullPage: shot.fullPage });

  return { url, file };
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
  for (let i = 0; i < manifest.shots.length; i++) {
    const shot = manifest.shots[i];
    try {
      const { url, file } = await captureShot(
        page,
        shot,
        i + 1,
        manifest.baseUrl,
        outDir,
      );
      console.log(`${shot.id}  ${url}  ->  ${file}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`FAILED ${shot.id}: ${msg}`);
      failed.push(shot.id);
    }
  }

  await browser.close();

  if (failed.length > 0) {
    console.error(`\n${failed.length} shot(s) failed: ${failed.join(", ")}`);
    process.exit(1);
  }
  console.log(`\nCaptured ${manifest.shots.length} shot(s) to ${outDir}`);
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
