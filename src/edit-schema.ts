import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { editPath } from "./paths.js";

/**
 * src/edit-schema.ts — the per-project creative-overrides layer, edit.json.
 *
 * capture writes the source screenshots and curation picks/orders them; those
 * two are the AI's work and are never mutated by editing. edit.json is the whole
 * record of the user's *non-destructive* tweaks on top — for now, a per-shot
 * crop rectangle. Because the originals on disk are untouched, deleting an entry
 * resets that shot to the AI default, and a re-capture or re-curate never wipes
 * an edit. The render layer (src/reel.ts + src/render.ts) merges this over the
 * curation at render time.
 *
 * The shape is versioned so later per-frame controls (motion, duration) can
 * extend it without breaking older files.
 */

/** Shot-id slug rule, matching the manifest's ShotSchema. */
const SLUG_RE = /^[a-z0-9-]+$/;

/** Small tolerance so floating-point crop math from the UI isn't rejected. */
const EPS = 1e-6;

/**
 * A crop rectangle, normalized to the *source* screenshot: every value is a
 * fraction in [0,1], so a crop survives a re-capture at a different viewport.
 * The rect must have positive area and stay inside the image.
 */
export const RectSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  })
  .refine((r) => r.w > 0 && r.h > 0, {
    message: "crop width and height must be greater than 0",
  })
  .refine((r) => r.x + r.w <= 1 + EPS && r.y + r.h <= 1 + EPS, {
    message: "crop must stay within the image (x+w ≤ 1 and y+h ≤ 1)",
  });
export type Rect = z.infer<typeof RectSchema>;

/**
 * The full edit.json shape. `crops` is keyed by shot id; a crop for a shot that
 * no longer exists is simply ignored at render time, so the file is robust to
 * manifest drift.
 */
export const EditSchema = z.object({
  version: z.literal(1),
  crops: z.record(z.string().regex(SLUG_RE), RectSchema).default({}),
});
export type Edit = z.infer<typeof EditSchema>;

/** An empty edit — what a project with no edit.json resolves to. */
export function emptyEdit(): Edit {
  return { version: 1, crops: {} };
}

/**
 * Convert a normalized crop rect to integer pixel bounds for `sharp.extract`,
 * against a source image of `width`×`height`. Rounds, then clamps so the region
 * always stays inside the image with at least a 1px extent. Pure and exported so
 * the rounding/clamping is unit-tested without touching sharp.
 */
export function cropToPixels(
  crop: Rect,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } {
  const left = Math.min(Math.max(Math.round(crop.x * width), 0), width - 1);
  const top = Math.min(Math.max(Math.round(crop.y * height), 0), height - 1);
  const w = Math.min(Math.max(Math.round(crop.w * width), 1), width - left);
  const h = Math.min(Math.max(Math.round(crop.h * height), 1), height - top);
  return { left, top, width: w, height: h };
}

/** Validate a raw payload as an Edit, throwing an aggregated error if invalid. */
export function parseEdit(raw: unknown): Edit {
  const result = EditSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid edit.json:\n${issues}`);
  }
  return result.data;
}

/** Read + validate projects/<project>/edit.json, or an empty edit if absent. */
export function loadEdit(project: string): Edit {
  const file = editPath(project);
  if (!existsSync(file)) return emptyEdit();
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse ${file}: ${msg}`);
  }
  return parseEdit(data);
}

/** Validate + write projects/<project>/edit.json. */
export function saveEdit(project: string, edit: Edit): void {
  const validated = parseEdit(edit);
  mkdirSync(dirname(editPath(project)), { recursive: true });
  writeFileSync(editPath(project), JSON.stringify(validated, null, 2));
}
