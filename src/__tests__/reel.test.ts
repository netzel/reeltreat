import { afterEach, describe, expect, it, vi } from "vitest";
import {
  allocateFrames,
  assertScreenshotDimensions,
  buildReel,
  kenBurnsForIndex,
  roundToExactSum,
  type BuildReelOptions,
  type ScreenshotSize,
} from "../reel.js";
import { ManifestSchema, type Manifest } from "../manifest.js";
import type { CurationResult } from "../curation-schema.js";

/** A manifest with a browser shot per id (screenshot naming uses the index). */
function makeManifest(ids: string[]): Manifest {
  return ManifestSchema.parse({
    name: "myapp",
    baseUrl: "https://myapp.example.com",
    viewport: { width: 1440, height: 900 },
    brand: { primaryColor: "#101820", accentColor: "#22d3ee", font: "Inter" },
    shots: ids.map((id) => ({ id, path: `/${id}`, caption: id })),
  });
}

/** Ranked shots for a set of ids: rank 1..n in the order given, with callouts. */
function rankedShots(ids: string[]): CurationResult["shots"] {
  return ids.map((id, i) => ({
    id,
    rank: i + 1,
    callout: `${id} label`,
    reason: `because ${id}`,
  }));
}

type Cut = { id: string; seconds: number }[];

/** Build a CurationResult directly (bypassing the seconds-sum schema refinement
 * so tests can exercise the reel's own capping/normalization). */
function makeCuration(args: {
  ids: string[];
  cuts: Partial<Record<string, Cut>>;
  heroShotId?: string;
}): CurationResult {
  return {
    tagline: "Your story, in seconds.",
    heroShotId: args.heroShotId ?? args.ids[0],
    shots: rankedShots(args.ids),
    cuts: args.cuts as CurationResult["cuts"],
  } as CurationResult;
}

/** Options with the filesystem existence check stubbed to always pass. */
function opts(
  manifest: Manifest,
  curation: CurationResult,
  durationSeconds: number,
  fps: number,
): BuildReelOptions {
  return { manifest, curation, durationSeconds, fps, fileExists: () => true };
}

const IDS = ["a", "b", "c", "d", "e", "f", "g"];
const manifest = makeManifest(IDS);
const fullCuration = makeCuration({
  ids: IDS,
  cuts: {
    "5": [
      { id: "a", seconds: 3 },
      { id: "b", seconds: 2 },
    ],
    "15": [
      { id: "a", seconds: 4 },
      { id: "b", seconds: 3 },
      { id: "c", seconds: 4 },
      { id: "d", seconds: 4 },
    ],
    "30": [
      { id: "a", seconds: 5 },
      { id: "b", seconds: 4 },
      { id: "c", seconds: 5 },
      { id: "d", seconds: 5 },
      { id: "e", seconds: 5 },
      { id: "f", seconds: 6 },
    ],
    "45": [
      { id: "a", seconds: 6 },
      { id: "b", seconds: 5 },
      { id: "c", seconds: 6 },
      { id: "d", seconds: 6 },
      { id: "e", seconds: 6 },
      { id: "f", seconds: 8 },
      { id: "g", seconds: 8 },
    ],
  },
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildReel total frames", () => {
  it("sums titleCard + scenes to EXACTLY durationSeconds * fps for every tier and fps", () => {
    for (const fps of [30, 60]) {
      for (const tier of [5, 15, 30, 45]) {
        const reel = buildReel(opts(manifest, fullCuration, tier, fps));
        const total =
          reel.titleCard.durationInFrames +
          reel.scenes.reduce((a, s) => a + s.durationInFrames, 0);
        expect(total, `${tier}s @ ${fps}fps`).toBe(tier * fps);
        expect(reel.fps).toBe(fps);
        expect(reel.width).toBe(1440);
        expect(reel.height).toBe(900);
      }
    }
  });
});

describe("title card sizing", () => {
  it("shortens the title card for the 5s cut but never below 0.8s, and is full length by 15s", () => {
    const short = buildReel(opts(manifest, fullCuration, 5, 30));
    const long = buildReel(opts(manifest, fullCuration, 15, 30));

    expect(short.titleCard.durationInFrames).toBeGreaterThanOrEqual(0.8 * 30);
    expect(short.titleCard.durationInFrames).toBeLessThan(1.2 * 30);
    expect(short.titleCard.durationInFrames).toBeLessThan(long.titleCard.durationInFrames);
    expect(long.titleCard.durationInFrames).toBe(Math.round(1.2 * 30));
  });
});

