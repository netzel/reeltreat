import { describe, expect, it } from "vitest";
import {
  EditSchema,
  RectSchema,
  cropToPixels,
  emptyEdit,
  parseEdit,
  type Rect,
} from "../edit-schema.js";

describe("RectSchema", () => {
  it("accepts a valid normalized rect", () => {
    expect(RectSchema.parse({ x: 0.1, y: 0.2, w: 0.5, h: 0.4 })).toEqual({
      x: 0.1,
      y: 0.2,
      w: 0.5,
      h: 0.4,
    });
  });

  it("rejects out-of-range values", () => {
    expect(RectSchema.safeParse({ x: -0.1, y: 0, w: 0.5, h: 0.5 }).success).toBe(false);
    expect(RectSchema.safeParse({ x: 0, y: 0, w: 1.2, h: 0.5 }).success).toBe(false);
  });

  it("rejects zero-area rects", () => {
    expect(RectSchema.safeParse({ x: 0, y: 0, w: 0, h: 0.5 }).success).toBe(false);
  });

  it("rejects a rect that runs off the edge (x+w > 1)", () => {
    const res = RectSchema.safeParse({ x: 0.7, y: 0, w: 0.5, h: 0.5 });
    expect(res.success).toBe(false);
  });

  it("allows a full-frame rect", () => {
    expect(RectSchema.safeParse({ x: 0, y: 0, w: 1, h: 1 }).success).toBe(true);
  });
});

describe("EditSchema", () => {
  it("defaults crops to an empty object", () => {
    expect(EditSchema.parse({ version: 1 })).toEqual({ version: 1, crops: {} });
  });

  it("round-trips a crop keyed by shot id", () => {
    const edit = { version: 1 as const, crops: { dashboard: { x: 0, y: 0.1, w: 0.8, h: 0.8 } } };
    expect(parseEdit(edit)).toEqual(edit);
  });

  it("rejects a non-slug shot id key", () => {
    expect(
      EditSchema.safeParse({ version: 1, crops: { "Bad Id": { x: 0, y: 0, w: 1, h: 1 } } }).success,
    ).toBe(false);
  });

  it("rejects an unknown version", () => {
    expect(EditSchema.safeParse({ version: 2, crops: {} }).success).toBe(false);
  });

  it("emptyEdit is a valid, empty edit", () => {
    expect(parseEdit(emptyEdit())).toEqual({ version: 1, crops: {} });
  });
});

describe("cropToPixels", () => {
  const W = 1440;
  const H = 900;

  it("maps a normalized rect to rounded pixel bounds inside the image", () => {
    const r: Rect = { x: 0.25, y: 0.5, w: 0.5, h: 0.25 };
    expect(cropToPixels(r, W, H)).toEqual({ left: 360, top: 450, width: 720, height: 225 });
  });

  it("keeps the region inside the image even at the far edge", () => {
    const r: Rect = { x: 0.5, y: 0.5, w: 0.5, h: 0.5 };
    const px = cropToPixels(r, W, H);
    expect(px.left + px.width).toBeLessThanOrEqual(W);
    expect(px.top + px.height).toBeLessThanOrEqual(H);
  });

  it("never returns a zero-size extent", () => {
    const r: Rect = { x: 0, y: 0, w: 0.0005, h: 0.0005 };
    const px = cropToPixels(r, W, H);
    expect(px.width).toBeGreaterThanOrEqual(1);
    expect(px.height).toBeGreaterThanOrEqual(1);
  });

  it("maps a full-frame rect back to the whole image", () => {
    expect(cropToPixels({ x: 0, y: 0, w: 1, h: 1 }, W, H)).toEqual({
      left: 0,
      top: 0,
      width: W,
      height: H,
    });
  });
});
