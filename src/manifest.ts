import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { manifestPath } from "./paths.js";

/** Allowed navigation-wait values. See Playwright page.goto waitUntil. */
export const WAIT_UNTIL_VALUES = ["load", "domcontentloaded", "networkidle"] as const;
export type WaitUntil = (typeof WAIT_UNTIL_VALUES)[number];

/**
 * How a manual image shot is normalized to the manifest viewport at capture
 * time. "cover" scales to fill and center-crops the overflow; "contain" scales
 * the whole image to fit and pads the remainder with a background color.
 */
export const IMAGE_FIT_VALUES = ["cover", "contain"] as const;
export type ImageFit = (typeof IMAGE_FIT_VALUES)[number];

/**
 * Per-shot browser/capture settings. All optional here: a missing value falls
 * back to the manifest `defaults`, then to a built-in default, resolved by
 * resolveShotSettings — so we must be able to tell "unset" apart from an
 * explicit value, which is why none of these carry a schema-level default.
 */
const captureFields = {
  /**
   * When navigation is considered done. Prefer "domcontentloaded" (plus
   * waitFor/delayMs) for pages with long-lived connections — streaming,
   * polling, or websockets — since "networkidle" never settles and is
   * discouraged by Playwright. Built-in default: "load".
   */
  waitUntil: z.enum(WAIT_UNTIL_VALUES).optional(),
  /** Navigation/selector wait budget in milliseconds. Built-in default: 30000. */
  timeoutMs: z.number().int().positive().optional(),
  /** Optional CSS selector to await before screenshotting. */
  waitFor: z.string().optional(),
  /** Optional extra settle time in milliseconds after load. */
  delayMs: z.number().int().nonnegative().optional(),
  /** Capture the full scrollable page rather than just the viewport. Built-in default: false. */
  fullPage: z.boolean().optional(),
};

/**
 * Per-shot options that apply ONLY to manual image shots. They control how the
 * supplied image is normalized to the viewport and are rejected on browser
 * (path) shots by the superRefine below — the mirror image of how the
 * browser-only captureFields are rejected on image shots.
 */
const imageFields = {
  /**
   * Fit mode when scaling the image to the manifest viewport. "cover" (default)
   * fills and center-crops; "contain" fits the whole image and pads the rest
   * with `background`. Built-in default: "cover".
   */
  fit: z.enum(IMAGE_FIT_VALUES).optional(),
  /**
   * CSS color for the padding when fit is "contain" (ignored for "cover").
   * Parsed by sharp's color module. Built-in default: a neutral dark.
   */
  background: z.string().optional(),
};

/**
 * A single screen. Either a browser capture (`path`) or a manually-supplied
 * screenshot (`image`) — exactly one of the two. `image` is for states
 * automation cannot reach: anything needing real hardware input, live audio, or
 * a human in the loop.
 */
export const ShotSchema = z
  .object({
    /** Slug used in output filenames: lowercase letters, numbers and hyphens only. */
    id: z
      .string()
      .regex(
        /^[a-z0-9-]+$/,
        "shot id must be a slug (lowercase letters, numbers, hyphens only)",
      ),
    /** Route path (or full URL) to visit, resolved against the manifest baseUrl. */
    path: z.string().optional(),
    /**
     * Path to a screenshot you supplied yourself, used in place of `path`.
     * Resolved relative to the repo root if not absolute. Browser-only settings
     * are not allowed alongside it.
     */
    image: z.string().optional(),
    /** Human-readable caption for the shot. */
    caption: z.string(),
    ...captureFields,
    ...imageFields,
  })
  .superRefine((shot, ctx) => {
    const hasPath = shot.path !== undefined;
    const hasImage = shot.image !== undefined;

    if (hasPath && hasImage) {
      ctx.addIssue({
        code: "custom",
        message: "a shot must set either 'path' or 'image', not both",
        path: ["image"],
      });
    } else if (!hasPath && !hasImage) {
      ctx.addIssue({
        code: "custom",
        message: "a shot must set either 'path' (browser capture) or 'image' (manual screenshot)",
        path: ["path"],
      });
    }

    if (hasImage) {
      // Browser-only settings make no sense for a manual screenshot.
      for (const field of Object.keys(captureFields) as (keyof typeof captureFields)[]) {
        if (shot[field] !== undefined) {
          ctx.addIssue({
            code: "custom",
            message: `'${field}' is a browser-only setting and cannot be used on an image shot`,
            path: [field],
          });
        }
      }
    }

    if (hasPath) {
      // Image normalization settings make no sense for a browser capture.
      for (const field of Object.keys(imageFields) as (keyof typeof imageFields)[]) {
        if (shot[field] !== undefined) {
          ctx.addIssue({
            code: "custom",
            message: `'${field}' is an image-only setting and cannot be used on a browser (path) shot`,
            path: [field],
          });
        }
      }
    }
  });
