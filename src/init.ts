import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { Brand } from "./manifest.js";
import {
  detectFramework,
  discoverRoutes,
  type DiscoveredRoute,
  type Framework,
} from "./introspect.js";
import { extractBrand } from "./brand.js";
import {
  collectRouteExcerpts,
  generateCaptions,
  MAX_INCLUDED,
  type CaptionClient,
  type CaptionPlan,
} from "./captions.js";
import { TODO_BASE_URL, TODO_ID } from "./doctor.js";
import { loadEnv } from "./env.js";

/** Placeholder base URL suggested when --base-url is omitted. */
const BASE_URL_HINT = "http://localhost:3000";
const DEFAULT_VIEWPORT = { width: 1440, height: 900 };

/** An active shot ready to write into the manifest. */
export interface PlannedShot {
  id: string;
  path: string;
  caption: string;
  priority: number;
}

/** A dynamic route emitted commented-out, needing a real id substituted in. */
export interface PlannedDynamicShot {
  id: string;
  /** Route path with each dynamic segment replaced by the <ID> token. */
  path: string;
  caption: string;
  dynamicSegments: string[];
}

export interface ShotPlan {
  active: PlannedShot[];
  dynamic: PlannedDynamicShot[];
}

function slugify(s: string): string {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "shot";
}

/** Ensure slug uniqueness by suffixing -2, -3, ... on collisions. */
function uniqueSlug(base: string, used: Set<string>): string {
  let slug = base;
  let n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  used.add(slug);
  return slug;
}

/** Replace every dynamic segment in a route path with the <ID> token. */
function toPlaceholderPath(routePath: string): string {
  return routePath.replace(/\[[^\]]+\]/g, TODO_ID);
}

/**
 * Merge discovered routes with the model's caption plan into active shots and
 * commented dynamic shots. Only included routes are kept; dynamic routes never
 * become active shots (their path would be unusable), and active shots are
 * capped at MAX_INCLUDED, ordered by priority.
 */
export function planShots(
  routes: DiscoveredRoute[],
  plan: CaptionPlan,
): ShotPlan {
  const byPath = new Map(routes.map((r) => [r.routePath, r]));
  const used = new Set<string>();
  const active: PlannedShot[] = [];
  const dynamic: PlannedDynamicShot[] = [];

  const included = plan.routes
    .filter((r) => r.include)
    .sort((a, b) => a.priority - b.priority);

  for (const r of included) {
    const discovered = byPath.get(r.routePath);
    if (!discovered) continue; // model hallucinated a path
    const id = uniqueSlug(slugify(r.id || r.routePath), used);

    if (discovered.isDynamic) {
      dynamic.push({
        id,
        path: toPlaceholderPath(discovered.routePath),
        caption: r.caption,
        dynamicSegments: discovered.dynamicSegments,
      });
    } else if (active.length < MAX_INCLUDED) {
      active.push({ id, path: discovered.routePath, caption: r.caption, priority: r.priority });
    }
  }

  return { active, dynamic };
}

/** Double-quoted YAML scalar (JSON string syntax is valid YAML). */
function yamlStr(s: string): string {
  return JSON.stringify(s);
}

/**
 * Build the loud TODO block that opens the file. Only lists items that actually
 * apply, numbered with real counts; if nothing needs editing, returns a single
 * "ready to run" line instead.
 */
export function buildTodoBlock(
  project: string,
  baseUrlIsPlaceholder: boolean,
  dynamicCount: number,
): string {
  const items: string[] = [];
  if (baseUrlIsPlaceholder) {
    items.push("Set baseUrl below (currently a placeholder)");
  }
  if (dynamicCount > 0) {
    const noun = dynamicCount === 1 ? "route" : "routes";
    items.push(
      `Replace ${TODO_ID} in the ${dynamicCount} dynamic ${noun} at the bottom\n#        and uncomment them`,
    );
  }

  if (items.length === 0) {
    return `# This manifest is ready to run:  npm run login -- ${project}`;
  }

  const bar = "# " + "=".repeat(60);
  const rule = "# " + "-".repeat(60);
  const noun = items.length === 1 ? "item" : "items";
  const lines = [
    bar,
    `# TODO — ${items.length} ${noun} before this will run`,
    rule,
    ...items.map((it, i) => `# [ ] ${i + 1}. ${it}`),
    "#",
    "# Delete this block when done, then run:",
    `#   npm run login -- ${project}`,
    bar,
  ];
  return lines.join("\n");
}

