import { useStudio } from "../store";
import { mediaUrl } from "../api";
import type { Tier } from "../types";

export function FrameScreen() {
  const {
    projectName,
    detail,
    curation,
    tier,
    setTier,
    dirty,
    busy,
    selClip,
    selectClip,
    editCallout,
    nudgeCut,
    excludeShot,
    includeShot,
    saveCuration,
    nav,
  } = useStudio();

  if (!projectName || !detail || !curation) {
    return (
      <div style={{ padding: 40, color: "var(--text-muted)" }}>
        Curate the project first.{" "}
        <button onClick={() => nav("curate")} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontSize: "inherit" }}>Go to Curate</button>
      </div>
    );
  }

  const cut = curation.cuts[tier as Tier];
  const total = Math.round(cut.reduce((a, c) => a + c.seconds, 0) * 10) / 10;
  const calloutById = new Map(curation.shots.map((s) => [s.id, s.callout]));
  const fileById = new Map(detail.shots.map((s) => [s.id, s.file]));
  const thumb = (id: string) => (fileById.has(id) ? mediaUrl(projectName, "captures", fileById.get(id) as string) : "");

  const selected = cut.find((c) => c.id === selClip)?.id ?? cut[0]?.id ?? "";
  const inCut = new Set(cut.map((c) => c.id));
  const excluded = curation.shots.filter((s) => !inCut.has(s.id));

  const TIERS: Tier[] = ["5", "15", "30", "45"];

  return (
    <div style={{ padding: 16, minHeight: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Frame Editor</div>
        <div style={{ display: "flex", gap: 6 }}>
          {TIERS.map((t) => (
            <button key={t} onClick={() => setTier(t)} style={{ padding: "5px 11px", borderRadius: 7, border: `1px solid ${tier === t ? "var(--accent)" : "var(--border)"}`, background: tier === t ? "var(--accent)" : "var(--surface-2)", color: tier === t ? "var(--accent-contrast)" : "var(--text-muted)", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>{t}s</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={saveCuration} disabled={!dirty || !!busy} style={{ padding: "8px 15px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 13, cursor: dirty ? "pointer" : "not-allowed", opacity: dirty ? 1 : 0.5 }}>
          {busy === "Saving curation" ? "Saving…" : dirty ? "Save changes" : "✓ Saved"}
        </button>
        <button onClick={() => nav("preview")} style={{ padding: "8px 15px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}>Preview & Export →</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14, alignItems: "start" }}>
        {/* Preview of the selected frame */}
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ position: "relative", aspectRatio: "16 / 10", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {selected && thumb(selected) && <img src={thumb(selected)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            {selected && calloutById.get(selected) && (
              <div style={{ position: "absolute", left: 18, bottom: 18, background: "rgba(0,0,0,.6)", color: "#fff", fontWeight: 600, fontSize: 15, padding: "8px 14px", borderRadius: 8, backdropFilter: "blur(4px)" }}>
                {calloutById.get(selected)}
              </div>
            )}
            <span style={{ position: "absolute", top: 12, left: 12, fontFamily: "var(--mono)", fontSize: 11, color: "rgba(255,255,255,.75)", background: "rgba(0,0,0,.45)", padding: "3px 8px", borderRadius: 5 }}>{selected || "—"}</span>
          </div>
          <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-faint)", borderTop: "1px solid var(--border)" }}>
            Ken Burns pan/zoom, crossfades, and per-scene timing are derived automatically by the renderer from the cut order below.
          </div>
        </section>

        {/* Inspector for the selected clip */}
        <aside style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Inspector</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-faint)", marginBottom: 14 }}>#{selected || "—"}</div>

          {selected && (
            <>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6 }}>Callout (text bubble)</div>
              <input
                value={calloutById.get(selected) ?? ""}
                maxLength={40}
                onChange={(e) => editCallout(selected, e.target.value)}
                style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", color: "var(--text)", fontSize: 13 }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 5 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--text-faint)" }}>{(calloutById.get(selected) ?? "").length}/40</span>
              </div>

              <button onClick={() => excludeShot(selected)} style={{ width: "100%", marginTop: 14, padding: 9, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12.5, cursor: "pointer" }}>
                Remove from {tier}s cut
              </button>
            </>
          )}

          {excluded.length > 0 && (
            <>
              <div style={{ fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-faint)", margin: "16px 0 8px" }}>Not in cut</div>
              {excluded.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", border: "1px dashed var(--border)", borderRadius: 7, marginBottom: 6, fontSize: 12 }}>
                  <span style={{ fontFamily: "var(--mono)", flex: 1 }}>{s.id}</span>
                  <button onClick={() => includeShot(s.id)} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "1px solid var(--accent)", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>+ Add</button>
                </div>
              ))}
            </>
          )}
        </aside>
      </div>

      {/* Timeline — the ordered cut */}
      <section style={{ marginTop: 14, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Timeline — {tier}s cut</div>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-faint)" }}>{cut.length} clips</span>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-muted)" }}>total <span style={{ color: "var(--accent)", fontWeight: 600 }}>{total}s</span> / {tier}s</div>
        </div>
        <div style={{ overflowX: "auto", padding: 14, display: "flex", alignItems: "stretch", gap: 8 }}>
          {cut.map((c, idx) => {
            const sel = c.id === selected;
            return (
              <div key={c.id} onClick={() => selectClip(c.id)} style={{ flex: "0 0 150px", borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "var(--surface-2)", border: `2px solid ${sel ? "var(--accent)" : "transparent"}`, boxShadow: sel ? "0 0 0 3px rgba(255,176,32,.15)" : "none" }}>
                <div style={{ position: "relative", height: 76, background: "#0b0c0f" }}>
                  {thumb(c.id) && <img src={thumb(c.id)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  <span style={{ position: "absolute", top: 6, left: 7, fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,.85)", background: "rgba(0,0,0,.5)", padding: "2px 5px", borderRadius: 4 }}>{idx + 1}. {c.id}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{calloutById.get(c.id)}</span>
                  <span style={{ display: "flex", gap: 2 }}>
                    <MiniBtn label="‹" disabled={idx === 0} onClick={(e) => { e.stopPropagation(); nudgeCut(c.id, -1); }} />
                    <MiniBtn label="›" disabled={idx === cut.length - 1} onClick={(e) => { e.stopPropagation(); nudgeCut(c.id, 1); }} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function MiniBtn({ label, onClick, disabled }: { label: string; onClick: (e: React.MouseEvent) => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface)", color: disabled ? "var(--text-faint)" : "var(--text-muted)", fontSize: 12, cursor: disabled ? "not-allowed" : "pointer", lineHeight: 1 }}
    >
      {label}
    </button>
  );
}
