import { z } from "zod";

/** Duration tiers (in seconds) reeltreat renders. Keys are strings to match JSON. */
export const TIER_KEYS = ["5", "15", "30", "45"] as const;
export type TierKey = (typeof TIER_KEYS)[number];

/** One screen in a duration-specific cut, with how long it stays on screen. */
export const CutShotSchema = z.object({
  id: z.string(),
  seconds: z.number().positive(),
});

const CutSchema = z.array(CutShotSchema);

/** One ranked shot with its overlay callout and the reason it was chosen. */
export const RankedShotSchema = z.object({
  id: z.string(),
  rank: z.number().int().min(1),
  callout: z.string().max(40, "callout must be at most 40 characters"),
  reason: z.string(),
});

/**
 * The full curation result the model returns. Structural constraints live here;
 * cross-referencing shot ids against the manifest happens in validateCuration.
 */
export const CurationResultSchema = z
  .object({
    tagline: z.string().max(90, "tagline must be at most 90 characters"),
    heroShotId: z.string(),
    shots: z.array(RankedShotSchema).min(1, "at least one ranked shot is required"),
    cuts: z.object({
      "5": CutSchema,
      "15": CutSchema,
      "30": CutSchema,
      "45": CutSchema,
    }),
  })
  .superRefine((data, ctx) => {
    for (const tier of TIER_KEYS) {
      const cut = data.cuts[tier];
      const sum = cut.reduce((total, c) => total + c.seconds, 0);
      if (Math.abs(sum - Number(tier)) > 0.5) {
        ctx.addIssue({
          code: "custom",
          message: `cut "${tier}s" seconds sum ${sum.toFixed(1)} is not within 0.5 of ${tier}`,
          path: ["cuts", tier],
        });
      }
    }
  });
export type CurationResult = z.infer<typeof CurationResultSchema>;

/**
 * Parse a raw curation payload and cross-reference every shot id against the
 * manifest. Throws a clear aggregated error if anything is invalid.
 */
export function validateCuration(
  raw: unknown,
  manifestShotIds: string[],
): CurationResult {
  const parsed = CurationResultSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid curation:\n${issues}`);
  }

  const data = parsed.data;
  const known = new Set(manifestShotIds);
  const errors: string[] = [];

  if (!known.has(data.heroShotId)) {
    errors.push(`heroShotId "${data.heroShotId}" is not a manifest shot`);
  }
  for (const s of data.shots) {
    if (!known.has(s.id)) errors.push(`shots: "${s.id}" is not a manifest shot`);
  }
  for (const tier of TIER_KEYS) {
    for (const c of data.cuts[tier]) {
      if (!known.has(c.id)) {
        errors.push(`cuts.${tier}: "${c.id}" is not a manifest shot`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid curation:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }

  return data;
}
