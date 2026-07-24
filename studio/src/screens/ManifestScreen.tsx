import { useEffect, useState } from "react";
import { useStudio } from "../store";

export function ManifestScreen() {
  const { projectName, detail, manifestText, loadManifest, saveManifest, busy, error, nav } = useStudio();
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load the manifest text whenever the open project changes.
  useEffect(() => {
    if (projectName) loadManifest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName]);

  useEffect(() => {
    if (manifestText !== null) {
      setText(manifestText);
      setDirty(false);
    }
  }, [manifestText]);

  if (!projectName) {
    return <Empty />;
  }

  const save = async () => {
    setSaved(false);
    await saveManifest(text);
    setDirty(false);
    setSaved(true);
  };

  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 };

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1120 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Manifest & Shots</div>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-faint)" }}>
          projects/{projectName}/manifest.yaml
        </span>
        {detail?.info && !detail.info.ready && (
          <span style={{ fontSize: 11.5, color: "var(--warning)", border: "1px solid var(--warning)", borderRadius: 999, padding: "2px 9px" }}>needs setup</span>
        )}
        <div style={{ flex: 1 }} />
        {saved && !dirty && <span style={{ fontSize: 12, color: "var(--success)" }}>✓ saved</span>}
        <button
          onClick={save}
          disabled={!dirty || !!busy}
          style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 13, cursor: dirty ? "pointer" : "not-allowed", opacity: dirty ? 1 : 0.5 }}
        >
          {busy ?? "Save manifest"}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 12.5, color: "var(--danger)", background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 8, padding: "10px 12px", marginBottom: 14, whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>manifest.yaml</div>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDirty(true);
              setSaved(false);
            }}
            spellCheck={false}
            style={{
              width: "100%",
              minHeight: 460,
              resize: "vertical",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "12px 14px",
              color: "var(--text)",
              fontFamily: "var(--mono)",
              fontSize: 12.5,
              lineHeight: 1.6,
            }}
          />
          <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 8 }}>
            Saving validates the manifest (schema + shot ids); an invalid manifest is rejected with the reason.
          </div>
        </div>

        <div style={{ ...card, position: "sticky", top: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Shots</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            {detail?.shots.length ?? 0} in the manifest
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(detail?.shots ?? []).map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 7 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)", width: 16 }}>{s.index}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{s.id}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.caption}</div>
                </div>
                <span style={{ fontSize: 10, color: s.kind === "manual" ? "var(--ai)" : "var(--text-muted)", border: `1px solid ${s.kind === "manual" ? "var(--ai)" : "var(--border)"}`, borderRadius: 999, padding: "1px 7px" }}>{s.kind}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <button onClick={() => nav("auth")} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}>Authenticate →</button>
        <button onClick={() => nav("capture")} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Go to Capture →</button>
      </div>
    </div>
  );
}

function Empty() {
  const { nav } = useStudio();
  return (
    <div style={{ padding: 40, color: "var(--text-muted)" }}>
      No project open.{" "}
      <button onClick={() => nav("projects")} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontSize: "inherit" }}>
        Open a project
      </button>
    </div>
  );
}
