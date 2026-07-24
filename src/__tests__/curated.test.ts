import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { planCuratedSet, writeCuratedSet } from "../curated.js";
import { ManifestSchema, type Manifest } from "../manifest.js";
import type { CurationResult } from "../curation-schema.js";

/** A manifest with a mix of browser and manual shots, in position order. */
function manifest(): Manifest {
  return ManifestSchema.parse({
    name: "myapp",
    baseUrl: "https://myapp.example.com",
    shots: [
      { id: "home", path: "/home", caption: "Home" }, // position 1 -> 01-home.png
      { id: "mic", caption: "Mic", image: "manual/mic.png" }, // position 2 -> 02-mic.png
      { id: "about", path: "/about", caption: "About" }, // position 3 -> 03-about.png
    ],
  });
}

/**
 * A curation that keeps all three shots but ranks them out of manifest order,
 * with a manual shot (mic) as the hero — so the test proves curated naming keys
 * off rank, not manifest position, and blends manual + browser shots.
 */
function curation(): CurationResult {
  return {
    tagline: "Ship faster",
    heroShotId: "mic",
    shots: [
      { id: "mic", rank: 1, callout: "Live mic", reason: "striking" },
      { id: "about", rank: 2, callout: "About", reason: "context" },
      { id: "home", rank: 3, callout: "Home", reason: "overview" },
    ],
    cuts: {
      "5": [{ id: "mic", seconds: 5 }],
      "15": [{ id: "mic", seconds: 15 }],
      "30": [{ id: "mic", seconds: 30 }],
      "45": [{ id: "mic", seconds: 45 }],
    },
  };
}

describe("planCuratedSet", () => {
  it("orders by rank, maps capture position to a rank-named file, and flags the hero", () => {
    const plan = planCuratedSet(manifest(), curation());

    expect(plan).toEqual([
      { shotId: "mic", rank: 1, hero: true, from: "02-mic.png", to: "01-mic-hero.png" },
      { shotId: "about", rank: 2, hero: false, from: "03-about.png", to: "02-about.png" },
      { shotId: "home", rank: 3, hero: false, from: "01-home.png", to: "03-home.png" },
    ]);
  });

  it("skips ranked shots that are not in the manifest", () => {
    const cur = curation();
    cur.shots.push({ id: "ghost", rank: 4, callout: "Ghost", reason: "n/a" });
    const plan = planCuratedSet(manifest(), cur);
    expect(plan.map((c) => c.shotId)).not.toContain("ghost");
  });
});

describe("writeCuratedSet", () => {
  let capturesDir: string;
  let curatedDir: string;

  beforeEach(() => {
    const base = mkdtempSync(join(tmpdir(), "reeltreat-curated-"));
    capturesDir = join(base, "captures");
    curatedDir = join(base, "curated");
    mkdirSync(capturesDir, { recursive: true });
  });
  afterEach(() => {
    rmSync(join(capturesDir, ".."), { recursive: true, force: true });
  });

  it("copies each picked capture into curated/ under its rank name", () => {
    for (const name of ["01-home.png", "02-mic.png", "03-about.png"]) {
      writeFileSync(join(capturesDir, name), name);
    }

    const { copied, missing } = writeCuratedSet(manifest(), curation(), capturesDir, curatedDir);

    expect(missing).toEqual([]);
    expect(copied.map((c) => c.to)).toEqual([
      "01-mic-hero.png",
      "02-about.png",
      "03-home.png",
    ]);
    expect(readdirSync(curatedDir).sort()).toEqual([
      "01-mic-hero.png",
      "02-about.png",
      "03-home.png",
    ]);
  });

  it("reports a missing capture instead of throwing, and still copies the rest", () => {
    // mic's capture (02-mic.png) is absent.
    writeFileSync(join(capturesDir, "01-home.png"), "home");
    writeFileSync(join(capturesDir, "03-about.png"), "about");

    const { copied, missing } = writeCuratedSet(manifest(), curation(), capturesDir, curatedDir);

    expect(missing.map((c) => c.shotId)).toEqual(["mic"]);
    expect(copied.map((c) => c.shotId).sort()).toEqual(["about", "home"]);
    expect(existsSync(join(curatedDir, "01-mic-hero.png"))).toBe(false);
  });

  it("clears stale curated PNGs so a re-curate never leaves a dropped shot behind", () => {
    for (const name of ["01-home.png", "02-mic.png", "03-about.png"]) {
      writeFileSync(join(capturesDir, name), name);
    }
    mkdirSync(curatedDir, { recursive: true });
    writeFileSync(join(curatedDir, "99-stale.png"), "stale"); // leftover from a prior run
    writeFileSync(join(curatedDir, "notes.txt"), "keep"); // non-png untouched

    writeCuratedSet(manifest(), curation(), capturesDir, curatedDir);

    expect(existsSync(join(curatedDir, "99-stale.png"))).toBe(false);
    expect(existsSync(join(curatedDir, "notes.txt"))).toBe(true);
  });
});
