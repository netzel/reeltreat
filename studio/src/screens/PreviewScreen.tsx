import { useStudio } from "../store";
import { OVERRIDES } from "../data/mock";
import type { Tier } from "../types";

const TIERS: Tier[] = ["5", "15", "30", "45"];

export function PreviewScreen() {
  const { tier, setTier, playing, togglePlay, exportState, startExport, resetExport } = useStudio();

  const tierBtn = (t: Tier): React.CSSProperties => ({
    padding: "6px 11px",
    borderRadius: 7,
    border: `1px solid ${tier === t ? "var(--accent)" : "var(--border)"}`,
    background: tier === t ? "var(--accent)" : "var(--surface-2)",
    color: tier === t ? "var(--accent-contrast)" : "var(--text-muted)",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
  });

  return (
    <div style={{ padding: "22px 24px", maxWidth: 1120, display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, alignItems: "start" }}>
      <div>
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ position: "relative", aspectRatio: "16 / 9", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(135deg,#191b22 0 12px,#14161b 12px 24px)", animation: "kb 4s ease-in-out infinite alternate" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "32px 26px 22px", background: "linear-gradient(transparent,rgba(0,0,0,.7))" }}>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.02em", color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,.6)" }}>Your product's trailer — rendered in one click.</div>
            </div>
            <span style={{ position: "absolute", top: 14, right: 14, fontFamily: "var(--mono)", fontSize: 11, background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, padding: "4px 10px", borderRadius: 999 }}>{tier}s · 30fps</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
            <button onClick={togglePlay} style={{ width: 40, height: 40, borderRadius: 999, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontSize: 15, cursor: "pointer" }}>{playing ? "❚❚" : "▶"}</button>
            <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--text-muted)" }}>0:00 / 0:{tier}</div>
            <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--surface-2)", position: "relative" }}><div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "8%", background: "var(--accent)", borderRadius: 999 }} /></div>
            <div style={{ display: "flex", gap: 6 }}>
              {TIERS.map((t) => (
                <button key={t} onClick={() => setTier(t)} style={tierBtn(t)}>{t}</button>
              ))}
            </div>
          </div>
        </section>

        <div style={{ marginTop: 16, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Your overrides</div>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-faint)" }}>4 edits over AI</span>
            <div style={{ flex: 1 }} />
            <button style={{ padding: "7px 13px", borderRadius: 7, border: "1px solid var(--ai)", background: "rgba(167,139,250,.1)", color: "var(--ai)", fontSize: 12, cursor: "pointer" }}>✦ Reset all to AI defaults</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {OVERRIDES.map((ov, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--accent)" }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{ov.label}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ov.detail}</span>
                <button style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", fontSize: 11.5, cursor: "pointer" }}>Reset</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, position: "sticky", top: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Export</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, fontSize: 12.5 }}>
          <Row label="Format" value="MP4 · H.264" />
          <Row label="Resolution" value="1440×900" />
          <Row label="Frame rate" value="30 fps" />
          <Row label="Length" value={`${tier}s`} />
        </div>

        {exportState === "idle" && (
          <>
            <button onClick={startExport} style={{ width: "100%", padding: 13, borderRadius: 9, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "var(--shadow-sm)" }}>▸ Export video + poster</button>
            <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--text-faint)", marginTop: 10 }}>→ demo-{tier}s.mp4 + poster.png</div>
          </>
        )}

        {exportState === "rendering" && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}><span>Rendering frame 312/450</span><span style={{ fontFamily: "var(--mono)", color: "var(--text-muted)" }}>~0:20 left</span></div>
              <div style={{ height: 8, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}><div style={{ width: "69%", height: "100%", background: "var(--accent)" }} /></div>
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.8, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", color: "var(--text-muted)", marginBottom: 12 }}>
              <div>encoding cut · 30fps · h264</div><div>frame 312 / 450</div><div style={{ color: "var(--accent)" }}>▍</div>
            </div>
            <button onClick={resetExport} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--danger)", background: "transparent", color: "var(--danger)", fontSize: 13, cursor: "pointer" }}>Cancel render</button>
          </>
        )}

        {exportState === "done" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--success)", fontWeight: 600, fontSize: 13.5, marginBottom: 12 }}><span style={{ width: 22, height: 22, borderRadius: 999, background: "rgba(52,211,153,.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>Export complete</div>
            <div style={{ position: "relative", borderRadius: 9, overflow: "hidden", marginBottom: 12, aspectRatio: "16 / 9", background: "repeating-linear-gradient(135deg,#20232b 0 12px,#191b22 12px 24px)" }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "18px 14px 12px", background: "linear-gradient(transparent,rgba(0,0,0,.7))" }}><div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Your product's trailer…</div></div>
              <span style={{ position: "absolute", top: 8, left: 8, fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,.7)", background: "rgba(0,0,0,.4)", padding: "2px 7px", borderRadius: 5 }}>poster.png</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 11, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 7, background: "var(--accent)", color: "var(--accent-contrast)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>▸</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: "var(--mono)", fontSize: 12.5, fontWeight: 600 }}>demo-{tier}s.mp4</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>1440×900 · 8.4 MB</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <button style={{ padding: 10, borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>↓ Download</button>
              <button style={{ padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12.5, cursor: "pointer" }}>Open folder</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={resetExport} style={{ padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12.5, cursor: "pointer" }}>↻ Re-render</button>
              <button onClick={resetExport} style={{ padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12.5, cursor: "pointer" }}>Export another length</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--mono)" }}>{value}</span>
    </div>
  );
}
