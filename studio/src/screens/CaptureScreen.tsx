import { useStudio } from "../store";
import { SHOTS, SHOT_STATUS, CAPTURE_LOG } from "../data/mock";
import { cv, hatch } from "../ui";

export function CaptureScreen() {
  const { captureState, setCaptureState, nav } = useStudio();

  if (captureState === "empty") {
    return (
      <div style={{ padding: "20px 24px", maxWidth: 1160 }}>
        <div style={{ border: "1px dashed var(--border)", borderRadius: 12, padding: 56, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", background: "var(--surface)" }}>
          <div style={{ width: 60, height: 60, borderRadius: 15, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 16 }}>◉</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Ready to capture 8 shots</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13, margin: "8px 0 20px", maxWidth: 380 }}>Session is saved and the manifest is valid. Capture opens Chrome and screenshots each route in order.</div>
          <button onClick={() => setCaptureState("done")} style={{ padding: "11px 22px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>▸ Start capture</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1160 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px", marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Capturing 8 shots</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>elapsed <span style={{ fontFamily: "var(--mono)" }}>0:38</span> · 8 / 8 done</div>
        </div>
        <div style={{ flex: 1, maxWidth: 420 }}>
          <div style={{ height: 8, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}><div style={{ width: "100%", height: "100%", background: "var(--success)" }} /></div>
        </div>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--success)" }}>100%</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ padding: "8px 13px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer" }}>Pause</button>
          <button style={{ padding: "8px 13px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--danger)", fontSize: 12.5, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14 }}>
          {SHOTS.map((sh) => {
            const [color, label] = SHOT_STATUS[sh.status];
            return (
              <div key={sh.id} style={{ borderRadius: 9, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ position: "relative", height: 104, background: hatch(10) }}>
                  <span style={{ position: "absolute", top: 7, left: 8, fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,.7)", background: "rgba(0,0,0,.4)", padding: "2px 6px", borderRadius: 4 }}>{sh.id}</span>
                  <span style={{ position: "absolute", top: 7, right: 8, fontSize: 9.5, fontWeight: 700, color: cv(color), background: "rgba(0,0,0,.5)", border: `1px solid ${cv(color)}`, borderRadius: 999, padding: "1px 7px" }}>{label}</span>
                  <div style={{ position: "absolute", bottom: 6, right: 6, display: "flex", gap: 5, opacity: 0.35 }}>
                    <span style={{ width: 24, height: 24, borderRadius: 5, background: "rgba(0,0,0,.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, cursor: "pointer" }}>👁</span>
                    <span style={{ width: 24, height: 24, borderRadius: 5, background: "rgba(0,0,0,.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, cursor: "pointer" }}>↻</span>
                  </div>
                </div>
                <div style={{ padding: "8px 10px" }}>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sh.caption}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", position: "sticky", top: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderBottom: "1px solid var(--border)" }}><span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--success)" }} /><span style={{ fontWeight: 600, fontSize: 13 }}>Capture log</span></div>
          <div style={{ padding: "12px 14px", fontFamily: "var(--mono)", fontSize: 11.5, lineHeight: 1.9, maxHeight: 340, overflow: "auto" }}>
            {CAPTURE_LOG.map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 10 }}><span style={{ color: "var(--text-faint)", flex: "0 0 44px" }}>{l.t}</span><span style={{ color: cv(l.color) }}>{l.msg}</span></div>
            ))}
            <div style={{ display: "flex", gap: 10 }}><span style={{ color: "var(--text-faint)", flex: "0 0 44px" }} /><span style={{ color: "var(--accent)" }}>▍</span></div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}><b style={{ color: "var(--success)" }}>7 captured</b> · <b style={{ color: "var(--warning)" }}>1 warning</b> · <b style={{ color: "var(--text-faint)" }}>0 failed</b></span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setCaptureState("empty")} style={{ padding: "9px 15px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}>↻ Re-run capture</button>
        <button onClick={() => nav("curate")} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Continue to Curate →</button>
      </div>
    </div>
  );
}
