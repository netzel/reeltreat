import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { screenshotFilename } from "./capture.js";
import type { Manifest } from "./manifest.js";
import type { CurationResult } from "./curation-schema.js";
import type { KenBurns, ReelBrand } from "../remotion/types.js";

/**
 * src/reel.ts — the pure, fully testable video model. Given a manifest, a
 * curation, a target duration and fps, it produces the frame-accurate plan the
 * Remotion "Reel" composition renders: a title card plus a list of Ken Burns
 * scenes. It performs NO rendering and reads the filesystem only to confirm each
 * scene's screenshot exists (throwing a clear error naming the shot if not).
 */

/** Title card sizing (seconds). Base length, scaled down for short cuts, floored. */
const TITLE_BASE_SECONDS = 1.2;
const TITLE_MIN_SECONDS = 0.8;
/** Total at/above which the title card reaches its full base length. */
const TITLE_REF_SECONDS = 15;

/** Per-scene bounds (seconds). */
const MAX_SCENE_SECONDS = 5;
const MIN_SCENE_SECONDS = 1.2;

const EPS = 1e-9;

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

/** One scene in the reel: a screenshot with its callout, duration and camera move. */
export interface ReelScene {
  shotId: string;
  /** Absolute path to the captured screenshot for this shot. */
  imagePath: string;
  callout: string;
  durationInFrames: number;
  kenBurns: KenBurns;
}

/** The animated opening card. */
export interface ReelTitleCard {
  appName: string;
  tagline: string;
  brand: ReelBrand;
  durationInFrames: number;
  /** Path to the brand logo, if the manifest set one. */
  logoPath?: string;
}

/** The full frame-accurate plan for one duration. */
export interface Reel {
  fps: number;
  width: number;
  height: number;
  titleCard: ReelTitleCard;
  scenes: ReelScene[];
}

export interface BuildReelOptions {
  manifest: Manifest;
  curation: CurationResult;
  /** Target total length in seconds; must be a tier present in curation.cuts. */
  durationSeconds: number;
  fps: number;
  /** out/<project> dir screenshots live under. Defaults to out/<manifest.name>. */
  outDir?: string;
  /** Existence check, injectable for tests. Defaults to fs.existsSync. */
  fileExists?: (path: string) => boolean;
}

/**
 * Deterministic Ken Burns parameters for a scene at `index`. Even scenes zoom
 * in, odd scenes zoom out; pan direction cycles through left/right/up/down. Pure
 * and index-only so repeated renders of the same reel are identical.
 */
export function kenBurnsForIndex(index: number): KenBurns {
  const zoomIn = index % 2 === 0;
  const dirs = [
    { panX: -1, panY: 0 },
    { panX: 1, panY: 0 },
    { panX: 0, panY: -1 },
    { panX: 0, panY: 1 },
  ];
  const d = dirs[((index % dirs.length) + dirs.length) % dirs.length];
  return {
    fromScale: zoomIn ? 1.0 : 1.08,
    toScale: zoomIn ? 1.08 : 1.0,
    panX: d.panX,
    panY: d.panY,
  };
}

/**
 * Resolve the screenshot path for a shot id, using the same NN-<id>.png naming
 * capture writes (indexed by the shot's position in the manifest). Throws a
 * clear error naming the shot if the file is missing.
 */
export function resolveShotImagePath(
  manifest: Manifest,
  shotId: string,
  outDir: string = resolve("out", manifest.name),
  fileExists: (path: string) => boolean = existsSync,
): string {
  const index = manifest.shots.findIndex((s) => s.id === shotId);
  if (index === -1) {
    throw new Error(`shot "${shotId}" is not in manifest "${manifest.name}"`);
  }
  const file = join(outDir, "screenshots", screenshotFilename(index + 1, shotId));
  if (!fileExists(file)) {
    throw new Error(
      `screenshot for shot "${shotId}" not found at ${file} — run: npm run capture -- ${manifest.name}`,
    );
  }
  return file;
}

/**
 * Distribute `budget` frames across scenes weighted by `weights`, keeping each
 * scene within [minF, maxF]. Excess over the cap is redistributed proportionally
 * to scenes still under it; if every scene is capped and budget remains, the
 * remainder is spread evenly beyond the cap (a last resort rather than dropping
 * frames). Returns floats that sum to `budget`; callers round to exact integers.
 */
export function allocateFrames(
  weights: number[],
  budget: number,
  minF: number,
  maxF: number,
): number[] {
  const n = weights.length;
  const fixed: (number | null)[] = new Array(n).fill(null);

  // Iteratively pin scenes that violate a bound, then re-solve the rest. Each
  // pass fixes at least one scene (or finishes), so it terminates in <= n passes.
  for (;;) {
    const active = fixed.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
    if (active.length === 0) break;

    const fixedSum = fixed.reduce<number>((a, v) => a + (v ?? 0), 0);
    const activeBudget = budget - fixedSum;
    const weightSum = active.reduce((a, i) => a + weights[i], 0);
    const prov = new Map<number, number>();
    for (const i of active) {
      prov.set(i, weightSum > EPS ? (activeBudget * weights[i]) / weightSum : activeBudget / active.length);
    }

    const over = active.filter((i) => (prov.get(i) as number) > maxF + EPS);
    if (over.length > 0) {
      for (const i of over) fixed[i] = maxF;
      continue;
    }
    const under = active.filter((i) => (prov.get(i) as number) < minF - EPS);
    if (under.length > 0) {
      for (const i of under) fixed[i] = minF;
      continue;
    }
    for (const i of active) fixed[i] = prov.get(i) as number;
    break;
  }

  const result = fixed.map((v) => v as number);

  // Last resort: everything hit the cap but budget still remains — extend evenly
  // beyond the cap rather than lose frames.
  const sum = result.reduce((a, v) => a + v, 0);
  if (budget - sum > EPS && n > 0) {
    const extra = (budget - sum) / n;
    for (let i = 0; i < n; i++) result[i] += extra;
  }
  return result;
}

