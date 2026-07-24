import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { loadManifest, type Manifest } from "./manifest.js";
import { validateCuration, type CurationResult } from "./curation-schema.js";
import { assertManifestReady } from "./doctor.js";
import {
  assertScreenshotDimensions,
  buildReel,
  resolveShotImagePath,
  screenshotPathsForManifest,
  type Reel,
} from "./reel.js";
import { curationPath, projectDir, renderRunDir, renderRunId } from "./paths.js";
import { cropToPixels, loadEdit, type Rect } from "./edit-schema.js";
import { CROSSFADE_FRAMES, type PosterProps, type ReelProps } from "../remotion/types.js";
import { withEsbuildTsconfig } from "../remotion/webpack-override.js";

/**
 * src/render.ts — the render CLI. Builds the frame-accurate reel (src/reel.ts),
 * bundles the Remotion project once, then renders an h264 video per requested
 * duration tier plus the hero poster still. Screenshots live in out/ (outside the
 * bundle's public/ dir), so each image is embedded as a data URI in inputProps —
 * keeping the bundle self-contained and the render reproducible.
 *
 * Usage: npm run render -- <project> [--duration 15] [--fps 30] [--all]
 */

const DEFAULT_DURATION = 15;
const DEFAULT_FPS = 30;

/** Read a local image into a data: URI, choosing the mime from its extension. */
function toDataUri(path: string): string {
  const ext = extname(path).toLowerCase();
  const mime =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : ext === ".gif"
          ? "image/gif"
          : ext === ".svg"
            ? "image/svg+xml"
            : "image/png";
  return `data:${mime};base64,${readFileSync(path).toString("base64")}`;
}

/** Viewport size the cropped output is resized back to. */
interface Size {
  width: number;
  height: number;
}

/**
 * Embed a screenshot as a data URI, applying a non-destructive crop when one is
 * set. A crop sub-rects the source (via sharp.extract) and resizes it back to the
 * full viewport with `fit: "fill"`, so the chosen rectangle becomes the whole
 * frame — matching the Studio crop preview exactly. Uncropped shots take the
 * plain read path. Results are memoized in `cache` because the same shot (and
 * crop) recurs across duration tiers and the poster.
 */
async function embedImage(
  path: string,
  crop: Rect | undefined,
  viewport: Size,
  cache: Map<string, string>,
): Promise<string> {
  const key = crop ? `${path}|${crop.x},${crop.y},${crop.w},${crop.h}` : path;
  const hit = cache.get(key);
  if (hit) return hit;

  let uri: string;
  if (!crop) {
    uri = toDataUri(path);
  } else {
    const meta = await sharp(path).metadata();
    const w = meta.width ?? viewport.width;
    const h = meta.height ?? viewport.height;
    const region = cropToPixels(crop, w, h);
    const buf = await sharp(path)
      .extract(region)
      .resize(viewport.width, viewport.height, { fit: "fill" })
      .png()
      .toBuffer();
    uri = `data:image/png;base64,${buf.toString("base64")}`;
  }
  cache.set(key, uri);
  return uri;
}

/** Human-readable file size for the summary line. */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/** Load and re-validate projects/<project>/curation.json (fails clearly if absent). */
function loadCuration(project: string, manifest: Manifest): CurationResult {
  const path = curationPath(project);
  if (!existsSync(path)) {
    throw new Error(
      `No curation at ${path}. Run: npm run curate -- ${project} first`,
    );
  }
  const record = JSON.parse(readFileSync(path, "utf8"));
  return validateCuration(record.curation, manifest.shots.map((s) => s.id));
}

/**
 * Convert the pure reel model into the composition's inputProps. Each scene's
 * screenshot is embedded as a data URI, cropped first when the scene carries a
 * crop rect (`cache` dedupes work across tiers).
 */
async function reelToProps(
  reel: Reel,
  logoSrc: string | undefined,
  viewport: Size,
  cache: Map<string, string>,
): Promise<ReelProps> {
  const brand = reel.titleCard.brand;
  return {
    fps: reel.fps,
    width: reel.width,
    height: reel.height,
    titleCard: {
      appName: reel.titleCard.appName,
      tagline: reel.titleCard.tagline,
      brand,
      durationInFrames: reel.titleCard.durationInFrames,
      logoSrc,
      crossfade: CROSSFADE_FRAMES,
    },
    scenes: await Promise.all(
      reel.scenes.map(async (s) => ({
        src: await embedImage(s.imagePath, s.crop, viewport, cache),
        callout: s.callout,
        durationInFrames: s.durationInFrames,
        fadeInFrames: CROSSFADE_FRAMES,
        kenBurns: s.kenBurns,
        brand,
      })),
    ),
  };
}

