import { useStudio } from "../store";
import type { Tier } from "../types";

const TIERS: Tier[] = ["5", "15", "30", "45"];

function mediaRel(project: string, relPath: string): string {
  return `/media/${encodeURIComponent(project)}/${relPath}`;
}

export function PreviewScreen() {
  const {
    projectName,
    curation,
    tier,
    setTier,
    exportState,
    renderProgress,
    renderResult,
    dirty,
    busy,
    error,
    runRender,
    nav,
  } = useStudio();

  if (!projectName || !curation) {
    return (
      <div style={{ padding: 40, color: "var(--text-muted)" }}>
        Curate the project first.{" "}
        <button onClick={() => nav("curate")} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontSize: "inherit" }}>Go to Curate</button>
      </div>
    );
  }

  const rendering = busy === "Rendering";
  const pct =
    renderProgress?.phase === "render" ? Math.round((renderProgress.progress ?? 0) * 100) : undefined;
  const video = renderResult?.outputs.find((o) => o.kind === "video");
  const poster = renderResult?.outputs.find((o) => o.kind === "poster");

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
          <div style={{ position: "relative", aspectRatio: "16 / 10", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {video ? (
              <video key={video.relPath} src={mediaRel(projectName, video.relPath)} controls poster={poster ? mediaRel(projectName, poster.relPath) : undefined} style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
            ) : poster ? (
              <img src={mediaRel(projectName, poster.relPath)} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <div style={{ color: "var(--text-faint)", fontSize: 13, textAlign: "center", padding: 24 }}>
                {rendering ? "Rendering…" : "Render to preview the video here."}
              </div>
            )}
            <span style={{ position: "absolute", top: 14, right: 14, fontFamily: "var(--mono)", fontSize: 11, background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, padding: "4px 10px", borderRadius: 999 }}>{tier}s</span>
          </div>
        </section>

        <div style={{ marginTop: 16, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, fontSize: 12.5, color: "var(--text-muted)" }}>
          Each render writes a new, uniquely-named folder under{" "}
          <span style={{ fontFamily: "var(--mono)" }}>projects/{projectName}/renders/</span> — previous videos are kept, never overwritten.
          {renderResult && (
            <div style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-faint)" }}>
              latest run: renders/{renderResult.runId}/
            </div>
          )}
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, position: "sticky", top: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Export</div>

        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Duration</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {TIERS.map((t) => (
            <button key={t} onClick={() => setTier(t)} style={tierBtn(t)}>{t}s</button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, fontSize: 12.5 }}>
          <Row label="Format" value="MP4 · H.264" />
          <Row label="Frame rate" value="30 fps" />
          <Row label="Length" value={`${tier}s`} />
        </div>

        {dirty && (
          <div style={{ fontSize: 11.5, color: "var(--warning)", marginBottom: 10 }}>
            You have unsaved curation edits — they'll be saved automatically before rendering.
          </div>
        )}

        {!rendering && (
          <button onClick={() => runRender({ duration: Number(tier) })} style={{ width: "100%", padding: 13, borderRadius: 9, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "var(--shadow-sm)" }}>
            ▸ Render {tier}s video + poster
          </button>
        )}

        {rendering && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
              <span>
                {renderProgress?.phase === "bundle" && "Bundling…"}
                {renderProgress?.phase === "render" && `Rendering ${renderProgress.tier}s`}
                {renderProgress?.phase === "poster" && "Rendering poster…"}
                {!renderProgress && "Starting…"}
              </span>
              {pct !== undefined && <span style={{ fontFamily: "var(--mono)", color: "var(--text-muted)" }}>{pct}%</span>}
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
              <div style={{ width: `${pct ?? 15}%`, height: "100%", background: "var(--accent)", transition: "width .2s" }} />
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--danger)", background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 8, padding: "8px 10px", whiteSpace: "pre-wrap" }}>
            {error}
          </div>
        )}

        {exportState === "done" && renderResult && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--success)", fontWeight: 600, fontSize: 13.5, marginBottom: 12 }}>
              <span style={{ width: 22, height: 22, borderRadius: 999, background: "rgba(52,211,153,.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>
              Render complete
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {renderResult.outputs.map((o) => (
                <a
                  key={o.relPath}
                  href={mediaRel(projectName, o.relPath)}
                  download
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, textDecoration: "none", color: "var(--text)" }}
                >
                  <span style={{ width: 30, height: 30, borderRadius: 7, background: "var(--accent)", color: "var(--accent-contrast)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>↓</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.relPath.split("/").pop()}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{(o.bytes / 1024 / 1024).toFixed(1)} MB · {o.kind}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
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
