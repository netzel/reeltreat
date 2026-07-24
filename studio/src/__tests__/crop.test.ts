import { describe, expect, it } from "vitest";
import {
  applyAspect,
  clampRect,
  cropImageStyle,
  FULL_RECT,
  isFullRect,
  MIN_EXTENT,
  pixelAspect,
} from "../crop";

describe("clampRect", () => {
  it("keeps a valid rect unchanged", () => {
    expect(clampRect({ x: 0.1, y: 0.2, w: 0.5, h: 0.4 })).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.4 });
  });

  it("pulls an off-edge rect back inside the unit square", () => {
    const r = clampRect({ x: 0.8, y: 0.9, w: 0.5, h: 0.5 });
    expect(r.x + r.w).toBeLessThanOrEqual(1 + 1e-9);
    expect(r.y + r.h).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("enforces the minimum extent", () => {
    const r = clampRect({ x: 0.5, y: 0.5, w: 0, h: 0 });
    expect(r.w).toBeGreaterThanOrEqual(MIN_EXTENT);
    expect(r.h).toBeGreaterThanOrEqual(MIN_EXTENT);
  });

  it("clamps negative origins to zero", () => {
    const r = clampRect({ x: -0.3, y: -0.2, w: 0.4, h: 0.4 });
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });
});

describe("applyAspect", () => {
  it("produces a rect whose pixel aspect matches the target", () => {
    // Source 1440x900; ask for 16:9.
    const r = applyAspect({ x: 0.1, y: 0.1, w: 0.6, h: 0.9 }, 1440, 900, 16 / 9);
    expect(pixelAspect(r, 1440, 900)).toBeCloseTo(16 / 9, 3);
  });

  it("returns a clamped rect for a null (free) aspect", () => {
    const r = applyAspect({ x: 0.9, y: 0, w: 0.5, h: 0.5 }, 1440, 900, null);
    expect(r.x + r.w).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("stays inside the frame when the derived height would overflow", () => {
    const r = applyAspect({ x: 0, y: 0, w: 1, h: 1 }, 900, 1440, 3); // very wide target on a tall image
    expect(r.w).toBeLessThanOrEqual(1 + 1e-9);
    expect(r.h).toBeLessThanOrEqual(1 + 1e-9);
    expect(r.x + r.w).toBeLessThanOrEqual(1 + 1e-9);
  });
});

describe("cropImageStyle", () => {
  it("maps a full-frame rect to a 100% image at the origin", () => {
    const s = cropImageStyle(FULL_RECT);
    expect(s.width).toBe("100%");
    expect(s.height).toBe("100%");
    expect(s.left).toBe("0%");
    expect(s.top).toBe("0%");
  });

  it("scales and offsets a centered half-crop", () => {
    const s = cropImageStyle({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    expect(s.width).toBe("200%");
    expect(s.left).toBe("-50%");
    expect(s.top).toBe("-50%");
  });
});

describe("isFullRect", () => {
  it("is true for the full frame and false for a real crop", () => {
    expect(isFullRect(FULL_RECT)).toBe(true);
    expect(isFullRect({ x: 0.1, y: 0, w: 0.8, h: 1 })).toBe(false);
  });
});
