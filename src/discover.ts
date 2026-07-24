import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { isDemoWorthy } from "./introspect.js";
import type { Viewport } from "./manifest.js";

/**
 * src/discover.ts — auto-discover the screens of a *deployed* site for a
 * repo-free project. reeltreat can't read the source, so it opens the site with
 * Playwright (so client-rendered links resolve), reads the in-page links, and
 * turns the same-origin ones into shot candidates. The link → routes mapping is a
 * pure function (linksToRoutes) so it's fully unit-tested; crawlScreens is the
 * thin browser wrapper around it.
 */

/** A discovered screen: a route path plus a suggested shot id and caption. */
export interface DiscoveredScreen {
  path: string;
  id: string;
  caption: string;
}

/** A link as read from the page: an absolute href and its visible text. */
export interface PageLink {
  href: string;
  text: string;
}

/** File extensions that are assets, not pages. */
const NON_PAGE_EXT =
  /\.(png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|cjs|map|json|xml|txt|pdf|zip|gz|tar|mp4|webm|mov|mp3|wav|woff2?|ttf|otf|eot|rss|atom|csv)$/i;

/** Build-tool / asset path prefixes to skip. */
const NON_PAGE_PREFIX = /^\/(_next|_nuxt|static|assets|cdn-cgi|__|node_modules)(\/|$)/i;

/** Slugify a path into a shot id (lowercase letters, numbers, hyphens). */
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "screen"
  );
}

/** Title-case a path segment for a fallback caption ("user-settings" → "User Settings"). */
function titleCase(seg: string): string {
  return seg
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Normalize link text into a caption, or "" if it's empty / too long to be one. */
function cleanCaption(text: string): string {
  const c = text.replace(/\s+/g, " ").trim();
  return c.length > 0 && c.length <= 60 ? c : "";
}

/**
 * Turn a page's links into de-duplicated, demo-worthy shot candidates, resolved
 * against `baseUrl`. Keeps only same-origin HTML routes (drops assets, auth/api
 * paths via isDemoWorthy, cross-origin, and non-http links), always includes the
 * home route "/", assigns each a unique slug id and a caption (link text when
 * usable, else the title-cased last segment), and caps the result.
 */
export function linksToRoutes(
  links: PageLink[],
  baseUrl: string,
  opts: { max?: number } = {},
): DiscoveredScreen[] {
  const max = opts.max ?? 12;
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }

  // path -> best caption hint (first non-empty link text wins).
  const byPath = new Map<string, string>();
  byPath.set("/", ""); // always offer the home page

  for (const { href, text } of links) {
    let u: URL;
    try {
      u = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    if (u.host !== base.host) continue;
    const path = u.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
    if (path !== "/" && (NON_PAGE_EXT.test(path) || NON_PAGE_PREFIX.test(path))) continue;
    if (!isDemoWorthy(path)) continue;
    const t = (text || "").trim();
    if (!byPath.has(path)) byPath.set(path, t);
    else if (!byPath.get(path) && t) byPath.set(path, t);
  }

  // Home first, then alphabetical.
  const entries = [...byPath.entries()].sort((a, b) =>
    a[0] === "/" ? -1 : b[0] === "/" ? 1 : a[0].localeCompare(b[0]),
  );

  const usedIds = new Set<string>();
  const uniqueId = (basis: string): string => {
    let id = basis;
    let n = 2;
    while (usedIds.has(id)) id = `${basis}-${n++}`;
    usedIds.add(id);
    return id;
  };

  const out: DiscoveredScreen[] = [];
  for (const [path, text] of entries.slice(0, max)) {
    const id = uniqueId(path === "/" ? "home" : slugify(path));
    const lastSeg = path === "/" ? "Home" : titleCase(path.split("/").filter(Boolean).pop() || "Home");
    const caption = cleanCaption(text) || lastSeg;
    out.push({ path, id, caption });
  }
  return out;
}

export interface CrawlOptions {
  /** Saved session, used only if the file exists (some sites gate nav behind login). */
  statePath?: string;
  viewport?: Viewport;
  timeoutMs?: number;
  /** Settle delay after load, for client-rendered nav. */
  delayMs?: number;
  max?: number;
}

/**
 * Open `baseUrl` in headless Chromium, read its links, and return the discovered
 * screens. Honors PLAYWRIGHT_BROWSER_EXECUTABLE (offline/locked-down envs) and an
 * existing saved session, mirroring capture. Link extraction uses the string form
 * of page.evaluate so no DOM lib is needed at build time.
 */
export async function crawlScreens(
  baseUrl: string,
  opts: CrawlOptions = {},
): Promise<DiscoveredScreen[]> {
  const executablePath = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE || undefined;
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  try {
    const context = await browser.newContext({
      viewport: opts.viewport ?? { width: 1440, height: 900 },
      ...(opts.statePath && existsSync(opts.statePath) ? { storageState: opts.statePath } : {}),
    });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "load", timeout: opts.timeoutMs ?? 30000 });
    if (opts.delayMs) await page.waitForTimeout(opts.delayMs);
    const raw = await page.evaluate(
      "Array.from(document.querySelectorAll('a[href]')).map(function(a){return {href:a.href,text:(a.textContent||'').trim()};})",
    );
    const links = (Array.isArray(raw) ? raw : []) as PageLink[];
    return linksToRoutes(links, baseUrl, { max: opts.max });
  } finally {
    await browser.close();
  }
}
