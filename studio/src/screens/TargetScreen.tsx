import { useState } from "react";
import { useStudio } from "../store";
import { api, type DetectResult } from "../api";
import { seg } from "../ui";

export function TargetScreen() {
  const { connectMode, setConnectMode, nav, loadProjects, openProject } = useStudio();
  const isRepo = connectMode === "repo";

  const [repoPath, setRepoPath] = useState("");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [detected, setDetected] = useState<DetectResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const detect = async () => {
    setError(null);
    setStatus("Detecting…");
    setDetected(null);
    try {
      const result = await api.detectTarget({ repoPath });
      setDetected(result);
      setStatus(`${result.framework} · ${result.routes} routes · brand extracted`);
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const create = async () => {
    setError(null);
    setStatus("Creating manifest…");
    try {
      await api.createProject({
        name: name.trim(),
        repoPath: repoPath.trim(),
        baseUrl: baseUrl.trim() || undefined,
      });
      await loadProjects();
      await openProject(name.trim()); // navigates to the project (capture step)
      nav("manifest");
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const canCreate = name.trim().length > 0 && repoPath.trim().length > 0;

  return (
    <div style={{ padding: 28, maxWidth: 760 }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em", marginBottom: 4 }}>New project</div>
      <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 22 }}>
        Point at a local app repo. reeltreat detects the framework and routes and writes a manifest.
      </div>

      <div style={{ display: "flex", gap: 6, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 5, marginBottom: 22 }}>
        <button onClick={() => setConnectMode("repo")} style={seg(isRepo)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: "inherit" }}>📁 From a local repo</div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 400, marginTop: 2 }}>Auto-detect framework & routes</div>
        </button>
        <button onClick={() => setConnectMode("blank")} style={seg(!isRepo)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: "inherit" }}>🌐 Deployed URL only</div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 400, marginTop: 2 }}>Hand-write the manifest after</div>
        </button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
        {isRepo ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 7 }}>Repository path</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                placeholder="/path/to/your/app"
                style={{ ...mono, flex: 1 }}
              />
              <button
                onClick={detect}
                disabled={!repoPath.trim()}
                style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 12.5, cursor: repoPath.trim() ? "pointer" : "not-allowed", opacity: repoPath.trim() ? 1 : 0.5 }}
              >
                Detect
              </button>
            </div>
            {detected && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 15px", border: "1px solid var(--success)", borderRadius: 10, background: "rgba(52,211,153,.08)", marginBottom: 18 }}>
                <span style={{ color: "var(--success)", fontSize: 16 }}>✓</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{detected.framework} · {detected.routes} routes</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                    primary {detected.brand.primaryColor ?? "—"} · accent {detected.brand.accentColor ?? "—"} · {detected.brand.font ?? "default font"}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 18 }}>
            For a deployed URL with no local repo, create the project here, then edit the manifest by hand
            on the next screen (add each shot's <span style={{ fontFamily: "var(--mono)" }}>path</span> and
            <span style={{ fontFamily: "var(--mono)" }}> caption</span>).
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>Project name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="myapp" style={input} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>Base URL (optional)</div>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:3000" style={mono} />
          </div>
        </div>

        {status && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{status}</div>}
        {error && (
          <div style={{ fontSize: 12.5, color: "var(--danger)", background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 6, padding: "8px 10px", whiteSpace: "pre-wrap" }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
        <button onClick={() => nav("projects")} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
        <button
          onClick={create}
          disabled={!canCreate}
          style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 13, cursor: canCreate ? "pointer" : "not-allowed", opacity: canCreate ? 1 : 0.5 }}
        >
          Create & open manifest →
        </button>
      </div>
    </div>
  );
}
