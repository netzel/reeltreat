import { useStudio } from "../store";
import { mediaUrl } from "../api";
import { cv, hatch } from "../ui";
import { cropImageStyle } from "../crop";
import { CropModal } from "../components/CropModal";

const STATUS_COLOR: Record<string, string> = {
  captured: "--success",
  warning: "--warning",
  failed: "--danger",
};

export function CaptureScreen() {
  const {
    projectName,
    detail,
    captureState,
    captureProgress,
    captureSummary,
    busy,
    error,
    runCapture,
    crops,
    cropShotId,
    openCrop,
    nav,
  } = useStudio();

  if (!projectName || !detail) {
    return (
      <div style={{ padding: 40, color: "var(--text-muted)" }}>
        No project open.{" "}
        <button onClick={() => nav("projects")} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontSize: "inherit" }}>Open a project</button>
      </div>
    );
  }

  const shots = detail.shots;
  const running = busy === "Capturing";
  // Per-shot status from the live progress stream, keyed by shot id.
  const progressById = new Map(captureProgress.map((p) => [p.id, p.status]));
  const doneCount = captureProgress.length;

  if (captureState === "empty" && !running) {
    return (
      <div style={{ padding: "20px 24px", maxWidth: 1160 }}>
        {error && <ErrorBanner text={error} />}
        <div style={{ border: "1px dashed var(--border)", borderRadius: 12, padding: 56, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", background: "var(--surface)" }}>
          <div style={{ width: 60, height: 60, borderRadius: 15, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 16 }}>◉</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Ready to capture {shots.length} shots</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13, margin: "8px 0 20px", maxWidth: 420 }}>
            Capture screenshots each browser route (and normalizes your manual images) into
            <span style={{ fontFamily: "var(--mono)" }}> captures/</span>.
            {shots.some((s) => s.kind === "browser") && !detail.info.hasAuth && (
              <> Sign in first on the <b>Authenticate</b> step.</>
            )}
          </div>
          <button onClick={runCapture} style={{ padding: "11px 22px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>▸ Start capture</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1160 }}>
      {error && <ErrorBanner text={error} />}
      <div style={{ display: "flex", alignItems: "center", gap: 16, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px", marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{running ? "Capturing" : "Captured"} {shots.length} shots</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{doneCount} / {shots.length} done</div>
        </div>
        <div style={{ flex: 1, maxWidth: 420 }}>
          <div style={{ height: 8, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
            <div style={{ width: `${shots.length ? (doneCount / shots.length) * 100 : 0}%`, height: "100%", background: running ? "var(--accent)" : "var(--success)", transition: "width .2s" }} />
          </div>
        </div>
        <button onClick={runCapture} disabled={running} style={{ padding: "8px 13px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12.5, cursor: running ? "not-allowed" : "pointer" }}>↻ Re-run</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14 }}>
        {shots.map((sh) => {
          const live = progressById.get(sh.id);
          const status = live ?? (sh.captured ? "captured" : undefined);
          const color = status ? STATUS_COLOR[status] : "--text-faint";
          // Cache-bust so re-captures show fresh images.
          const src = mediaUrl(projectName, "captures", sh.file) + `?v=${doneCount}`;
          const cropped = crops[sh.id];
          const hasImage = Boolean(status || sh.captured);
          const canCrop = hasImage && !running;
          return (
            <div key={sh.id} style={{ borderRadius: 9, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div style={{ position: "relative", height: 104, overflow: "hidden", background: hatch(10) }}>
                {hasImage &&
                  (cropped ? (
                    // Show the cropped region as it'll appear in the reel.
                    <img src={src} alt={sh.id} draggable={false} onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} style={cropImageStyle(cropped)} />
                  ) : (
                    <img src={src} alt={sh.id} onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ))}
                <span style={{ position: "absolute", top: 7, left: 8, fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,.85)", background: "rgba(0,0,0,.5)", padding: "2px 6px", borderRadius: 4 }}>{sh.id}</span>
                {status && (
                  <span style={{ position: "absolute", top: 7, right: 8, fontSize: 9.5, fontWeight: 700, color: cv(color), background: "rgba(0,0,0,.55)", border: `1px solid ${cv(color)}`, borderRadius: 999, padding: "1px 7px" }}>{status}</span>
                )}
                {sh.kind === "manual" && (
                  <span style={{ position: "absolute", bottom: 7, left: 8, fontSize: 9.5, fontWeight: 700, color: "#1a1033", background: "var(--ai)", borderRadius: 999, padding: "1px 7px" }}>✦ manual</span>
                )}
                {cropped && (
                  <span style={{ position: "absolute", bottom: 7, right: 8, fontSize: 9.5, fontWeight: 700, color: "var(--accent-contrast)", background: "var(--accent)", borderRadius: 999, padding: "1px 7px" }}>✂ cropped</span>
                )}
                {canCrop && (
                  <button
                    onClick={() => openCrop(sh.id)}
                    title="Crop this shot"
                    style={{ position: "absolute", bottom: 7, right: cropped ? 78 : 8, fontSize: 10.5, fontWeight: 600, color: "var(--text)", background: "rgba(20,22,27,.82)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}
                  >
                    ✂ Crop
                  </button>
                )}
              </div>
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sh.caption}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
        {captureSummary && (
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            <b style={{ color: "var(--success)" }}>{captureSummary.captured} captured</b> ·{" "}
            <b style={{ color: "var(--warning)" }}>{captureSummary.warnings} warning</b> ·{" "}
            <b style={{ color: "var(--text-faint)" }}>{captureSummary.failed} failed</b>
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={() => nav("curate")} disabled={running} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 13, cursor: running ? "not-allowed" : "pointer" }}>Continue to Curate →</button>
      </div>

      {cropShotId && <CropModal />}
    </div>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "10px 14px", border: "1px solid var(--danger)", borderRadius: 8, background: "rgba(248,113,113,.08)", color: "var(--danger)", fontSize: 12.5, marginBottom: 14, whiteSpace: "pre-wrap" }}>
      <span>⚠</span><span>{text}</span>
    </div>
  );
}