export interface ManifestYamlInput {
  project: string;
  baseUrl: string;
  viewport: { width: number; height: number };
  brand: Brand;
  active: PlannedShot[];
  dynamic: PlannedDynamicShot[];
}

/**
 * Render the full manifest YAML text: header TODO block, config, active shots,
 * and a single commented "Dynamic routes" section at the very bottom.
 */
export function buildManifestYaml(input: ManifestYamlInput): string {
  const { project, baseUrl, viewport, brand, active, dynamic } = input;
  const baseUrlIsPlaceholder = baseUrl === TODO_BASE_URL;
  const out: string[] = [];

  out.push(buildTodoBlock(project, baseUrlIsPlaceholder, dynamic.length));
  out.push("");
  out.push("# Generated by `npm run init`. Edit freely — see projects/example.yaml for all options.");
  out.push("");
  out.push(`name: ${yamlStr(project)}`);
  out.push("");

  if (baseUrlIsPlaceholder) {
    out.push(`# TODO: set this to your app, e.g. ${BASE_URL_HINT}`);
    out.push(`baseUrl: ${TODO_BASE_URL}`);
  } else {
    out.push(`baseUrl: ${yamlStr(baseUrl)}`);
  }
  out.push("");

  out.push("viewport:");
  out.push(`  width: ${viewport.width}`);
  out.push(`  height: ${viewport.height}`);
  out.push("");

  const brandLines = Object.entries(brand).filter(([, v]) => v != null);
  if (brandLines.length > 0) {
    out.push("brand:");
    for (const [key, value] of brandLines) {
      out.push(`  ${key}: ${yamlStr(String(value))}`);
    }
  } else {
    out.push("# brand: (none auto-detected — see projects/example.yaml to add a logo/colors)");
  }
  out.push("");

  // Capture defaults applied to every shot below unless the shot overrides them.
  out.push("# Capture defaults for every shot below (per-shot value > this > built-in).");
  out.push("defaults:");
  out.push("  # Settle delay (ms) so client-rendered pages finish loading their data");
  out.push("  # before the screenshot — avoids capturing loading skeletons.");
  out.push("  delayMs: 2000");
  out.push("  # For pages holding an open connection (streaming, polling, websockets),");
  out.push("  # set waitUntil: domcontentloaded here rather than raising the timeout.");
  out.push("");

  out.push("# Screens to capture, in priority order.");
  out.push("shots:");
  if (active.length === 0) {
    out.push("  # (no static routes were auto-discovered — add shots by hand)");
  }
  for (const shot of active) {
    out.push(`  - id: ${shot.id}`);
    out.push(`    path: ${yamlStr(shot.path)}`);
    out.push(`    caption: ${yamlStr(shot.caption)}`);
  }

  if (dynamic.length > 0) {
    out.push("");
    out.push("# --- Dynamic routes: need a real id ---");
    out.push(`# These have URL parameters. Replace ${TODO_ID} with a real value and`);
    out.push("# uncomment to include them.");
    for (const shot of dynamic) {
      out.push("#");
      out.push(`#  - id: ${shot.id}`);
      out.push(`#    # segment(s): ${shot.dynamicSegments.join(", ")}`);
      out.push(`#    path: ${shot.path}`);
      out.push(`#    caption: ${yamlStr(shot.caption)}`);
    }
  }

  return out.join("\n") + "\n";
}

