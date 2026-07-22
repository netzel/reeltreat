import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { loadManifest, type Manifest } from "./manifest.js";
import { validateCuration, type CurationResult } from "./curation-schema.js";
import { assertManifestReady } from "./doctor.js";
import { buildReel, resolveShotImagePath, type Reel } from "./reel.js";
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

/** Human-readable file size for the summary line. */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/** Load and re-validate out/<project>/curation.json (fails clearly if absent). */
function loadCuration(project: string, manifest: Manifest): CurationResult {
  const path = resolve("out", project, "curation.json");
  if (!existsSync(path)) {
    throw new Error(
      `No curation at ${path}. Run: npm run curate -- ${project} first`,
    );
  }
  const record = JSON.parse(readFileSync(path, "utf8"));
  return validateCuration(record.curation, manifest.shots.map((s) => s.id));
}

/** Convert the pure reel model into the composition's inputProps (data URIs). */
function reelToProps(reel: Reel, logoSrc: string | undefined): ReelProps {
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
    scenes: reel.scenes.map((s) => ({
      src: toDataUri(s.imagePath),
      callout: s.callout,
      durationInFrames: s.durationInFrames,
      fadeInFrames: CROSSFADE_FRAMES,
      kenBurns: s.kenBurns,
      brand,
    })),
  };
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

  assertManifestReady(project);
  const manifest = loadManifest(project);
  const curation = loadCuration(project, manifest);

  const outDir = resolve("out", project);
  const repoRoot = resolve(".");

  // Which tiers to render.
  const tiers = all
    ? Object.keys(curation.cuts).map(Number).sort((a, b) => a - b)
    : [duration];

  // Resolve the brand logo once (if any), reused by every reel and the poster.
  let logoSrc: string | undefined;
  if (manifest.brand.logoPath) {
    const logoPath = isAbsolute(manifest.brand.logoPath)
      ? manifest.brand.logoPath
      : resolve(repoRoot, manifest.brand.logoPath);
    if (existsSync(logoPath)) logoSrc = toDataUri(logoPath);
    else console.warn(`brand.logoPath not found at ${logoPath}; rendering without a logo`);
  }

  // Bundle once — reused across every tier and the poster (see /docs/bundle:
  // bundling per render is an anti-pattern).
  console.log("bundling Remotion project…");
  const serveUrl = await bundle({
    entryPoint: resolve(repoRoot, "remotion", "index.ts"),
    webpackOverride: withEsbuildTsconfig,
  });

  const outputs: { path: string; bytes: number }[] = [];

  for (const tier of tiers) {
    const reel = buildReel({ manifest, curation, durationSeconds: tier, fps });
    const inputProps = reelToProps(reel, logoSrc) as unknown as Record<string, unknown>;

    const composition = await selectComposition({ serveUrl, id: "Reel", inputProps });
    const outputLocation = join(outDir, `demo-${tier}s.mp4`);

    console.log(`rendering ${tier}s reel (${composition.durationInFrames} frames)…`);
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation,
      inputProps,
      onProgress: ({ progress }) => {
        process.stdout.write(`\r  ${tier}s: ${Math.round(progress * 100)}%   `);
      },
    });
    process.stdout.write("\n");
    outputs.push({ path: outputLocation, bytes: statSync(outputLocation).size });
  }

  // Hero poster still (duration-independent, rendered once).
  const heroPath = resolveShotImagePath(manifest, curation.heroShotId, outDir);
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
    src: toDataUri(heroPath),
    logoSrc,
  };
  const posterInput = posterProps as unknown as Record<string, unknown>;
  const posterComposition = await selectComposition({
    serveUrl,
    id: "Poster",
    inputProps: posterInput,
  });
  const posterOut = join(outDir, "poster.png");
  console.log("rendering poster…");
  await renderStill({
    composition: posterComposition,
    serveUrl,
    output: posterOut,
    frame: 0,
    inputProps: posterInput,
    imageFormat: "png",
  });
  outputs.push({ path: posterOut, bytes: statSync(posterOut).size });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log("\nDone:");
  for (const o of outputs) console.log(`  ${o.path}  (${formatBytes(o.bytes)})`);
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
