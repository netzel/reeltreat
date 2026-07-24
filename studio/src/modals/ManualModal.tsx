import { useStudio } from "../store";
import { hatch } from "../ui";

export function ManualModal() {
  const { setManualOpen } = useStudio();
  const close = () => setManualOpen(false);

  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: "92vw", height: "100%", background: "var(--surface)", borderLeft: "1px solid var(--border)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Manual photos</div>
          <div style={{ flex: 1 }} />
          <button onClick={close} style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ border: "1px dashed var(--border)", borderRadius: 10, padding: 26, textAlign: "center", background: "var(--surface-2)" }}>
            <div style={{ fontSize: 26, marginBottom: 8, color: "var(--text-faint)" }}>⬆</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Drop images or <span style={{ color: "var(--accent)" }}>browse</span></div>
            <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 4 }}>PNG, JPG, HEIC · converted to PNG</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface-2)" }}>
            <span style={{ width: 16, height: 16, border: "2px solid var(--border)", borderTopColor: "var(--info)", borderRadius: 999, animation: "spin .8s linear infinite" }} />
            <div style={{ flex: 1 }}><div style={{ fontSize: 12.5 }}>hero-shot.heic</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>converting to PNG…</div></div>
          </div>

          <div style={{ fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-faint)" }}>Added manual images</div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ position: "relative", height: 130, background: hatch(11) }}>
              <span style={{ position: "absolute", top: 8, left: 9, fontFamily: "var(--mono)", fontSize: 10.5, color: "rgba(255,255,255,.7)", background: "rgba(0,0,0,.4)", padding: "2px 7px", borderRadius: 5 }}>live-transcription</span>
              <span style={{ position: "absolute", top: 8, right: 9, fontSize: 10, background: "var(--ai)", color: "#1a1033", fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>✦ manual</span>
            </div>
            <div style={{ padding: "12px 13px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div><div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>Caption</div><input defaultValue="Real-time transcription as you speak" maxLength={40} style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "7px 9px", color: "var(--text)", fontSize: 12.5 }} /></div>
              <div><div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>Insert after</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", fontSize: 12.5, cursor: "pointer" }}>Analytics<span style={{ color: "var(--text-faint)" }}>▾</span></div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: "var(--text-faint)", display: "flex", gap: 7 }}><span style={{ color: "var(--info)" }}>ⓘ</span>Stored locally under <span style={{ fontFamily: "var(--mono)" }}>manual/myapp/</span> (gitignored). Behaves like a captured shot.</div>
        </div>
        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
          <button onClick={close} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={close} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Add to timeline</button>
        </div>
      </div>
    </div>
  );
}
