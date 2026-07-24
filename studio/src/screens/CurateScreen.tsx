import { useStudio } from "../store";
import { mediaUrl } from "../api";
import { cutIds, type TierKey } from "../curation";
import type { Tier } from "../types";

const TIERS: Tier[] = ["5", "15", "30", "45"];

export function CurateScreen() {
  const {
    projectName,
    detail,
    curation,
    dirty,
    tier,
    setTier,
    busy,
    error,
    runCurate,
    saveCuration,
    editTagline,
    editCallout,
    pickHero,
    nudgeCut,
    excludeShot,
    includeShot,
    nav,
  } = useStudio();

  if (!projectName || !detail) {
    return <Empty />;
  }

  // id -> capture filename, for thumbnails.
  const fileById = new Map(detail.shots.map((s) => [s.id, s.file]));
  const captionById = new Map(detail.shots.map((s) => [s.id, s.caption]));
  const thumb = (id: string) =>
    fileById.has(id) ? mediaUrl(projectName, "captures", fileById.get(id) as string) : "";

  const tierBtn = (t: Tier): React.CSSProperties => ({
    padding: "8px 14px",
    borderRadius: 8,
    border: `1px solid ${tier === t ? "var(--accent)" : "var(--border)"}`,
    background: tier === t ? "var(--accent)" : "var(--surface-2)",
    color: tier === t ? "var(--accent-contrast)" : "var(--text-muted)",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  });

  if (!curation) {
    return (
      <div style={{ padding: "22px 24px", maxWidth: 720 }}>
        {error && <ErrorBanner text={error} />}
        <div style={{ border: "1px dashed var(--border)", borderRadius: 12, padding: 48, textAlign: "center", background: "var(--surface)" }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Curate this project</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20, maxWidth: 440, marginInline: "auto" }}>
            One Claude call ranks the captured shots, picks a hero frame, writes callout labels + a tagline, and
            builds the ordered cuts. Then you edit any of it here.
          </div>
          <button onClick={() => runCurate(false)} disabled={!!busy} style={primary}>
            {busy ?? "✦ Run curation (1 AI call)"}
          </button>
        </div>
      </div>
    );
  }

  const tk = tier as TierKey;
  const ranked = [...curation.shots].sort((a, b) => a.rank - b.rank);
  const inCut = new Set(cutIds(curation, tk));
  const excluded = ranked.filter((r) => !inCut.has(r.id));

  return (
    <div style={{ padding: "22px 24px", maxWidth: 1080 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ai)", border: "1px solid var(--ai)", borderRadius: 999, padding: "3px 10px" }}>✦ AI-curated</span>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Edit the tagline, callouts, and shot order — your changes save to curation.json.</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => runCurate(true)} disabled={!!busy} style={{ padding: "8px 13px", borderRadius: 8, border: "1px solid var(--ai)", background: "rgba(167,139,250,.1)", color: "var(--ai)", fontSize: 12.5, cursor: "pointer" }}>↻ Re-run (1 AI call)</button>
        <button onClick={saveCuration} disabled={!dirty || !!busy} style={{ ...primary, opacity: dirty ? 1 : 0.5, cursor: dirty ? "pointer" : "not-allowed" }}>
          {busy === "Saving curation" ? "Saving…" : dirty ? "Save changes" : "✓ Saved"}
        </button>
      </div>

      {error && <ErrorBanner text={error} />}

      {/* Hero + tagline */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--ai)", borderRadius: 12, overflow: "hidden", marginBottom: 20, boxShadow: "0 0 0 3px rgba(167,139,250,.08)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr" }}>
          <div style={{ position: "relative", minHeight: 220, background: "#0b0c0f" }}>
            {thumb(curation.heroShotId) && (
              <img src={thumb(curation.heroShotId)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            )}
            <span style={{ position: "absolute", top: 12, left: 12, fontFamily: "var(--mono)", fontSize: 10.5, color: "rgba(255,255,255,.85)", background: "rgba(0,0,0,.5)", padding: "3px 8px", borderRadius: 5 }}>hero: {curation.heroShotId}</span>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "28px 22px 20px", background: "linear-gradient(transparent,rgba(0,0,0,.72))" }}>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.02em", color: "#fff", lineHeight: 1.15, textShadow: "0 2px 12px rgba(0,0,0,.6)" }}>{curation.tagline}</div>
            </div>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}><span style={{ color: "var(--ai)" }}>✦</span><span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ai)" }}>Tagline</span></div>
            <textarea
              value={curation.tagline}
              maxLength={90}
              onChange={(e) => editTagline(e.target.value)}
              style={{ width: "100%", minHeight: 70, resize: "none", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", color: "var(--text)", fontSize: 14, fontFamily: "inherit", lineHeight: 1.4 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)" }}>{curation.tagline.length}/90</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
        {/* Ranked shots with editable callouts */}
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Ranked shots — edit each callout (the text bubble)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ranked.map((rk) => (
              <div key={rk.id} style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                <span style={{ width: 26, height: 26, flex: "0 0 26px", borderRadius: 999, background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600 }}>{rk.rank}</span>
                <div style={{ width: 76, height: 46, flex: "0 0 76px", borderRadius: 6, overflow: "hidden", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  {thumb(rk.id) && <img src={thumb(rk.id)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-faint)" }}>{rk.id}</span>
                    <button onClick={() => pickHero(rk.id)} title="Use as hero (poster)" style={{ fontSize: 10.5, border: `1px solid ${curation.heroShotId === rk.id ? "var(--accent)" : "var(--border)"}`, color: curation.heroShotId === rk.id ? "var(--accent)" : "var(--text-faint)", background: "none", borderRadius: 999, padding: "1px 8px", cursor: "pointer" }}>
                      {curation.heroShotId === rk.id ? "★ hero" : "set hero"}
                    </button>
                  </div>
                  <input
                    value={rk.callout}
                    maxLength={40}
                    onChange={(e) => editCallout(rk.id, e.target.value)}
                    style={{ width: "100%", maxWidth: 320, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 9px", color: "var(--text)", fontSize: 13, fontWeight: 500 }}
                  />
                </div>
                <div style={{ flex: 1, fontSize: 12, color: "var(--text-muted)", maxWidth: 200 }}>{captionById.get(rk.id) ?? rk.reason}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cut ordering per tier */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, position: "sticky", top: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Cut order</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>The order shots play in the video. Use ↑ ↓ to reorder.</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {TIERS.map((t) => (
              <button key={t} onClick={() => setTier(t)} style={tierBtn(t)}>{t}s</button>
            ))}
          </div>
          <div style={{ fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 8 }}>Ordered cut · {tier}s</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {curation.cuts[tk].map((cu, i, arr) => (
              <div key={cu.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px 7px 10px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12.5 }}>
                <span style={{ fontFamily: "var(--mono)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cu.id}</span>
                <span style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>{Math.round(cu.seconds * 10) / 10}s</span>
                <div style={{ display: "flex", gap: 2 }}>
                  <IconBtn label="↑" disabled={i === 0} onClick={() => nudgeCut(cu.id, -1)} />
                  <IconBtn label="↓" disabled={i === arr.length - 1} onClick={() => nudgeCut(cu.id, 1)} />
                  <IconBtn label="✕" onClick={() => excludeShot(cu.id)} />
                </div>
              </div>
            ))}
          </div>

          {excluded.length > 0 && (
            <>
              <div style={{ fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-faint)", margin: "14px 0 8px" }}>Not in this cut</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {excluded.map((rk) => (
                  <div key={rk.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px 7px 10px", border: "1px dashed var(--border)", borderRadius: 7, fontSize: 12.5, opacity: 0.85 }}>
                    <span style={{ fontFamily: "var(--mono)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rk.id}</span>
                    <button onClick={() => includeShot(rk.id)} style={{ fontSize: 11.5, color: "var(--accent)", background: "none", border: "1px solid var(--accent)", borderRadius: 6, padding: "2px 9px", cursor: "pointer" }}>+ Add</button>
                  </div>
                ))}
              </div>
            </>
          )}

          <button onClick={() => nav("frame")} style={{ ...primary, width: "100%", marginTop: 16 }}>Continue to Edit →</button>
        </div>
      </div>
    </div>
  );
}

const primary: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "var(--accent-contrast)",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

function IconBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ width: 22, height: 22, borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface)", color: disabled ? "var(--text-faint)" : "var(--text-muted)", fontSize: 11, cursor: disabled ? "not-allowed" : "pointer", lineHeight: 1 }}
    >
      {label}
    </button>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "10px 14px", border: "1px solid var(--danger)", borderRadius: 8, background: "rgba(248,113,113,.08)", color: "var(--danger)", fontSize: 12.5, marginBottom: 14, whiteSpace: "pre-wrap" }}>
      <span>⚠</span><span>{text}</span>
    </div>
  );
}

function Empty() {
  const { nav } = useStudio();
  return (
    <div style={{ padding: 40, color: "var(--text-muted)" }}>
      No project open.{" "}
      <button onClick={() => nav("projects")} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontSize: "inherit" }}>Open a project</button>
    </div>
  );
}