/**
 * Round floats that sum to `target` (an integer) into integers that sum to
 * EXACTLY `target`, giving the leftover frames to the largest fractional parts.
 */
export function roundToExactSum(values: number[], target: number): number[] {
  const floors = values.map((v) => Math.floor(v));
  const sumFloor = floors.reduce((a, v) => a + v, 0);
  let remainder = Math.round(target - sumFloor);
  const order = values
    .map((v, i) => ({ i, frac: v - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let k = 0; k < order.length && remainder > 0; k++, remainder--) {
    result[order[k].i] += 1;
  }
  return result;
}

function toReelBrand(brand: Manifest["brand"]): ReelBrand {
  return {
    primaryColor: brand.primaryColor,
    accentColor: brand.accentColor,
    font: brand.font,
  };
}

/**
 * Build the frame-accurate reel for one duration tier. See the per-step comments
 * for the timing rules; the key invariant is that titleCard + all scene frames
 * sum to EXACTLY durationSeconds * fps (asserted at the end).
 */
export function buildReel(opts: BuildReelOptions): Reel {
  const { manifest, curation, durationSeconds, fps } = opts;

  // 1. Locate the requested cut.
  const cuts = curation.cuts as unknown as Record<string, { id: string; seconds: number }[]>;
  const cut = cuts[String(durationSeconds)];
  if (!cut) {
    const available = Object.keys(curation.cuts)
      .map((t) => `${t}s`)
      .join(", ");
    throw new Error(
      `no curated cut for ${durationSeconds}s. Available tiers: ${available}`,
    );
  }

  const totalFrames = Math.round(durationSeconds * fps);

  // 2. Title card: base 1.2s, scaled down for short cuts, floored at 0.8s.
  const titleSeconds = clamp(
    TITLE_BASE_SECONDS * (durationSeconds / TITLE_REF_SECONDS),
    TITLE_MIN_SECONDS,
    TITLE_BASE_SECONDS,
  );
  const titleFrames = Math.max(
    Math.round(titleSeconds * fps),
    Math.round(TITLE_MIN_SECONDS * fps),
  );

  const budget = totalFrames - titleFrames;
  const minF = Math.round(MIN_SCENE_SECONDS * fps);
  const maxF = Math.round(MAX_SCENE_SECONDS * fps);

  // 3. Drop the lowest-ranked shots if more are present than fit at the minimum.
  const rankById = new Map(curation.shots.map((s) => [s.id, s.rank]));
  const maxShots = Math.max(1, Math.floor(budget / minF));
  let kept = cut;
  if (cut.length > maxShots) {
    const ranked = cut.map((c, idx) => ({
      idx,
      id: c.id,
      rank: rankById.get(c.id) ?? Number.POSITIVE_INFINITY,
    }));
    const keep = new Set(
      [...ranked]
        .sort((a, b) => a.rank - b.rank || a.idx - b.idx)
        .slice(0, maxShots)
        .map((r) => r.idx),
    );
    const dropped = ranked.filter((r) => !keep.has(r.idx)).map((r) => r.id);
    kept = cut.filter((_, idx) => keep.has(idx)); // preserves cut order
    console.warn(
      `reel(${durationSeconds}s): dropped ${dropped.length} shot(s) that don't fit at the ${MIN_SCENE_SECONDS}s minimum: ${dropped.join(", ")}`,
    );
  }

  // 4. Allocate frames per scene, then round to sum EXACTLY to the budget.
  const alloc = allocateFrames(
    kept.map((k) => k.seconds),
    budget,
    minF,
    maxF,
  );
  const sceneFrames = roundToExactSum(alloc, budget);

  // 5. Assemble scenes (order matches the cut order).
  const calloutById = new Map(curation.shots.map((s) => [s.id, s.callout]));
  const scenes: ReelScene[] = kept.map((k, i) => ({
    shotId: k.id,
    imagePath: resolveShotImagePath(manifest, k.id, opts.outDir, opts.fileExists),
    callout: calloutById.get(k.id) ?? "",
    durationInFrames: sceneFrames[i],
    kenBurns: kenBurnsForIndex(i),
  }));

  // 6. Renormalization invariant: everything must sum to exactly the target.
  const sum = titleFrames + scenes.reduce((a, s) => a + s.durationInFrames, 0);
  if (sum !== totalFrames) {
    throw new Error(
      `reel frame total ${sum} !== expected ${totalFrames} (${durationSeconds}s @ ${fps}fps)`,
    );
  }

  return {
    fps,
    width: manifest.viewport.width,
    height: manifest.viewport.height,
    titleCard: {
      appName: manifest.name,
      tagline: curation.tagline,
      brand: toReelBrand(manifest.brand),
      durationInFrames: titleFrames,
      logoPath: manifest.brand.logoPath,
    },
    scenes,
  };
}
