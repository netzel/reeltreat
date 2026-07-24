import { useStudio } from "../store";
import { SHOTS, SHOT_STATUS } from "../data/mock";
import { cv, surfaceHatch } from "../ui";

export function ManifestScreen() {
  const { nav } = useStudio();

  const field: React.CSSProperties = {
    width: "100%",
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "8px 10px",
    color: "var(--text)",
    fontFamily: "var(--mono)",
    fontSize: 12,
  };
  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 };
  const pill = (on: boolean): React.CSSProperties => ({
    padding: "4px 11px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: on ? 600 : undefined,
    background: on ? "var(--accent)" : undefined,
    color: on ? "var(--accent-contrast)" : "var(--text-muted)",
  });

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1120 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "12px 16px", border: "1px solid var(--warning)", borderRadius: 10, background: "rgba(251,191,36,.08)", marginBottom: 20 }}>
        <span style={{ color: "var(--warning)", fontSize: 15 }}>⚠</span>
        <div style={{ flex: 1, fontSize: 13 }}><b>1 dynamic route unresolved.</b> <span style={{ color: "var(--text-muted)" }}>Shot <span style={{ fontFamily: "var(--mono)" }}>/project/[id]</span> needs a concrete value before capture.</span></div>
        <button style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--warning)", background: "transparent", color: "var(--warning)", fontSize: 12, cursor: "pointer" }}>Resolve</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={card}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Project settings</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 5 }}>Base URL</div><input defaultValue="https://myapp.example.com" style={field} /></div>
              <div><div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 5 }}>Login URL</div><input defaultValue="/login" style={field} /></div>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 5 }}>Viewport</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input defaultValue="1440" style={field} />
                  <span style={{ alignSelf: "center", color: "var(--text-faint)" }}>×</span>
                  <input defaultValue="900" style={field} />
                </div>
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Brand</div>
            <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 6 }}>Primary</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 8px" }}><span style={{ width: 22, height: 22, borderRadius: 5, background: "#6D5EF6", border: "1px solid rgba(255,255,255,.15)" }} /><span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>#6D5EF6</span></div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 6 }}>Accent</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 8px" }}><span style={{ width: 22, height: 22, borderRadius: 5, background: "#22D3AA", border: "1px solid rgba(255,255,255,.15)" }} /><span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>#22D3AA</span></div>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 6 }}>Font</div><div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", fontSize: 13 }}>Inter</div></div>
            <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 6 }}>Logo</div><div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: 16, textAlign: "center", color: "var(--text-faint)", fontSize: 12 }}>Drop SVG/PNG · <span style={{ color: "var(--accent)" }}>browse</span></div></div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 6 }}>Title card preview</div>
            <div style={{ height: 96, borderRadius: 8, background: "linear-gradient(135deg,#6D5EF6,#22D3AA)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", position: "relative" }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,.9)", marginBottom: 8 }} />
              <div style={{ fontWeight: 700, fontSize: 15 }}>myapp</div>
            </div>
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Shots</div>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-faint)" }}>8 · drag to reorder</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Capture defaults: <span style={{ fontFamily: "var(--mono)" }}>delayMs 2000</span></span>
            <button style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12, cursor: "pointer" }}>+ Add shot</button>
          </div>
          {SHOTS.map((sh) => {
            const [color, label] = SHOT_STATUS[sh.status];
            const isManual = sh.kind === "manual";
            return (
              <div key={sh.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-faint)", cursor: "grab", fontSize: 15 }}>⋮⋮</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-faint)", width: 14 }}>{sh.n}</span>
                <div style={{ width: 64, height: 38, borderRadius: 5, background: surfaceHatch(7), border: "1px solid var(--border)", flex: "0 0 64px" }} />
                <div style={{ minWidth: 150, flex: "0 0 auto" }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 12.5, fontWeight: 600 }}>{sh.id}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{sh.caption}</div>
                </div>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10.5, fontWeight: 600, color: cv(color), border: `1px solid ${cv(color)}`, borderRadius: 999, padding: "2px 8px" }}>{label}</span>
                <div style={{ display: "flex", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 999, padding: 2 }}>
                  <span style={pill(sh.kind === "browser")}>Browser</span>
                  <span style={pill(sh.kind === "manual")}>Manual</span>
                </div>
                <button
                  title="Capture settings"
                  disabled={isManual}
                  style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 13, cursor: isManual ? "not-allowed" : "pointer", color: isManual ? "var(--text-faint)" : "var(--text-muted)", opacity: isManual ? 0.5 : 1 }}
                >
                  ⚙
                </button>
              </div>
            );
          })}
          <div style={{ padding: "12px 16px", fontSize: 11.5, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: "var(--text-faint)" }}>ⓘ</span>Capture-settings (waitUntil · timeoutMs · waitFor · delayMs · fullPage) are disabled on manual rows.</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <button onClick={() => nav("auth")} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}>Authenticate →</button>
        <button onClick={() => nav("capture")} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Capture 8 shots →</button>
      </div>
    </div>
  );
}
