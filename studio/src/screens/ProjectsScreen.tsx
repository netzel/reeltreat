import { useStudio } from "../store";
import type { ProjectStatus } from "../api";
import { cv, hatch } from "../ui";

/** CSS variable name for each project status pill. */
const STATUS_COLOR: Record<ProjectStatus, string> = {
  Draft: "--text-faint",
  Captured: "--info",
  Curated: "--ai",
  Rendered: "--success",
};

export function ProjectsScreen() {
  const { projects, busy, error, openProject, nav } = useStudio();

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1160 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.02em" }}>Projects</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>Every project deserves a trailer.</div>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => nav("target")}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 13, cursor: "pointer", boxShadow: "var(--shadow-sm)" }}
        >
          + New project
        </button>
      </div>

      {error && <Banner text={error} />}
      {busy && <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 14 }}>{busy}…</div>}
      {!busy && projects.length === 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 14 }}>
          No projects yet — click <b>New project</b>, or start the bridge with <span style={{ fontFamily: "var(--mono)" }}>npm run bridge</span>.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(258px,1fr))", gap: 16 }}>
        {projects.map((p) => (
          <div
            key={p.name}
            onClick={() => openProject(p.name)}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", boxShadow: "var(--shadow-sm)", cursor: "pointer" }}
          >
            <div style={{ position: "relative", height: 150, background: hatch(11) }}>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {p.primaryColor && (
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: `linear-gradient(135deg,${p.primaryColor},${p.accentColor ?? p.primaryColor})`, boxShadow: "0 6px 20px rgba(0,0,0,.35)", opacity: 0.9 }} />
                )}
              </div>
            </div>
            <div style={{ padding: "13px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{p.displayName}</div>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10.5, fontWeight: 600, color: cv(STATUS_COLOR[p.status]), border: `1px solid ${cv(STATUS_COLOR[p.status])}`, borderRadius: 999, padding: "2px 8px" }}>{p.status}</span>
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 11 }}>{p.baseUrl}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 11.5 }}>
                <span>{p.shots} shots</span>
                {!p.ready && <><span>·</span><span style={{ color: "var(--warning)" }}>needs setup</span></>}
                <div style={{ flex: 1 }} />
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>Open →</span>
              </div>
            </div>
          </div>
        ))}

        <div
          onClick={() => nav("target")}
          style={{ border: "1px dashed var(--border)", borderRadius: 10, minHeight: 220, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text-faint)", cursor: "pointer", background: "var(--surface)" }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 999, border: "1px solid var(--brand-blue)", color: "var(--brand-blue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, background: "rgba(44,174,236,.08)" }}>+</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>New project</div>
          <div style={{ fontSize: 11.5 }}>Point at a site → get a trailer</div>
        </div>
      </div>
    </div>
  );
}

function Banner({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "10px 14px", border: "1px solid var(--danger)", borderRadius: 8, background: "rgba(248,113,113,.08)", color: "var(--danger)", fontSize: 12.5, marginBottom: 14 }}>
      <span>⚠</span>
      <span>{text}</span>
    </div>
  );
}
