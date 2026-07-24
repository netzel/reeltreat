import { useStudio } from "../store";
import { SCREEN_TITLES } from "../workflow";

export function TopBar() {
  const { screen, nav } = useStudio();
  const [title, crumb] = SCREEN_TITLES[screen];

  return (
    <header
      style={{
        height: 54,
        flex: "0 0 54px",
        borderBottom: "1px solid var(--shell-border)",
        background: "var(--shell)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 20px",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-.01em" }}>{title}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-faint)" }}>{crumb}</div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 999,
          padding: "5px 12px",
          fontSize: 12.5,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--warning)", animation: "pulse 1.6s infinite" }} />
        7 captured · 1 warning · unsaved edits
      </div>
      <button
        onClick={() => nav("preview")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "8px 15px",
          borderRadius: 6,
          border: "none",
          background: "var(--accent)",
          color: "var(--accent-contrast)",
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        ▸ Export
      </button>
    </header>
  );
}
