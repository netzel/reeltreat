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

/**
 * Per-project creative overrides — crops today, more later: projects/<name>/edit.json.
 * Layered over the AI curation at render time; the captured screenshots stay untouched.
 */
export function editPath(project: string): string {
  return join(projectDir(project), "edit.json");
}

/** Rendered videos and poster: projects/<name>/renders/. */
export function rendersDir(project: string): string {
  return join(projectDir(project), "renders");
}

/**
 * A unique, filesystem- and sort-safe id for one render run, derived from the
 * moment it started, e.g. "2026-07-24_164512-789". Lexical order matches
 * chronological order, so listing runs sorts newest-last. Each render writes
 * into its own renders/<runId>/ folder, so a new render never overwrites an
 * earlier one — every video produced is kept.
 */
export function renderRunId(now: Date): string {
  const p = (n: number, width = 2): string => String(n).padStart(width, "0");
  return (
    `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}` +
    `_${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}` +
    `-${p(now.getMilliseconds(), 3)}`
  );
}

/** The folder a single render run writes into: projects/<name>/renders/<runId>/. */
export function renderRunDir(project: string, runId: string): string {
  return join(rendersDir(project), runId);
}
