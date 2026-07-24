import { useStudio } from "../store";
import { seg } from "../ui";

export function TargetScreen() {
  const { connectMode, setConnectMode, nav } = useStudio();
  const isRepo = connectMode === "repo";

  const input: React.CSSProperties = {
    width: "100%",
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "9px 12px",
    color: "var(--text)",
    fontSize: 13,
  };
  const mono: React.CSSProperties = { ...input, fontFamily: "var(--mono)", fontSize: 12.5 };

  return (
    <div style={{ padding: 28, maxWidth: 760 }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em", marginBottom: 4 }}>New project</div>
      <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 22 }}>Connect a site. reeltreat will detect routes and extract brand automatically.</div>

      <div style={{ display: "flex", gap: 6, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 5, marginBottom: 22 }}>
        <button onClick={() => setConnectMode("repo")} style={seg(isRepo)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: "inherit" }}>📁 From a local repo</div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 400, marginTop: 2 }}>Auto-detect framework & routes</div>
        </button>
        <button onClick={() => setConnectMode("blank")} style={seg(!isRepo)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: "inherit" }}>🌐 Blank / deployed URL</div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 400, marginTop: 2 }}>Point at any live site</div>
        </button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
        {isRepo ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 7 }}>Repository path</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontFamily: "var(--mono)", fontSize: 12.5 }}>~/code/myapp</div>
              <button style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12.5, cursor: "pointer" }}>Choose…</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 15px", border: "1px solid var(--success)", borderRadius: 10, background: "rgba(52,211,153,.08)", marginBottom: 18 }}>
              <span style={{ color: "var(--success)", fontSize: 16 }}>✓</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Next.js App Router · 7 routes · brand extracted</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>primary #6D5EF6 · accent #22D3AA · Inter · base http://localhost:3000</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 7 }}>Deployed URL</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input defaultValue="https://myapp.example.com" style={{ ...mono, flex: 1 }} />
              <button style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>Detect</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 15px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface-2)", marginBottom: 18 }}>
              <span style={{ width: 16, height: 16, border: "2px solid var(--border)", borderTopColor: "var(--info)", borderRadius: 999, animation: "spin .8s linear infinite", display: "inline-block" }} />
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Detecting… fetching <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>/</span> and reading meta, colors, favicon</div>
            </div>
          </>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>Project name</div>
            <input defaultValue="myapp" style={input} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>Base URL</div>
            <input defaultValue="http://localhost:3000" style={mono} />
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>Viewport preset</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["1440×900", true], ["1920×1080", false], ["1280×800", false]].map(([label, on]) => (
              <span key={label as string} style={{ padding: "8px 13px", borderRadius: 8, border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "rgba(255,176,32,.08)" : "var(--surface-2)", color: on ? "var(--accent)" : "var(--text-muted)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: on ? 600 : 400 }}>{label}</span>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ color: "var(--text-faint)", fontSize: 12, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" }}>Setup checklist</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)" }}>2 to resolve</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13 }}><span style={{ color: "var(--success)" }}>✓</span><span style={{ color: "var(--text-muted)" }}>Framework detected</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13 }}><span style={{ width: 15, height: 15, borderRadius: 4, border: "1.5px solid var(--warning)" }} /><span>Set base URL for capture</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13 }}><span style={{ width: 15, height: 15, borderRadius: 4, border: "1.5px solid var(--warning)" }} /><span>Resolve 1 dynamic route <span style={{ fontFamily: "var(--mono)", color: "var(--text-faint)" }}>/project/[id]</span></span></div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
        <button onClick={() => nav("projects")} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
        <button onClick={() => nav("manifest")} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Create & open manifest →</button>
      </div>
    </div>
  );
}
