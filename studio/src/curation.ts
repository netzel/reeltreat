// Client-side curation model + pure edit operations.
//
// The bridge's GET/PUT .../curation endpoints exchange this exact shape (it
// mirrors the CLI's curation-schema on the server). Every editor action the UI
// exposes — reordering the cut, renaming a callout, rewriting the tagline,
// picking a different hero, excluding/re-adding a shot — is a pure function here
// that returns a new Curation. Kept free of React so it's directly unit-tested,
// and so a bad edit can't slip past: the server re-validates on save (each
// tier's seconds must still sum to the tier), and these helpers preserve that.

export type TierKey = "5" | "15" | "30" | "45";
export const TIERS: TierKey[] = ["5", "15", "30", "45"];

export interface RankedShot {
  id: string;
  rank: number;
  callout: string;
  reason: string;
}

export interface CutShot {
  id: string;
  seconds: number;
}

export interface Curation {
  tagline: string;
  heroShotId: string;
  shots: RankedShot[];
  cuts: Record<TierKey, CutShot[]>;
}

function clone(c: Curation): Curation {
  return {
    tagline: c.tagline,
    heroShotId: c.heroShotId,
    shots: c.shots.map((s) => ({ ...s })),
    cuts: {
      "5": c.cuts["5"].map((x) => ({ ...x })),
      "15": c.cuts["15"].map((x) => ({ ...x })),
      "30": c.cuts["30"].map((x) => ({ ...x })),
      "45": c.cuts["45"].map((x) => ({ ...x })),
    },
  };
}

/** Rewrite the tagline (the poster/opening soundbite). */
export function setTagline(c: Curation, tagline: string): Curation {
  const next = clone(c);
  next.tagline = tagline;
  return next;
}

/** Rename a shot's callout — the 2–4 word text bubble shown over that scene. */
export function setCallout(c: Curation, id: string, callout: string): Curation {
  const next = clone(c);
  const shot = next.shots.find((s) => s.id === id);
  if (shot) shot.callout = callout;
  return next;
}

/** Choose a different hero shot (the poster frame). */
export function setHero(c: Curation, id: string): Curation {
  const next = clone(c);
  next.heroShotId = id;
  return next;
}

/** Move item at `from` to `to` within an array, returning a new array. */
export function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  if (from < 0 || from >= next.length) return next;
  const clamped = Math.max(0, Math.min(next.length - 1, to));
  const [item] = next.splice(from, 1);
  next.splice(clamped, 0, item);
  return next;
}

/**
 * Reorder a shot within a tier's cut — this is what controls the order shots are
 * layered into the rendered video for that duration. Seconds ride along with
 * each shot, so the per-tier total is unchanged and the edit stays valid.
 */
export function reorderCut(c: Curation, tier: TierKey, from: number, to: number): Curation {
  const next = clone(c);
  next.cuts[tier] = arrayMove(next.cuts[tier], from, to);
  return next;
}

/** Nudge a shot one step earlier (-1) or later (+1) in a tier's cut. */
export function moveCut(c: Curation, tier: TierKey, id: string, dir: -1 | 1): Curation {
  const idx = c.cuts[tier].findIndex((x) => x.id === id);
  if (idx < 0) return c;
  return reorderCut(c, tier, idx, idx + dir);
}

/** Rescale a cut's seconds so they sum to `total` (keeps the save valid). */
export function normalizeCut(cut: CutShot[], total: number): CutShot[] {
  if (cut.length === 0) return [];
  const sum = cut.reduce((a, s) => a + s.seconds, 0);
  const scale = sum > 0 ? total / sum : 0;
  const scaled = cut.map((s) => ({
    id: s.id,
    seconds: sum > 0 ? Math.round(s.seconds * scale * 10) / 10 : Math.round((total / cut.length) * 10) / 10,
  }));
  // Push any rounding drift onto the last shot so the sum is exact.
  const drift = total - scaled.reduce((a, s) => a + s.seconds, 0);
  scaled[scaled.length - 1].seconds = Math.round((scaled[scaled.length - 1].seconds + drift) * 10) / 10;
  return scaled;
}

/** Remove a shot from a tier's cut and re-balance the remaining seconds. */
export function removeFromCut(c: Curation, tier: TierKey, id: string): Curation {
  const next = clone(c);
  next.cuts[tier] = normalizeCut(
    next.cuts[tier].filter((x) => x.id !== id),
    Number(tier),
  );
  return next;
}

/** Add a shot to the end of a tier's cut and re-balance seconds to the tier total. */
export function addToCut(c: Curation, tier: TierKey, id: string): Curation {
  const next = clone(c);
  if (next.cuts[tier].some((x) => x.id === id)) return next;
  const withNew = [...next.cuts[tier], { id, seconds: 1 }];
  next.cuts[tier] = normalizeCut(withNew, Number(tier));
  return next;
}

/** Ids present in a tier's cut, in order. */
export function cutIds(c: Curation, tier: TierKey): string[] {
  return c.cuts[tier].map((x) => x.id);
}
