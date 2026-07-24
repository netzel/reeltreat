// Small shared style helpers. The "hatch" patterns stand in for screenshot
// thumbnails throughout the prototype; centralising them avoids drift.

/** Dark diagonal hatch used for screenshot/poster placeholders. */
export function hatch(size = 12, a = "#20232b", b = "#191b22"): string {
  return `repeating-linear-gradient(135deg,${a} 0 ${size}px,${b} ${size}px ${size * 2}px)`;
}

/** Subtle surface hatch used for small thumbnails inside cards. */
export function surfaceHatch(size = 8): string {
  return `repeating-linear-gradient(135deg,var(--surface-2) 0 ${size}px,transparent ${size}px ${size * 2}px)`;
}

/** Segmented-control button style (repo/blank, stealth/attach). */
export function seg(on: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "11px 14px",
    borderRadius: 7,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: on ? 600 : 500,
    textAlign: "left",
    background: on ? "var(--surface)" : "transparent",
    color: on ? "var(--text)" : "var(--text-muted)",
    boxShadow: on ? "var(--shadow-sm)" : undefined,
  };
}

/** Read a CSS variable name (e.g. "--success") into a var() reference. */
export const cv = (name: string) => `var(${name})`;
