import { useStudio } from "../store";
import type { Screen, Theme } from "../types";

const NAV: Array<[Screen, string, string]> = [
  ["projects", "▦", "Projects"],
  ["target", "＋", "New Project"],
  ["manifest", "▤", "Manifest & Shots"],
  ["auth", "⚿", "Authenticate"],
];

export function Sidebar() {
  const { screen, theme, nav, setTheme } = useStudio();

  const themeBtn = (which: Theme): React.CSSProperties => {
    const on = theme === which;
    return {
      flex: 1,
      padding: "6px 10px",
      borderRadius: 999,
      border: "none",
      cursor: "pointer",
      fontSize: 12,
      fontWeight: on ? 600 : 500,
      background: on ? "var(--accent)" : "transparent",
      color: on ? "var(--accent-contrast)" : "var(--text-muted)",
    };
  };

  return (
    <aside
      style={{
        width: 212,
        flex: "0 0 212px",
        background: "var(--shell)",
        borderRight: "1px solid var(--shell-border)",
        display: "flex",
        flexDirection: "column",
        padding: "16px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 8px 16px" }}>
        <img
          src="/logo.png"
          alt="reeltreat"
          style={{ width: 28, height: 28, borderRadius: 7, flex: "0 0 28px", boxShadow: "var(--shadow-sm)" }}
        />
        <div style={{ fontWeight: 700, letterSpacing: "-.02em", fontSize: 15 }}>
          reeltreat<span style={{ color: "var(--text-faint)", fontWeight: 500 }}> Studio</span>
        </div>
      </div>

      <button
        onClick={() => nav("projects")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          textAlign: "left",
          padding: "8px 10px",
          marginBottom: 12,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--text)",
          cursor: "pointer",
        }}
      >
        <div style={{ width: 22, height: 22, borderRadius: 5, background: "linear-gradient(135deg,#6D5EF6,#22D3AA)", flex: "0 0 22px" }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
            myapp<span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)" }} />
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            unsaved edits
          </div>
        </div>
        <span style={{ color: "var(--text-faint)" }}>⇅</span>
      </button>

      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-faint)", padding: "4px 10px 6px" }}>
        Workspace
      </div>
      {NAV.map(([key, icon, label]) => {
        const active = screen === key;
        return (
          <button
            key={key}
            onClick={() => nav(key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "8px 10px",
              marginBottom: 2,
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              background: active ? "rgba(44,174,236,.10)" : "transparent",
              color: active ? "var(--text)" : "var(--text-muted)",
              boxShadow: active ? "inset 2px 0 0 var(--brand-blue)" : undefined,
            }}
          >
            <span style={{ width: 18, textAlign: "center", opacity: 0.9 }}>{icon}</span>
            <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
          </button>
        );
      })}

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 999, padding: 3 }}>
          <button onClick={() => setTheme("dark")} style={themeBtn("dark")}>☾ Dark</button>
          <button onClick={() => setTheme("light")} style={themeBtn("light")}>☀ Light</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", color: "var(--text-muted)", fontSize: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--success)" }} />
          Local · v0.9.2
        </div>
      </div>
    </aside>
  );
}
