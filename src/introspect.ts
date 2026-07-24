import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";

/**
 * Framework-aware route discovery.
 *
 * Every directory/filename convention encoded here is taken from current
 * official docs, cited inline. Do not guess at conventions — verify first.
 */

export type Framework =
  | "next-app"
  | "next-pages"
  | "vite-react"
  | "sveltekit"
  | "unknown";

/** A route discovered by walking a repo's source tree. */
export interface DiscoveredRoute {
  /** URL path, e.g. "/dashboard" or "/blog/[slug]" (dynamic segments kept as-is). */
  routePath: string;
  /** Repo-relative path (forward slashes) to the source file that defines it. */
  sourceFile: string;
  isDynamic: boolean;
  /** Names of the dynamic segments, e.g. ["slug"] for /blog/[slug]. */
  dynamicSegments: string[];
}

/** Page-file extensions common to Next.js / React projects. */
const PAGE_EXTS = [".js", ".jsx", ".ts", ".tsx"];

function readPackageJson(repoPath: string): Record<string, unknown> | null {
  const file = join(repoPath, "package.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function allDeps(pkg: Record<string, unknown> | null): Record<string, string> {
  if (!pkg) return {};
  return {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  };
}

/** First of the candidate relative dirs that exists under repoPath, or null. */
function firstDir(repoPath: string, candidates: string[]): string | null {
  for (const rel of candidates) {
    const p = join(repoPath, rel);
    if (existsSync(p) && statSync(p).isDirectory()) return p;
  }
  return null;
}

// Next.js supports both the root and a `src/` parent for its routing dirs.
// https://nextjs.org/docs/app/getting-started/project-structure
const appDirOf = (repo: string) => firstDir(repo, ["app", "src/app"]);
const pagesDirOf = (repo: string) => firstDir(repo, ["pages", "src/pages"]);
// SvelteKit routes live in src/routes by default.
// https://svelte.dev/docs/kit/routing
const routesDirOf = (repo: string) => firstDir(repo, ["src/routes", "routes"]);

/**
 * Detect the framework from package.json dependencies plus directory layout.
 * SvelteKit and Next both depend on Vite/React transitively, so the more
 * specific frameworks are checked first.
 */
export function detectFramework(repoPath: string): Framework {
  const deps = allDeps(readPackageJson(repoPath));

  if ("@sveltejs/kit" in deps) return "sveltekit";

  if ("next" in deps) {
    // App Router takes precedence over Pages Router when both exist.
    // https://nextjs.org/docs/app/getting-started/layouts-and-pages
    if (appDirOf(repoPath)) return "next-app";
    if (pagesDirOf(repoPath)) return "next-pages";
    return "next-app";
  }

  if ("vite" in deps && ("react" in deps || "react-dom" in deps)) {
    return "vite-react";
  }

  return "unknown";
}

/** Recursively list every file under dir (absolute paths). Empty if missing. */
function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

/** True if a path segment is a dynamic segment like [id], [...slug], [[...slug]]. */
function isDynamicSegment(seg: string): boolean {
  return /\[.+\]/.test(seg);
}

/**
 * Bare name of a dynamic segment: [id] -> id, [...slug] -> slug,
 * [[...slug]] -> slug, and SvelteKit matchers [page=integer] -> page.
 */
function extractDynamicName(seg: string): string {
  return seg
    .replace(/[[\]]/g, "")
    .replace(/^\.\.\./, "")
    .split("=")[0]
    .trim();
}

/** Repo-relative path with forward slashes, for stable cross-platform output. */
function relForward(repoPath: string, file: string): string {
  return relative(repoPath, file).split("\\").join("/");
}

/**
 * Next.js App Router: a `page` file makes its containing folder a route.
 * https://nextjs.org/docs/app/getting-started/layouts-and-pages
 * - Route groups `(group)` are omitted from the URL.
 *   https://nextjs.org/docs/app/api-reference/file-conventions/route-groups
 * - Private folders `_folder` and parallel-route slots `@slot` are not routable.
 *   https://nextjs.org/docs/app/getting-started/project-structure
 * - `api/` uses `route.ts` handlers (no `page` file) and is skipped anyway.
 * layout/error/loading/not-found files are ignored because they are not `page`.
 */
function discoverNextApp(repoPath: string, appDir: string): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];
  for (const file of walkFiles(appDir)) {
    const ext = extname(file);
    if (basename(file, ext) !== "page" || !PAGE_EXTS.includes(ext)) continue;

    const relDir = relative(appDir, dirname(file));
    const segments = relDir === "" ? [] : relDir.split(/[\\/]/);

    const urlSegments: string[] = [];
    const dynamicSegments: string[] = [];
    let excluded = false;
    for (const seg of segments) {
      if (seg.startsWith("_") || seg.startsWith("@") || seg === "api") {
        excluded = true; // private folder, parallel slot, or API route
        break;
      }
      if (seg.startsWith("(") && seg.endsWith(")")) continue; // route group
      if (isDynamicSegment(seg)) dynamicSegments.push(extractDynamicName(seg));
      urlSegments.push(seg);
    }
    if (excluded) continue;

    routes.push({
      routePath: "/" + urlSegments.join("/"),
      sourceFile: relForward(repoPath, file),
      isDynamic: dynamicSegments.length > 0,
      dynamicSegments,
    });
  }
  return routes;
}