describe("5s scene cap", () => {
  it("caps an over-long shot at 5s, redistributes the remainder, and still lands exactly", () => {
    const curation = makeCuration({
      ids: IDS,
      cuts: {
        "30": [
          { id: "a", seconds: 8 }, // over the 5s cap
          { id: "b", seconds: 3 },
          { id: "c", seconds: 3 },
          { id: "d", seconds: 3 },
          { id: "e", seconds: 3 },
          { id: "f", seconds: 3 },
        ],
      },
    });
    const reel = buildReel(opts(manifest, curation, 30, 30));
    const maxFrames = 5 * 30;

    // The 8s shot is capped at exactly 5s.
    expect(reel.scenes[0].shotId).toBe("a");
    expect(reel.scenes[0].durationInFrames).toBe(maxFrames);
    // No scene exceeds the cap.
    for (const s of reel.scenes) expect(s.durationInFrames).toBeLessThanOrEqual(maxFrames);
    // The remainder was pushed into the other scenes (above their raw 3s = 90 frames).
    for (const s of reel.scenes.slice(1)) expect(s.durationInFrames).toBeGreaterThan(90);
    // Total is still exact.
    const total =
      reel.titleCard.durationInFrames +
      reel.scenes.reduce((a, s) => a + s.durationInFrames, 0);
    expect(total).toBe(30 * 30);
  });
});

describe("minimum scene length", () => {
  it("drops the lowest-ranked shots that don't fit at 1.2s and logs them", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // 5s @ 30fps: total 150, title 24, budget 126, min 36 -> at most 3 scenes.
    const curation = makeCuration({
      ids: IDS,
      cuts: {
        "5": [
          { id: "a", seconds: 1 },
          { id: "b", seconds: 1 },
          { id: "c", seconds: 1 },
          { id: "d", seconds: 1 },
          { id: "e", seconds: 1 },
        ],
      },
    });
    const reel = buildReel(opts(manifest, curation, 5, 30));

    // Highest-ranked three kept (a,b,c are ranks 1-3), in cut order.
    expect(reel.scenes.map((s) => s.shotId)).toEqual(["a", "b", "c"]);
    // The dropped ids are named in the log.
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = warn.mock.calls[0][0] as string;
    expect(msg).toContain("d");
    expect(msg).toContain("e");
    // Total still exact.
    const total =
      reel.titleCard.durationInFrames +
      reel.scenes.reduce((a, s) => a + s.durationInFrames, 0);
    expect(total).toBe(150);
  });
});

describe("scene order and screenshot resolution", () => {
  it("orders scenes to match the cut", () => {
    const reel = buildReel(opts(manifest, fullCuration, 30, 30));
    expect(reel.scenes.map((s) => s.shotId)).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(reel.scenes[0].callout).toBe("a label");
  });

  it("throws naming the shot when its screenshot file is missing", () => {
    expect(() =>
      buildReel({
        manifest,
        curation: fullCuration,
        durationSeconds: 15,
        fps: 30,
        fileExists: () => false,
      }),
    ).toThrow(/screenshot for shot "a" not found/);
  });
});

describe("kenBurns", () => {
  it("is deterministic across repeated calls and alternates direction by index", () => {
    expect(kenBurnsForIndex(0)).toEqual(kenBurnsForIndex(0));

    const even = kenBurnsForIndex(0);
    const odd = kenBurnsForIndex(1);
    // Even zooms in, odd zooms out.
    expect(even.fromScale).toBeLessThan(even.toScale);
    expect(odd.fromScale).toBeGreaterThan(odd.toScale);
    // Pan direction differs between adjacent scenes.
    expect([even.panX, even.panY]).not.toEqual([odd.panX, odd.panY]);
    // Scale stays in the subtle range.
    for (const kb of [even, odd]) {
      expect(Math.min(kb.fromScale, kb.toScale)).toBeGreaterThanOrEqual(1.0);
      expect(Math.max(kb.fromScale, kb.toScale)).toBeLessThanOrEqual(1.08);
    }

    // The same reel built twice has identical camera moves.
    const a = buildReel(opts(manifest, fullCuration, 30, 30));
    const b = buildReel(opts(manifest, fullCuration, 30, 30));
    expect(a.scenes.map((s) => s.kenBurns)).toEqual(b.scenes.map((s) => s.kenBurns));
    a.scenes.forEach((s, i) => expect(s.kenBurns).toEqual(kenBurnsForIndex(i)));
  });
});