/** A progress event emitted during a render, consumed by the CLI and the bridge. */
export type RenderProgress =
  | { phase: "bundle" }
  | { phase: "render"; tier: number; frames: number; progress: number }
  | { phase: "poster" }
  | { phase: "done" };

/** One produced file from a render run. */
export interface RenderOutput {
  kind: "video" | "poster";
  /** Duration tier for a video; unset for the poster. */
  tier?: number;
  path: string;
  bytes: number;
}

export interface RenderResult {
  /** Unique id for this run; also the name of its renders/ subfolder. */
  runId: string;
  /** Absolute renders/<runId>/ directory the outputs were written to. */
  dir: string;
  /** Duration tiers rendered, ascending. */
  tiers: number[];
  outputs: RenderOutput[];
}

export interface RenderOptions {
  project: string;
  /** Single tier to render when `all` is false. Default 15. */
  duration?: number;
  /** Render every tier present in the curation instead of just `duration`. */
  all?: boolean;
  /** Frame rate. Default 30. */
  fps?: number;
  /** Progress callback for the CLI/bridge to surface. */
  onProgress?: (p: RenderProgress) => void;
  /** Clock for the run id — injectable so tests are deterministic. Default now. */
  now?: Date;
}

/**
 * Render a project's reel(s) + poster into a fresh renders/<runId>/ folder and
 * return the produced files. Importable (no argv/exit/bundle-caching concerns in
 * the caller) so both the CLI and the Studio bridge drive it the same way. Each
 * call writes to a unique run folder, so previously rendered videos are never
 * overwritten. Assumes the manifest is ready and curation exists; the caller is
 * responsible for those pre-flight checks (the CLI calls assertManifestReady,
 * the bridge returns a structured error).
 */
export async function renderProject(opts: RenderOptions): Promise<RenderResult> {
  const project = opts.project;
  const fps = opts.fps ?? DEFAULT_FPS;
  const duration = opts.duration ?? DEFAULT_DURATION;
  const emit = opts.onProgress ?? (() => {});

  const manifest = loadManifest(project);
  const curation = loadCuration(project, manifest);
  // Non-destructive per-shot crops, layered over the AI curation at render time.
  const crops = loadEdit(project).crops;
  // Cropped/embedded data URIs are reused across tiers and the poster.
  const embedCache = new Map<string, string>();

  // Escape hatch for offline / locked-down environments: point Remotion at an
  // already-installed Chrome/Chromium instead of letting it download its headless
  // shell (which needs network access to remotion.media). Unset by default.
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;

  const projDir = projectDir(project);
  const runId = renderRunId(opts.now ?? new Date());
  const outDir = renderRunDir(project, runId);
  mkdirSync(outDir, { recursive: true });
  // The tool's own repo root, used only to locate the Remotion bundle entry —
  // distinct from projDir (the project's asset folder).
  const repoRoot = resolve(".");

  // Guard before the expensive bundle: every captured screenshot must match the
  // manifest viewport. A file left from an older viewport setting would jump in
  // size and letterbox in the full-bleed scenes. Only check files that exist —
  // a genuinely missing shot is reported later by resolveShotImagePath.
  const screenshots = screenshotPathsForManifest(manifest, projDir)
    .map((s) => s.path)
    .filter((p) => existsSync(p));
  await assertScreenshotDimensions(screenshots, manifest.viewport, async (p) => {
    const meta = await sharp(p).metadata();
    if (!meta.width || !meta.height) {
      throw new Error(`could not read image dimensions: ${p}`);
    }
    return { width: meta.width, height: meta.height };
  });

  const tiers = opts.all
    ? Object.keys(curation.cuts).map(Number).sort((a, b) => a - b)
    : [duration];

  // Resolve the brand logo once (if any), reused by every reel and the poster.
  let logoSrc: string | undefined;
  if (manifest.brand.logoPath) {
    const logoPath = isAbsolute(manifest.brand.logoPath)
      ? manifest.brand.logoPath
      : resolve(projDir, manifest.brand.logoPath);
    if (existsSync(logoPath)) logoSrc = toDataUri(logoPath);
    else console.warn(`brand.logoPath not found at ${logoPath}; rendering without a logo`);
  }

  // Bundle once — reused across every tier and the poster (bundling per render
  // is an anti-pattern).
  emit({ phase: "bundle" });
  const serveUrl = await bundle({
    entryPoint: resolve(repoRoot, "remotion", "index.ts"),
    webpackOverride: withEsbuildTsconfig,
  });
  // Applied to every selectComposition/render call below when set.
  const browserOpt = browserExecutable ? { browserExecutable } : {};

  const outputs: RenderOutput[] = [];

  for (const tier of tiers) {
    const reel = buildReel({ manifest, curation, durationSeconds: tier, fps, projectDir: projDir, crops });
    const inputProps = (await reelToProps(
      reel,
      logoSrc,
      manifest.viewport,
      embedCache,
    )) as unknown as Record<string, unknown>;

    const composition = await selectComposition({ serveUrl, id: "Reel", inputProps, ...browserOpt });
    const outputLocation = join(outDir, `demo-${tier}s.mp4`);

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation,
      inputProps,
      ...browserOpt,
      onProgress: ({ progress }) =>
        emit({ phase: "render", tier, frames: composition.durationInFrames, progress }),
    });
    outputs.push({
      kind: "video",
      tier,
      path: outputLocation,
      bytes: statSync(outputLocation).size,
    });
  }

  // Hero poster still (duration-independent, rendered once).
  const heroPath = resolveShotImagePath(manifest, curation.heroShotId, projDir);
  const posterProps: PosterProps = {
    fps,
    width: manifest.viewport.width,
    height: manifest.viewport.height,
    appName: manifest.name,
    tagline: curation.tagline,
    brand: {
      primaryColor: manifest.brand.primaryColor,
      accentColor: manifest.brand.accentColor,
      font: manifest.brand.font,
    },
    src: await embedImage(heroPath, crops[curation.heroShotId], manifest.viewport, embedCache),
    logoSrc,
  };
  const posterInput = posterProps as unknown as Record<string, unknown>;
  const posterComposition = await selectComposition({
    serveUrl,
    id: "Poster",
    inputProps: posterInput,
    ...browserOpt,
  });
  const posterOut = join(outDir, "poster.png");
  emit({ phase: "poster" });
  await renderStill({
    composition: posterComposition,
    serveUrl,
    output: posterOut,
    frame: 0,
    inputProps: posterInput,
    imageFormat: "png",
    ...browserOpt,
  });
  outputs.push({ kind: "poster", path: posterOut, bytes: statSync(posterOut).size });

  emit({ phase: "done" });
  return { runId, dir: outDir, tiers, outputs };
}

