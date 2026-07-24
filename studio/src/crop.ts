// Pure, React-free crop math for the crop editor.
//
// A crop is a Rect normalized to the source screenshot (every value a 0..1
// fraction), so it's resolution-independent and matches the server's
// edit-schema. These helpers keep a rect valid during drag/resize, snap it to an
// aspect ratio, and turn it into the CSS that previews the cropped frame. Kept
// free of React so they're directly unit-tested (see __tests__/crop.test.ts) and
// reused by both the modal and the Capture thumbnails.

import type { Rect } from "./types";

/** The whole frame — the "no crop" / reset value. */
export const FULL_RECT: Rect = { x: 0, y: 0, w: 1, h: 1 };

/** Smallest crop extent, as a fraction, so a rect never collapses to nothing. */
export const MIN_EXTENT = 0.05;

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/**
 * Clamp a rect into the unit square: enforce the minimum extent, then keep the
 * origin so the rect stays fully inside [0,1]. Always returns a valid Rect.
 */
export function clampRect(r: Rect): Rect {
  const w = Math.min(Math.max(r.w, MIN_EXTENT), 1);
  const h = Math.min(Math.max(r.h, MIN_EXTENT), 1);
  const x = Math.min(clamp01(r.x), 1 - w);
  const y = Math.min(clamp01(r.y), 1 - h);
  return { x, y, w, h };
}

/**
 * Snap a rect to a target *pixel* aspect ratio (width/height of the visible
 * frame) for a source image of `imgW`×`imgH`. Because the rect is normalized on a
 * non-square image, holding the pixel aspect means deriving h from w:
 *   pixelAspect = (w·imgW)/(h·imgH) = aspect  ⇒  h = (w·imgW)/(aspect·imgH)
 * The rect's top-left is preserved where possible; the result is clamped. A null
 * aspect means "free" — just clamp.
 */
export function applyAspect(r: Rect, imgW: number, imgH: number, aspect: number | null): Rect {
  if (!aspect || imgW <= 0 || imgH <= 0) return clampRect(r);
  let w = r.w;
  let h = (w * imgW) / (aspect * imgH);
  // If height overflows, re-derive width from the maxed-out height instead.
  if (h > 1) {
    h = 1;
    w = (aspect * imgH * h) / imgW;
  }
  return clampRect({ x: r.x, y: r.y, w, h });
}

/** Pixel aspect ratio (width/height) a normalized rect covers on imgW×imgH. */
export function pixelAspect(r: Rect, imgW: number, imgH: number): number {
  return (r.w * imgW) / (r.h * imgH);
}

/** True when the rect covers the whole frame (i.e. there's effectively no crop). */
export function isFullRect(r: Rect): boolean {
  return r.x <= 1e-4 && r.y <= 1e-4 && r.w >= 1 - 1e-4 && r.h >= 1 - 1e-4;
}

/**
 * CSS for an <img> inside an overflow-hidden box so ONLY the crop region shows,
 * stretched to fill the box — the same `fit: "fill"` the renderer uses, so the
 * preview matches the exported frame. The box should be `position: relative;
 * overflow: hidden`.
 */
export function cropImageStyle(r: Rect): {
  position: "absolute";
  width: string;
  height: string;
  left: string;
  top: string;
  objectFit: "fill";
  maxWidth: "none";
} {
  return {
    position: "absolute",
    width: `${100 / r.w}%`,
    height: `${100 / r.h}%`,
    left: `${(-r.x / r.w) * 100}%`,
    top: `${(-r.y / r.h) * 100}%`,
    objectFit: "fill",
    maxWidth: "none",
  };
}