export type Shot = z.infer<typeof ShotSchema>;

/** True if the shot is a manually-supplied image rather than a browser capture. */
export function isImageShot(shot: Shot): shot is Shot & { image: string } {
  return shot.image !== undefined;
}

/**
 * Manifest-level capture defaults, applied to every shot that does not set its
 * own value. Same fields and constraints as the per-shot capture settings.
 */
export const ShotDefaultsSchema = z.object(captureFields);
export type ShotDefaults = z.infer<typeof ShotDefaultsSchema>;

/** Fully-resolved capture settings for one shot. */
export interface ResolvedShotSettings {
  waitUntil: WaitUntil;
  timeoutMs: number;
  waitFor?: string;
  delayMs?: number;
  fullPage: boolean;
}

/**
 * Resolve a shot's capture settings. Precedence per field: an explicit per-shot
 * value wins, else the manifest default, else the built-in default. Pure and
 * exported so capture reads settings through this rather than off the shot.
 */
export function resolveShotSettings(
  shot: Shot,
  defaults: ShotDefaults = {},
): ResolvedShotSettings {
  return {
    waitUntil: shot.waitUntil ?? defaults.waitUntil ?? "load",
    timeoutMs: shot.timeoutMs ?? defaults.timeoutMs ?? 30000,
    waitFor: shot.waitFor ?? defaults.waitFor,
    delayMs: shot.delayMs ?? defaults.delayMs,
    fullPage: shot.fullPage ?? defaults.fullPage ?? false,
  };
}

/** Brand tokens used later by the render layer. */
export const BrandSchema = z.object({
  logoPath: z.string().optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  font: z.string().optional(),
});
export type Brand = z.infer<typeof BrandSchema>;

export const ViewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type Viewport = z.infer<typeof ViewportSchema>;

/** A full project manifest. */
export const ManifestSchema = z
  .object({
    name: z.string().min(1, "name is required"),
    baseUrl: z.url("baseUrl must be a valid URL"),
    viewport: ViewportSchema.default({ width: 1440, height: 900 }),
    /** Where the manual login flow should start (path or full URL). Defaults to baseUrl. */
    loginUrl: z.string().optional(),
    brand: BrandSchema.default({}),
    /** Capture defaults applied to every shot unless the shot overrides them. */
    defaults: ShotDefaultsSchema.default({}),
    shots: z.array(ShotSchema).min(1, "at least one shot is required"),
  })
  .refine(
    (m) => new Set(m.shots.map((s) => s.id)).size === m.shots.length,
    { message: "shot ids must be unique", path: ["shots"] },
  );
export type Manifest = z.infer<typeof ManifestSchema>;

/**
 * Read projects/<projectName>/manifest.yaml, parse and validate it.
 * Throws a clear error naming the file and the validation issues if invalid.
 */
export function loadManifest(projectName: string): Manifest {
  const file = manifestPath(projectName);

  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    throw new Error(`Manifest not found: ${file}`);
  }

  let data: unknown;
  try {
    data = parseYaml(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse YAML in ${file}: ${msg}`);
  }

  const result = ManifestSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid manifest ${file}:\n${issues}`);
  }

  return result.data;
}
