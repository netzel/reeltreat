import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Brand } from "./manifest.js";

/**
 * Best-effort brand-token extraction from a repo's stylesheets and config.
 * Never invents values: anything not found is simply omitted so the manifest
 * defaults apply.
 */

// Common global-stylesheet locations across Next.js / Vite / SvelteKit.
const CSS_CANDIDATES = [
  "app/globals.css",
  "src/app/globals.css",
  "styles/globals.css",
  "src/styles/globals.css",
  "src/index.css",
  "src/app.css",
  "app/global.css",
  "globals.css",
];

const TAILWIND_CANDIDATES = [
  "tailwind.config.js",
  "tailwind.config.ts",
  "tailwind.config.cjs",
  "tailwind.config.mjs",
];

const LOGO_CANDIDATES = [
  "public/logo.svg",
  "public/logo.png",
  "public/icon.svg",
  "app/icon.png",
  "public/icon.png",
  "static/logo.svg",
  "static/logo.png",
];

/** CSS-variable names that plausibly hold the primary/brand color, in order. */
const PRIMARY_NAMES = ["primary", "brand", "brand-primary", "color-primary", "brand-color"];
/** CSS-variable names that plausibly hold the accent/secondary color, in order. */
const ACCENT_NAMES = ["accent", "secondary", "brand-accent", "color-accent"];

const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const COLOR_FUNC = /^(?:rgb|hsl)a?\(/i;

/** Concatenate the text of every candidate file that exists. */
function readCandidates(repoPath: string, candidates: string[]): string {
  let text = "";
  for (const rel of candidates) {
    const p = join(repoPath, rel);
    if (existsSync(p)) {
      try {
        text += readFileSync(p, "utf8") + "\n";
      } catch {
        /* unreadable file — skip */
      }
    }
  }
  return text;
}

/** Parse `--name: value;` custom properties into a name -> value map. */
function parseCssVars(css: string): Map<string, string> {
  const vars = new Map<string, string>();
  const re = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    vars.set(m[1].toLowerCase(), m[2].trim());
  }
  return vars;
}

/**
 * Resolve a CSS-variable value to a usable color string, following one level of
 * `var(--other)` indirection. Returns undefined if it isn't a color.
 */
function asColor(value: string, vars: Map<string, string>): string | undefined {
  const ref = /^var\(\s*--([\w-]+)/.exec(value);
  if (ref) {
    const target = vars.get(ref[1].toLowerCase());
    return target ? asColor(target, vars) : undefined;
  }
  const hex = HEX.exec(value);
  if (hex) return hex[0];
  if (COLOR_FUNC.test(value.trim())) return value.trim();
  return undefined;
}

/** First named variable whose value resolves to a color. */
function pickNamed(
  names: string[],
  vars: Map<string, string>,
): string | undefined {
  for (const name of names) {
    const v = vars.get(name);
    if (v) {
      const c = asColor(v, vars);
      if (c) return c;
    }
  }
  return undefined;
}

/** Expand a 3/4-digit hex to 6 digits and return [r,g,b], or null. */
function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) {
    h = h
      .slice(0, 3)
      .split("")
      .map((c) => c + c)
      .join("");
  } else if (h.length === 8) {
    h = h.slice(0, 6);
  } else if (h.length !== 6) {
    return null;
  }
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A near-grey / black / white color makes a poor brand accent. */
function isNeutral(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  return Math.max(...rgb) - Math.min(...rgb) < 16;
}

/** Non-neutral hex colors in the text, most frequently referenced first. */
function rankHexColors(text: string): string[] {
  const counts = new Map<string, number>();
  const re = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const hex = m[0].toLowerCase();
    if (isNeutral(hex)) continue;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
}

/**
 * Extract partial brand tokens from a repo. Prefers CSS variables named like
 * primary/brand/accent; otherwise falls back to the most frequently referenced
 * non-neutral hex colors. Records a logo if one is found at a common path.
 */
export function extractBrand(repoPath: string): Brand {
  const brand: Brand = {};

  const cssText = readCandidates(repoPath, CSS_CANDIDATES);
  const allStyleText = cssText + readCandidates(repoPath, TAILWIND_CANDIDATES);
  const vars = parseCssVars(cssText);

  const primary = pickNamed(PRIMARY_NAMES, vars);
  const accent = pickNamed(ACCENT_NAMES, vars);
  if (primary) brand.primaryColor = primary;
  if (accent) brand.accentColor = accent;

  if (!brand.primaryColor || !brand.accentColor) {
    const ranked = rankHexColors(allStyleText);
    if (!brand.primaryColor && ranked[0]) brand.primaryColor = ranked[0];
    if (!brand.accentColor) {
      const next = ranked.find((c) => c !== brand.primaryColor);
      if (next) brand.accentColor = next;
    }
  }

  const logo = LOGO_CANDIDATES.find((rel) => existsSync(join(repoPath, rel)));
  if (logo) brand.logoPath = "./" + logo;

  return brand;
}