interface RenderArgs {
  project: string;
  duration: number;
  fps: number;
  all: boolean;
}

function parseArgs(argv: string[]): RenderArgs {
  const args = argv.slice(2);
  const project = args.find((a) => !a.startsWith("--"));
  if (!project) {
    throw new Error(
      "Usage: npm run render -- <project> [--duration 15] [--fps 30] [--all]",
    );
  }
  const durationIdx = args.indexOf("--duration");
  const fpsIdx = args.indexOf("--fps");
  return {
    project,
    duration: durationIdx >= 0 ? Number(args[durationIdx + 1]) : DEFAULT_DURATION,
    fps: fpsIdx >= 0 ? Number(args[fpsIdx + 1]) : DEFAULT_FPS,
    all: args.includes("--all"),
  };
}

async function main(): Promise<void> {
  const started = Date.now();
  const { project, duration, fps, all } = parseArgs(process.argv);

  // CLI-only pre-flight: exit loudly on an unresolved manifest. The bridge does
  // its own readiness check instead of exiting the process.
  assertManifestReady(project);

  let lastTier: number | undefined;
  const result = await renderProject({
    project,
    duration,
    all,
    fps,
    onProgress: (p) => {
      if (p.phase === "bundle") console.log("bundling Remotion project…");
      else if (p.phase === "render") {
        if (p.tier !== lastTier) {
          if (lastTier !== undefined) process.stdout.write("\n");
          console.log(`rendering ${p.tier}s reel (${p.frames} frames)…`);
          lastTier = p.tier;
        }
        process.stdout.write(`\r  ${p.tier}s: ${Math.round(p.progress * 100)}%   `);
      } else if (p.phase === "poster") {
        if (lastTier !== undefined) process.stdout.write("\n");
        console.log("rendering poster…");
      }
    },
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\nDone (run ${result.runId}):`);
  for (const o of result.outputs) console.log(`  ${o.path}  (${formatBytes(o.bytes)})`);
  console.log(`\nRendered in ${elapsed}s`);
}

/** True when this file is run directly (not imported by tests). */
function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return resolve(entry) === resolve(fileURLToPath(import.meta.url));
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
