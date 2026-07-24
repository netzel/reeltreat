import { useStudio } from "../store";
import { CLIPS } from "../data/mock";

export function FrameScreen() {
  const { selClip, selectClip, playing, togglePlay, setCropOpen, setManualOpen } = useStudio();
  const total = CLIPS.reduce((a, c) => a + c.dur, 0);

  const panGrid = Array.from({ length: 9 }, (_, i) => ({
    background: i === 4 ? "var(--accent)" : i === 3 ? "var(--surface)" : "var(--surface-2)",
    border: `1px solid ${i === 3 || i === 4 ? "var(--accent)" : "var(--border)"}`,
  }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gridTemplateRows: "minmax(300px,1fr) minmax(158px,auto)", gap: 14, padding: 16, minHeight: "100%" }}>
      {/* Preview player */}
      <section style={{ gridColumn: 1, gridRow: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ position: "relative", flex: 1, minHeight: 280, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(135deg,#191b22 0 12px,#14161b 12px 24px)", animation: "kb 3.5s ease-in-out infinite alternate" }} />
          <div style={{ position: "absolute", top: 14, left: 14, fontFamily: "var(--mono)", fontSize: 11, color: "rgba(255,255,255,.6)", background: "rgba(0,0,0,.45)", padding: "4px 8px", borderRadius: 5 }}>screenshot: analytics</div>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "26px 20px 18px", background: "linear-gradient(transparent,rgba(0,0,0,.7))" }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em", color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,.6)" }}>Your product's trailer — rendered in one click.</div>
          </div>
          <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 6 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, padding: "4px 9px", borderRadius: 999 }}>15s · 30fps</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: "1px solid var(--border)" }}>
          <button onClick={togglePlay} style={{ width: 38, height: 38, borderRadius: 999, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontSize: 15, cursor: "pointer", boxShadow: "var(--shadow-sm)" }}>{playing ? "❚❚" : "▶"}</button>
          <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap" }}>0:04 / 0:15</div>
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--surface-2)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "27%", background: "var(--accent)", borderRadius: 999 }} />
            <div style={{ position: "absolute", left: "27%", top: -4, width: 3, height: 14, background: "var(--accent)", borderRadius: 2 }} />
          </div>
          <button onClick={() => setCropOpen(true)} style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12, cursor: "pointer" }}>⛶ Crop</button>
        </div>
      </section>

      {/* Inspector */}
      <aside style={{ gridColumn: 2, gridRow: "1 / span 2", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 9, height: 9, borderRadius: 2, background: "var(--warning)" }} />
          <div style={{ fontWeight: 600, fontSize: 14 }}>Inspector</div>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)" }}>#{selClip}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: "var(--ai)", border: "1px solid var(--ai)", borderRadius: 999, padding: "2px 7px" }}>✦ edited</span>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, fontSize: 12.5, color: "var(--text-muted)" }}><span>Duration</span><span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>3.5s</span></div>
            <input type="range" min={1} max={8} defaultValue={3.5} step={0.5} style={{ width: "100%", accentColor: "var(--accent)" }} />
          </div>

          <div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 8 }}>Zoom (Ken Burns)</div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 4 }}>Start</div><div style={{ fontFamily: "var(--mono)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "7px 9px", textAlign: "center" }}>1.00×</div></div>
              <div style={{ alignSelf: "flex-end", color: "var(--text-faint)", paddingBottom: 8 }}>→</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 4 }}>End</div><div style={{ fontFamily: "var(--mono)", background: "var(--surface-2)", border: "1px solid var(--accent)", borderRadius: 6, padding: "7px 9px", textAlign: "center", color: "var(--accent)" }}>1.08×</div></div>
            </div>
            <div style={{ marginTop: 9, height: 44, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 8, border: "1px dashed var(--text-faint)", borderRadius: 3 }} />
              <div style={{ position: "absolute", left: 14, top: 14, bottom: 14, width: "38%", border: "1.5px solid var(--accent)", borderRadius: 2, background: "rgba(255,176,32,.08)" }} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 8 }}>Pan direction & speed</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4, width: 84 }}>
                {panGrid.map((p, i) => (
                  <div key={i} style={{ aspectRatio: "1", borderRadius: 3, ...p }} />
                ))}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 4 }}>center → left</div>
                <input type="range" min={1} max={5} defaultValue={2} style={{ width: "100%", accentColor: "var(--accent)" }} />
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 3 }}>Speed: slow</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Crossfade in</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 9px" }}>0.4s</span>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}><span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Callout</span>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-faint)", cursor: "pointer" }}><input type="checkbox" defaultChecked style={{ accentColor: "var(--accent)" }} />show</label>
            </div>
            <input type="text" defaultValue="Instant insight" maxLength={40} style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", color: "var(--text)", fontSize: 13 }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}><span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>position: lower-left</span><span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--text-faint)" }}>15/40</span></div>
          </div>

          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)", cursor: "pointer" }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Include in cut</span>
            <input type="checkbox" defaultChecked style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
          </label>
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
          <button style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 9, borderRadius: 6, border: "1px solid var(--ai)", background: "rgba(167,139,250,.1)", color: "var(--ai)", fontWeight: 500, fontSize: 12.5, cursor: "pointer" }}>✦ Reset this frame to AI defaults</button>
        </div>
      </aside>

      {/* Timeline */}
      <section style={{ gridColumn: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", flexDirection: "column", minHeight: 158, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Timeline</div>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-faint)" }}>6 clips</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setManualOpen(true)} style={{ padding: "6px 11px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12, cursor: "pointer" }}>+ Manual photo</button>
          <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-muted)" }}>total <span style={{ color: "var(--accent)", fontWeight: 600 }}>{total}s</span> / 15s</div>
        </div>
        <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden", padding: 14, display: "flex", alignItems: "stretch", gap: 2 }}>
          {CLIPS.map((c, idx) => {
            const sel = c.id === selClip;
            return (
              <span key={c.id} style={{ display: "flex", alignItems: "stretch" }}>
                <div
                  onClick={() => selectClip(c.id)}
                  style={{ flex: `0 0 ${Math.round(c.dur * 44)}px`, minWidth: 96, borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "var(--surface-2)", border: `2px solid ${sel ? "var(--accent)" : "transparent"}`, boxShadow: sel ? "0 0 0 3px rgba(255,176,32,.15)" : "none", transition: "border-color .15s" }}
                >
                  <div style={{ position: "relative", height: 64, background: "repeating-linear-gradient(135deg,#20232b 0 10px,#191b22 10px 20px)", outline: c.ai ? "1px solid var(--ai)" : undefined, outlineOffset: c.ai ? -1 : undefined }}>
                    <span style={{ position: "absolute", top: 6, left: 7, fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,.75)", background: "rgba(0,0,0,.4)", padding: "2px 5px", borderRadius: 4 }}>{c.id}</span>
                    {c.ai && <span style={{ position: "absolute", top: 6, right: 7, fontSize: 10, background: "var(--ai)", color: "#1a1033", width: 16, height: 16, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>✦</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--text-faint)" }}>{c.dur}s</span>
                  </div>
                </div>
                {idx < CLIPS.length - 1 && (
                  <span style={{ flex: "0 0 14px", alignSelf: "center", height: 30, background: "linear-gradient(90deg,transparent,var(--accent),transparent)", opacity: 0.4, borderRadius: 999 }} />
                )}
              </span>
            );
          })}
          <div style={{ flex: "0 0 150px", border: "1px dashed var(--border)", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--text-faint)", marginLeft: 8 }}>
            <div style={{ fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase" }}>Not in cut</div>
            <div style={{ width: 104, height: 58, borderRadius: 5, background: "repeating-linear-gradient(135deg,var(--surface-2) 0 8px,transparent 8px 16px)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>billing</div>
            <button style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>+ Add back</button>
          </div>
        </div>
      </section>
    </div>
  );
}