/** Terminal summary — ends with the same TODO list, so it's visible without opening the file. */
function printSummary(
  project: string,
  framework: Framework,
  found: number,
  plan: ShotPlan,
  brand: Brand,
  baseUrlIsPlaceholder: boolean,
  outPath: string,
): void {
  const brandKeys = Object.keys(brand);
  console.log(`\nWrote ${outPath}`);
  console.log(`  framework:        ${framework}`);
  console.log(`  routes found:     ${found}`);
  console.log(`  shots included:   ${plan.active.length}`);
  console.log(`  dynamic (manual): ${plan.dynamic.length}`);
  console.log(
    `  brand tokens:     ${brandKeys.length ? brandKeys.join(", ") : "none"}`,
  );

  console.log("");
  console.log(buildTodoBlock(project, baseUrlIsPlaceholder, plan.dynamic.length));

  console.log("\nNext:");
  console.log(`  npm run login   -- ${project}`);
  console.log(`  npm run capture -- ${project}`);
  console.log(`  npm run curate  -- ${project}`);
}

interface Args {
  project: string;
  repo: string;
  baseUrl?: string;
  force: boolean;
}

function parseArgs(argv: string[]): Args {
  let project: string | undefined;
  let repo: string | undefined;
  let baseUrl: string | undefined;
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repo") repo = argv[++i];
    else if (a === "--base-url") baseUrl = argv[++i];
    else if (a === "--force") force = true;
    else if (!a.startsWith("--") && !project) project = a;
  }

  if (!project || !repo) {
    throw new Error(
      "Usage: npm run init -- <project> --repo <path-to-local-repo> [--base-url <url>] [--force]",
    );
  }
  return { project, repo, baseUrl, force };
}

async function main(): Promise<void> {
  const { project, repo, baseUrl, force } = parseArgs(process.argv.slice(2));

  const repoPath = resolve(repo);
  if (!existsSync(repoPath)) {
    console.error(`Repo path does not exist: ${repoPath}`);
    process.exit(1);
  }
  if (!existsSync(resolve(repoPath, "package.json"))) {
    console.error(`No package.json in ${repoPath} — is this a JS/TS app repo?`);
    process.exit(1);
  }

  const outPath = resolve("projects", `${project}.yaml`);
  if (existsSync(outPath) && !force) {
    console.error(
      `${outPath} already exists. Pass --force to overwrite it.`,
    );
    process.exit(1);
  }

  const framework = detectFramework(repoPath);
  if (framework === "unknown") {
    console.error(
      `Could not detect a supported framework in ${repoPath}.\n` +
        `Supported: Next.js (App/Pages Router), SvelteKit, Vite + React.\n` +
        `Write the manifest by hand from projects/example.yaml instead.`,
    );
    process.exit(1);
  }

  const routes = discoverRoutes(repoPath, framework);
  if (routes.length === 0) {
    console.error(
      `Detected ${framework}, but no routes could be auto-discovered ` +
        `(this framework has no filesystem routing convention reeltreat can read).\n` +
        `Write the manifest by hand from projects/example.yaml instead.`,
    );
    process.exit(1);
  }

  const brand = extractBrand(repoPath);

  const { anthropicApiKey } = loadEnv();

  const excerpts = collectRouteExcerpts(repoPath, routes);
  const client = new Anthropic({ apiKey: anthropicApiKey }) as CaptionClient;
  const { plan } = await generateCaptions(client, excerpts);
  const shotPlan = planShots(routes, plan);

  const effectiveBaseUrl = baseUrl ?? TODO_BASE_URL;
  const yaml = buildManifestYaml({
    project,
    baseUrl: effectiveBaseUrl,
    viewport: DEFAULT_VIEWPORT,
    brand,
    active: shotPlan.active,
    dynamic: shotPlan.dynamic,
  });

  mkdirSync(resolve("projects"), { recursive: true });
  writeFileSync(outPath, yaml);

  printSummary(
    project,
    framework,
    routes.length,
    shotPlan,
    brand,
    effectiveBaseUrl === TODO_BASE_URL,
    outPath,
  );
}

/** True when this file is run directly (not imported by tests). */
function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
