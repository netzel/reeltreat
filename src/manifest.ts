import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

/** A single screen to capture. */
export const ShotSchema = z.object({
  /** Slug used in output filenames: lowercase letters, numbers and hyphens only. */
  id: z
    .string()
    .regex(
      /^[a-z0-9-]+$/,
      "shot id must be a slug (lowercase letters, numbers, hyphens only)",
    ),
  /** Route path (or full URL) to visit, resolved against the manifest baseUrl. */
  path: z.string(),
  /** Human-readable caption for the shot. */
  caption: z.string(),
  /** Optional CSS selector to await before screenshotting. */
  waitFor: z.string().optional(),
  /** Optional extra settle time in milliseconds after load. */
  delayMs: z.number().int().nonnegative().optional(),
  /** Capture the full scrollable page rather than just the viewport. */
  fullPage: z.boolean().default(false),
});
export type Shot = z.infer<typeof ShotSchema>;

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
    shots: z.array(ShotSchema).min(1, "at least one shot is required"),
  })
  .refine(
    (m) => new Set(m.shots.map((s) => s.id)).size === m.shots.length,
    { message: "shot ids must be unique", path: ["shots"] },
  );
export type Manifest = z.infer<typeof ManifestSchema>;

/**
 * Read projects/<projectName>.yaml, parse and validate it.
 * Throws a clear error naming the file and the validation issues if invalid.
 */
export function loadManifest(projectName: string): Manifest {
  const file = resolve("projects", `${projectName}.yaml`);

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
