import { useStudio } from "../store";
import { PROJECTS, STATUS_COLOR } from "../data/mock";
import { cv, hatch } from "../ui";

export function ProjectsScreen() {
  const { nav } = useStudio();
  const openProject = (name: string) => nav(name === "myapp" ? "frame" : "manifest");

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1160 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.02em" }}>Projects</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>Every project deserves a trailer.</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", width: 240 }}>
          <span style={{ color: "var(--text-faint)" }}>⌕</span>
          <input placeholder="Search projects" style={{ flex: 1, border: "none", background: "none", color: "var(--text)", fontSize: 13, outline: "none" }} />
        </div>
        <div style={{ display: "flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <button style={{ padding: "8px 12px", border: "none", background: "var(--surface-2)", color: "var(--text)", fontSize: 12, cursor: "pointer" }}>Recent ▾</button>
        </div>
        <button
          onClick={() => nav("target")}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 13, cursor: "pointer", boxShadow: "var(--shadow-sm)" }}
        >
          + New project
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(258px,1fr))", gap: 16 }}>
        {PROJECTS.map((p) => (
          <div
            key={p.name}
            onClick={() => openProject(p.name)}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", boxShadow: "var(--shadow-sm)", cursor: "pointer" }}
          >
            <div style={{ position: "relative", height: 150, background: hatch(11) }}>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: `linear-gradient(135deg,${p.c1},${p.c2})`, boxShadow: "0 6px 20px rgba(0,0,0,.35)" }} />
              </div>
              <span style={{ position: "absolute", top: 10, left: 10, fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,.6)", background: "rgba(0,0,0,.4)", padding: "3px 7px", borderRadius: 5 }}>poster</span>
              {p.unsaved && <span style={{ position: "absolute", top: 10, right: 10, width: 9, height: 9, borderRadius: 999, background: "var(--accent)", boxShadow: "0 0 0 3px rgba(255,176,32,.25)" }} />}
            </div>
            <div style={{ padding: "13px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{p.name}</div>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10.5, fontWeight: 600, color: cv(STATUS_COLOR[p.status]), border: `1px solid ${cv(STATUS_COLOR[p.status])}`, borderRadius: 999, padding: "2px 8px" }}>{p.status}</span>
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 11 }}>{p.url}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 11.5 }}>
                <span>{p.shots} shots</span><span>·</span><span>{p.updated}</span>
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
