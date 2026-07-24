import { useEffect, useState } from "react";
import { useStudio } from "../store";
import { api } from "../api";

/** Read a File into base64 (without the data: prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("could not read file"));
    r.readAsDataURL(file);
  });
}

/** Slugify a filename stem into a shot id. */
function slugify(s: string): string {
  return s.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function ManifestScreen() {
  const { projectName, detail, manifestText, loadManifest, saveManifest, refreshDetail, busy, error, nav } = useStudio();
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  // "Add manual shot" upload form state.
  const [mFile, setMFile] = useState<File | null>(null);
  const [mId, setMId] = useState("");
  const [mCaption, setMCaption] = useState("");
  const [mBusy, setMBusy] = useState(false);
  const [mErr, setMErr] = useState<string | null>(null);

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

  const pickFile = (f: File | null) => {
    setMFile(f);
    setMErr(null);
    if (f && !mId) setMId(slugify(f.name)); // suggest an id from the filename
  };

  const addManual = async () => {
    if (!mFile || !projectName) return;
    setMErr(null);
    setMBusy(true);
    try {
      const dataBase64 = await fileToBase64(mFile);
      await api.addManualShot(projectName, { id: mId.trim(), caption: mCaption.trim(), filename: mFile.name, dataBase64 });
      setMFile(null);
      setMId("");
      setMCaption("");
      await loadManifest(); // refresh the YAML editor
      await refreshDetail(); // refresh the shot list
    } catch (e) {
      setMErr(e instanceof Error ? e.message : String(e));
    } finally {
      setMBusy(false);
    }
  };

  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 };
  const field: React.CSSProperties = { width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "7px 9px", color: "var(--text)", fontSize: 12.5 };

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

        <div style={{ position: "sticky", top: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={card}>
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

          {/* Add a manual (image) shot — uploads the file into the project's manual/ folder and appends a shot. */}
          <div style={card}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Add manual shot</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 12 }}>
              For a state the browser can't reach. The image is saved into <span style={{ fontFamily: "var(--mono)" }}>manual/</span> and added as an <span style={{ fontFamily: "var(--mono)" }}>image</span> shot; capture normalizes it like any other.
            </div>
            <label style={{ display: "block", border: "1px dashed var(--border)", borderRadius: 8, padding: "14px 12px", textAlign: "center", background: "var(--surface-2)", cursor: "pointer", marginBottom: 10 }}>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
              <span style={{ fontSize: 12.5, color: mFile ? "var(--text)" : "var(--accent)" }}>{mFile ? mFile.name : "Choose an image…"}</span>
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Shot id</div>
                <input value={mId} onChange={(e) => setMId(e.target.value)} placeholder="live-transcription" style={{ ...field, fontFamily: "var(--mono)" }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Caption</div>
                <input value={mCaption} onChange={(e) => setMCaption(e.target.value)} maxLength={80} placeholder="Real-time transcription as you speak" style={field} />
              </div>
            </div>
            {mErr && (
              <div style={{ fontSize: 11.5, color: "var(--danger)", background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 6, padding: "7px 9px", marginTop: 10, whiteSpace: "pre-wrap" }}>{mErr}</div>
            )}
            <button
              onClick={addManual}
              disabled={!mFile || !mId.trim() || mBusy}
              style={{ width: "100%", marginTop: 12, padding: 9, borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 13, cursor: mFile && mId.trim() && !mBusy ? "pointer" : "not-allowed", opacity: mFile && mId.trim() && !mBusy ? 1 : 0.5 }}
            >
              {mBusy ? "Adding…" : "+ Add manual shot"}
            </button>
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