describe("crops", () => {
  it("attaches a crop to the matching scene and leaves others uncropped", () => {
    const crops = { b: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } };
    const reel = buildReel({ ...opts(manifest, fullCuration, 30, 30), crops });
    const byId = new Map(reel.scenes.map((s) => [s.shotId, s]));
    expect(byId.get("b")?.crop).toEqual(crops.b);
    expect(byId.get("a")?.crop).toBeUndefined();
  });

  it("does not change scene timing or camera moves when a crop is present", () => {
    const crops = { a: { x: 0, y: 0, w: 0.5, h: 0.5 } };
    const plain = buildReel(opts(manifest, fullCuration, 30, 30));
    const cropped = buildReel({ ...opts(manifest, fullCuration, 30, 30), crops });
    expect(cropped.scenes.map((s) => s.durationInFrames)).toEqual(
      plain.scenes.map((s) => s.durationInFrames),
    );
    expect(cropped.scenes.map((s) => s.kenBurns)).toEqual(plain.scenes.map((s) => s.kenBurns));
  });
});

describe("missing tier", () => {
  it("throws listing the available tiers", () => {
    const curation = makeCuration({
      ids: IDS,
      cuts: {
        "5": [{ id: "a", seconds: 5 }],
        "15": [{ id: "a", seconds: 15 }],
      },
    });
    expect(() => buildReel(opts(manifest, curation, 30, 30))).toThrow(
      /Available tiers: 5s, 15s/,
    );
  });
});

describe("assertScreenshotDimensions", () => {
  const expected: ScreenshotSize = { width: 1440, height: 900 };
  const reader = (sizes: Record<string, ScreenshotSize>) => async (p: string) => sizes[p];

  it("passes when every file matches the expected viewport", async () => {
    const sizes = {
      "a.png": { width: 1440, height: 900 },
      "b.png": { width: 1440, height: 900 },
    };
    await expect(
      assertScreenshotDimensions(Object.keys(sizes), expected, reader(sizes)),
    ).resolves.toBeUndefined();
  });

  it("passes on an empty file list", async () => {
    await expect(
      assertScreenshotDimensions([], expected, reader({})),
    ).resolves.toBeUndefined();
  });

  it("throws listing each offending file with its dimensions and the expected size", async () => {
    const sizes = {
      "a.png": { width: 1440, height: 900 }, // matches
      "b.png": { width: 800, height: 600 }, // stale
      "c.png": { width: 1280, height: 720 }, // stale
    };
    const err = await assertScreenshotDimensions(
      Object.keys(sizes),
      expected,
      reader(sizes),
    ).catch((e: Error) => e);

    expect(err).toBeInstanceOf(Error);
    const msg = (err as Error).message;
    expect(msg).toContain("1440x900"); // expected size
    expect(msg).toContain("b.png: 800x600");
    expect(msg).toContain("c.png: 1280x720");
    expect(msg).not.toContain("a.png"); // the matching file isn't flagged
    expect(msg).toMatch(/capture/); // tells the user how to fix it
  });
});

describe("allocation helpers", () => {
  it("allocateFrames keeps within bounds and sums to the budget", () => {
    const alloc = allocateFrames([8, 3, 3, 3], 400, 40, 150);
    expect(alloc.reduce((a, v) => a + v, 0)).toBeCloseTo(400, 6);
    for (const v of alloc) expect(v).toBeLessThanOrEqual(150 + 1e-6);
  });

  it("roundToExactSum yields integers summing to exactly the target", () => {
    const rounded = roundToExactSum([10.4, 10.4, 10.2], 31);
    expect(rounded.every((v) => Number.isInteger(v))).toBe(true);
    expect(rounded.reduce((a, v) => a + v, 0)).toBe(31);
  });
});
