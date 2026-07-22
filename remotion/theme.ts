import type { ReelBrand } from "./types";

/**
 * Neutral fallbacks so a manifest with no brand tokens still renders a clean,
 * non-broken video. Never hardcode branding for any specific application — these
 * are deliberately generic.
 */
export const FALLBACK_PRIMARY = "#12141c";
export const FALLBACK_ACCENT = "#5b8def";
export const FALLBACK_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function primaryColor(brand: ReelBrand): string {
  return brand.primaryColor ?? FALLBACK_PRIMARY;
}

export function accentColor(brand: ReelBrand): string {
  return brand.accentColor ?? FALLBACK_ACCENT;
}

/** Prefer the brand font, falling back to the system stack for missing glyphs. */
export function fontFamily(brand: ReelBrand): string {
  return brand.font ? `${brand.font}, ${FALLBACK_FONT}` : FALLBACK_FONT;
}
