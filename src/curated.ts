import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { screenshotFilename } from "./capture.js";
import type { Manifest } from "./manifest.js";
import type { CurationResult } from "./curation-schema.js";

/**
 * src/curated.ts — materialize the "final set" that goes into the video.
 *
 * capture writes every shot (browser and manual alike) into captures/ under its
 * manifest position: NN-<id>.png. curation then picks and ranks a subset across
 * both kinds. That subset only exists as ids in curation.json — you can't see it.
 *
 * This module copies those picked shots into curated/, renamed by rank so the
 * folder reads top-to-bottom as the reel's priority order, with the hero frame
 * flagged. It's a browsable, at-a-glance answer to "what's actually in the
 * video?" — manual and auto captures side by side, in one place.
 */

/** Zero-padded 2-digit rank, e.g. 1 -> "01". */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** One copy from a capture file to its rank-named place in curated/. */
export interface CuratedCopy {
  shotId: string;
  rank: number;
  hero: boolean;
  /** Source basename in captures/ (NN-<id>.png by manifest position). */
  from: string;
  /** Destination basename in curated/ (rank-ordered, hero suffixed). */
  to: string;
}

/**
 * Plan the curated set: curation's kept shots, ordered by rank, each mapped from
 * its capture filename (keyed by manifest position) to a rank-ordered curated
 * filename. The hero shot gets a "-hero" suffix so it's obvious at a glance.
 * Pure — does no filesystem work — so it's cheap to unit-test.
 */
export function planCuratedSet(
  manifest: Manifest,
  curation: CurationResult,
): CuratedCopy[] {
  const indexById = new Map(manifest.shots.map((s, i) => [s.id, i + 1]));
  return [...curation.shots]
    .sort((a, b) => a.rank - b.rank)
    .filter((s) => indexById.has(s.id))
    .map((s) => {
      const captureIndex = indexById.get(s.id) as number;
      const hero = s.id === curation.heroShotId;
      return {
        shotId: s.id,
        rank: s.rank,
        hero,
        from: screenshotFilename(captureIndex, s.id),
        to: `${pad2(s.rank)}-${s.id}${hero ? "-hero" : ""}.png`,
      };
    });
}

export interface WriteCuratedResult {
  /** Shots successfully copied into curated/. */
  copied: CuratedCopy[];
  /** Planned shots whose capture file was missing (reported, not fatal). */
  missing: CuratedCopy[];
}

/**
 * Rebuild curatedDir from the current curation: clear its stale PNGs, then copy
 * each planned shot out of capturesDir. Copies (not symlinks) so the folder is a
 * self-contained, portable gallery. A planned shot whose capture is missing is
 * collected in `missing` rather than throwing, so a partial capture still yields
 * a useful curated set. Only ever touches .png files in curatedDir.
 */
export function writeCuratedSet(
  manifest: Manifest,
  curation: CurationResult,
  capturesDir: string,
  curatedDir: string,
): WriteCuratedResult {
  const plan = planCuratedSet(manifest, curation);

  mkdirSync(curatedDir, { recursive: true });
  // Clear stale curated frames so a dropped/re-ranked shot never lingers.
  for (const name of readdirSync(curatedDir)) {
    if (name.toLowerCase().endsWith(".png")) rmSync(join(curatedDir, name));
  }

  const copied: CuratedCopy[] = [];
  const missing: CuratedCopy[] = [];
  for (const c of plan) {
    const src = join(capturesDir, c.from);
    if (!existsSync(src)) {
      missing.push(c);
      continue;
    }
    copyFileSync(src, join(curatedDir, c.to));
    copied.push(c);
  }
  return { copied, missing };
}