/**
 * Next.js Pages Router: each file under `pages/` is a route.
 * https://nextjs.org/docs/pages/building-your-application/routing/pages-and-layouts
 * - `index` maps to its directory root.
 * - `[id]`/`[...slug]` are dynamic.
 *   https://nextjs.org/docs/pages/building-your-application/routing/dynamic-routes
 * - `pages/api` and underscore files (`_app`, `_document`) are excluded.
 */
function discoverNextPages(repoPath: string, pagesDir: string): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];
  for (const file of walkFiles(pagesDir)) {
    const ext = extname(file);
    if (!PAGE_EXTS.includes(ext)) continue;

    const relNoExt = relative(pagesDir, file).slice(0, -ext.length);
    const segments = relNoExt.split(/[\\/]/);

    if (segments[0] === "api") continue; // API routes
    if (segments.some((s) => s.startsWith("_"))) continue; // _app, _document, ...

    const urlSegments: string[] = [];
    const dynamicSegments: string[] = [];
    segments.forEach((seg, i) => {
      const isLast = i === segments.length - 1;
      if (isLast && seg === "index") return; // index -> directory root
      if (isDynamicSegment(seg)) dynamicSegments.push(extractDynamicName(seg));
      urlSegments.push(seg);
    });

    routes.push({
      routePath: "/" + urlSegments.join("/"),
      sourceFile: relForward(repoPath, file),
      isDynamic: dynamicSegments.length > 0,
      dynamicSegments,
    });
  }
  return routes;
}

/**
 * SvelteKit: a `+page.svelte` file makes its folder a route.
 * https://svelte.dev/docs/kit/routing
 * - `[slug]` segments are dynamic.
 * - Route groups `(group)` are omitted from the URL.
 *   https://svelte.dev/docs/kit/advanced-routing
 * - `+layout`/`+error`/`+server` files are not pages and are ignored.
 */
function discoverSvelteKit(repoPath: string, routesDir: string): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];
  for (const file of walkFiles(routesDir)) {
    if (basename(file) !== "+page.svelte") continue;

    const relDir = relative(routesDir, dirname(file));
    const segments = relDir === "" ? [] : relDir.split(/[\\/]/);

    const urlSegments: string[] = [];
    const dynamicSegments: string[] = [];
    for (const seg of segments) {
      if (seg.startsWith("(") && seg.endsWith(")")) continue; // route group
      if (isDynamicSegment(seg)) dynamicSegments.push(extractDynamicName(seg));
      urlSegments.push(seg);
    }

    routes.push({
      routePath: "/" + urlSegments.join("/"),
      sourceFile: relForward(repoPath, file),
      isDynamic: dynamicSegments.length > 0,
      dynamicSegments,
    });
  }
  return routes;
}

/** Auth/utility paths that are never worth putting in a demo reel. */
const NON_DEMO = /(^|\/)(api|login|logout|sign-?in|sign-?out|sign-?up|register|auth|callback|oauth)(\/|$)/i;

/** Exclude routes that are obviously not demo-worthy (auth flows, APIs). */
export function isDemoWorthy(routePath: string): boolean {
  return !NON_DEMO.test(routePath);
}

/**
 * Discover routes for a repo. Returns demo-worthy routes, de-duplicated by URL
 * and sorted by path. Vite/React has no filesystem routing convention, and an
 * unknown framework has none either, so both return an empty list — the caller
 * tells the user to hand-author the manifest from projects/example/manifest.yaml.
 */
export function discoverRoutes(
  repoPath: string,
  framework: Framework,
): DiscoveredRoute[] {
  let routes: DiscoveredRoute[];
  switch (framework) {
    case "next-app": {
      const d = appDirOf(repoPath);
      routes = d ? discoverNextApp(repoPath, d) : [];
      break;
    }
    case "next-pages": {
      const d = pagesDirOf(repoPath);
      routes = d ? discoverNextPages(repoPath, d) : [];
      break;
    }
    case "sveltekit": {
      const d = routesDirOf(repoPath);
      routes = d ? discoverSvelteKit(repoPath, d) : [];
      break;
    }
    default:
      routes = [];
  }

  const seen = new Set<string>();
  return routes
    .filter((r) => isDemoWorthy(r.routePath))
    .sort((a, b) => a.routePath.localeCompare(b.routePath))
    .filter((r) => (seen.has(r.routePath) ? false : (seen.add(r.routePath), true)));
}
