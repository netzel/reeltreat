import { join, resolve } from "node:path";

/**
 * src/paths.ts — the single source of truth for a project's on-disk layout.
 *
 * Everything belonging to one project lives under a single folder,
 * projects/<name>/, with clearly-named subfolders instead of scattering assets
 * across separate top-level trees:
 *
 *   projects/<name>/
 *     manifest.yaml   the project manifest (shots, viewport, brand)
 *     manual/         raw screenshots you took by hand (source for image shots)
 *     captures/       normalized shots capture writes — browser captures AND the
 *                     normalized copies of your manual images, all NN-<id>.png
 *     curated/        the shots curation picked, copied here in video order so you
 *                     can see at a glance exactly what the reel draws from
 *     curation.json   the cached AI curation result
 *     renders/        the rendered demo-<N>s.mp4 files and poster.png
 *
 * Manifest-relative asset paths (a shot's `image`, a brand `logoPath`) resolve
 * against the project folder, so a manifest can reference `manual/foo.png` and
 * `assets/logo.svg` and stay fully self-contained. Absolute paths are honored
 * as-is. Login secrets stay outside this folder, under auth/, so a project
 * folder holds only browsable assets.
 */

/** The project's root folder: projects/<name>/. Base for manifest-relative paths. */
export function projectDir(project: string): string {
  return resolve("projects", project);
}

/** The project manifest: projects/<name>/manifest.yaml. */
export function manifestPath(project: string): string {
  return join(projectDir(project), "manifest.yaml");
}

/** Raw hand-taken source screenshots: projects/<name>/manual/. */
export function manualDir(project: string): string {
  return join(projectDir(project), "manual");
}

/** Normalized shots capture writes (browser + manual): projects/<name>/captures/. */
export function capturesDir(project: string): string {
  return join(projectDir(project), "captures");
}

/** The final curated set, in video order: projects/<name>/curated/. */
export function curatedDir(project: string): string {
  return join(projectDir(project), "curated");
}

/** Cached curation result: projects/<name>/curation.json. */
export function curationPath(project: string): string {
  return join(projectDir(project), "curation.json");
}

/** Rendered videos and poster: projects/<name>/renders/. */
export function rendersDir(project: string): string {
  return join(projectDir(project), "renders");
}
