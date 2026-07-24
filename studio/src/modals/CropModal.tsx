import { useStudio } from "../store";
import { hatch, surfaceHatch } from "../ui";

export function CropModal() {
  const { setCropOpen } = useStudio();
  const close = () => setCropOpen(false);

  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 920, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", maxHeight: "88vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "15px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Crop — dashboard</div>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)" }}>non-destructive</span>
          <div style={{ flex: 1 }} />
          <button onClick={close} style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 250px", gap: 0, flex: 1, minHeight: 0 }}>
          <div style={{ position: "relative", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, minHeight: 340 }}>
            <div style={{ position: "relative", width: "100%", aspectRatio: "1440 / 900", maxHeight: "100%", background: hatch(12) }}>
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)" }} />
              <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: "80%", overflow: "hidden", boxShadow: "0 0 0 2px var(--accent)" }}>
                <div style={{ position: "absolute", inset: 0, background: hatch(12) }} />
                <div style={{ position: "absolute", left: "33.33%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,.25)" }} />
                <div style={{ position: "absolute", left: "66.66%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,.25)" }} />
                <div style={{ position: "absolute", top: "33.33%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,.25)" }} />
                <div style={{ position: "absolute", top: "66.66%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,.25)" }} />
                <div style={{ position: "absolute", top: 8, left: 10, fontFamily: "var(--mono)", fontSize: 10.5, color: "#fff", background: "rgba(0,0,0,.5)", padding: "2px 7px", borderRadius: 5 }}>the video frame starts here</div>
              </div>
              {[["-5px", "-5px", undefined, undefined], [undefined, "-5px", "-5px", undefined], ["-5px", "calc(80% - 6px)", undefined, undefined], [undefined, "calc(80% - 6px)", "-5px", undefined]].map((pos, i) => (
                <span key={i} style={{ position: "absolute", left: pos[0] as string, top: pos[1] as string, right: pos[2] as string, width: 12, height: 12, background: "var(--accent)", borderRadius: 3 }} />
              ))}
            </div>
          </div>
          <div style={{ borderLeft: "1px solid var(--border)", padding: 16, overflow: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8 }}>Aspect ratio</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[["Free", false], ["16:9", true], ["Original", false], ["1:1", false]].map(([label, on]) => (
                  <span key={label as string} style={{ padding: 7, borderRadius: 6, border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "rgba(255,176,32,.08)" : "var(--surface-2)", color: on ? "var(--accent)" : "var(--text-muted)", fontSize: 12, textAlign: "center", fontWeight: on ? 600 : undefined, cursor: "pointer" }}>{label}</span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8 }}>Region (normalized · px)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontFamily: "var(--mono)", fontSize: 11.5 }}>
                {["x 0.00 · 0", "y 0.00 · 0", "w 1.00 · 1440", "h 0.80 · 720"].map((t) => (
                  <div key={t} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 8px" }}>{t}</div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8 }}>Result preview</div>
              <div style={{ aspectRatio: "16 / 9", borderRadius: 6, background: surfaceHatch(10), border: "1px solid var(--border)" }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", display: "flex", gap: 7 }}><span style={{ color: "var(--info)" }}>ⓘ</span>The original screenshot is untouched — crop only sets the frame region.</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderTop: "1px solid var(--border)" }}>
          <button style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>Reset crop</button>
          <div style={{ flex: 1 }} />
          <button onClick={close} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={close} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Apply</button>
        </div>
      </div>
    </div>
  );
}
