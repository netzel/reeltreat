/**
 * Prop types shared between the render CLI (src/, NodeNext) and the Remotion
 * compositions (remotion/, bundler resolution). This file is deliberately free
 * of any Node imports so it is safe to pull into the browser bundle AND into the
 * CLI without dragging node:fs etc. into webpack. Keep it types + plain
 * constants only.
 */

/** Frames of crossfade overlap between the title card and scenes, and between
 * adjacent scenes. The reel's frame math never depends on this — scenes are laid
 * out back-to-back so their durations sum exactly; the overlap only pulls each
 * scene's mount point earlier into already-occupied time (see Reel.tsx), so the
 * total timeline length is unchanged. */
export const CROSSFADE_FRAMES = 10;

// These are `type` aliases, not `interface`s, on purpose: Remotion's Composition
// / Thumbnail constrain their props to `Record<string, unknown>`, and a TS
// interface is NOT assignable to that (it has no implicit index signature) while
// an object `type` is. Keeping them as types lets ReelProps/PosterProps be passed
// as composition inputProps without casts.

/** Deterministic Ken Burns move for one scene, a pure function of scene index. */
export type KenBurns = {
  /** Starting scale (1.0 = no zoom). */
  fromScale: number;
  /** Ending scale. */
  toScale: number;
  /** Pan direction on X as -1 | 0 | 1 (multiplied by a small pixel amount). */
  panX: number;
  /** Pan direction on Y as -1 | 0 | 1. */
  panY: number;
};

/** Brand tokens the compositions read. A plain, zod-free mirror of the manifest
 * brand so the render bundle never imports the schema layer. All optional; every
 * component supplies neutral fallbacks. */
export type ReelBrand = {
  primaryColor?: string;
  accentColor?: string;
  font?: string;
};

/** Props for a single Ken Burns scene. `src` is a data URI (or any URL) — the
 * render CLI embeds the screenshot as a data URI so the bundle is self-contained. */
export type SceneProps = {
  src: string;
  callout: string;
  durationInFrames: number;
  /** Frames the scene fades in over at its start (the crossfade window). */
  fadeInFrames: number;
  kenBurns: KenBurns;
  brand: ReelBrand;
};

/** Props for the animated title card. */
export type TitleCardProps = {
  appName: string;
  tagline: string;
  brand: ReelBrand;
  durationInFrames: number;
  /** Optional logo as a data URI (or URL). */
  logoSrc?: string;
  /** Frames the card crossfades into the first scene at its end. */
  crossfade: number;
};

/** Input props for the "Reel" composition. calculateMetadata derives the total
 * duration from titleCard + scenes, and width/height/fps from these fields. */
export type ReelProps = {
  fps: number;
  width: number;
  height: number;
  titleCard: TitleCardProps;
  scenes: SceneProps[];
};

/** Input props for the "Poster" composition (a single still). */
export type PosterProps = {
  width: number;
  height: number;
  fps: number;
  appName: string;
  tagline: string;
  brand: ReelBrand;
  /** Hero screenshot as a data URI (or URL). */
  src: string;
  logoSrc?: string;
};
