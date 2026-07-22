import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { requestCuration, type ShotImage } from "../src/curate.js";
import { validateCuration } from "../src/curation-schema.js";

/**
 * Live curation eval. Opt-in: skipped unless RUN_EVALS=1, since it makes a real
 * (billable) Claude API call. Fixtures are tiny solid-color PNGs generated at
 * run time with sharp — no binary screenshots of any real app are committed.
 */
const RUN = process.env.RUN_EVALS === "1";

/** Distinct solid colors so the three fixture shots aren't identical. */
const FIXTURES = [
  { id: "home", caption: "Landing page", rgb: { r: 32, g: 96, b: 200 } },
  { id: "pricing", caption: "Pricing table", rgb: { r: 0, g: 168, b: 132 } },
  { id: "docs", caption: "Documentation", rgb: { r: 210, g: 90, b: 40 } },
];

async function buildFixtureImages(): Promise<ShotImage[]> {
  return Promise.all(
    FIXTURES.map(async (f) => {
      const png = await sharp({
        create: { width: 96, height: 64, channels: 3, background: f.rgb },
      })
        .png()
        .toBuffer();
      return { id: f.id, caption: f.caption, base64: png.toString("base64") };
    }),
  );
}

describe.skipIf(!RUN)("curation eval (live API call)", () => {
  it(
    "returns a schema-valid curation for a small fixture set",
    async () => {
      const images = await buildFixtureImages();
      const ids = FIXTURES.map((f) => f.id);

      const client = new Anthropic();
      const { input } = await requestCuration(client, images);

      // Throws if the schema or cross-references fail.
      const curation = validateCuration(input, ids);

      expect(curation.tagline.length).toBeLessThanOrEqual(90);
      expect(ids).toContain(curation.heroShotId);

      const sum = curation.cuts["15"].reduce((total, c) => total + c.seconds, 0);
      expect(Math.abs(sum - 15)).toBeLessThanOrEqual(0.5);
    },
    60_000,
  );
});
