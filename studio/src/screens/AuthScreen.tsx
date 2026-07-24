import { useStudio } from "../store";
import { seg } from "../ui";

export function AuthScreen() {
  const { projectName, authMode, setAuthMode, authStep, startLogin, confirmLogin, busy, error, nav } = useStudio();
  const isStealth = authMode === "stealth";

  const primaryBtn: React.CSSProperties = { padding: "11px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" };

  return (
    <div style={{ padding: 28, maxWidth: 680 }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em", marginBottom: 4 }}>Authenticate</div>
      <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 22 }}>
        The bridge opens a real Chrome window so you can sign in to {projectName ?? "your app"}. The session is saved
        locally under <span style={{ fontFamily: "var(--mono)" }}>auth/{projectName}.json</span> and never leaves your machine.
      </div>

      <div style={{ display: "flex", gap: 6, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 5, marginBottom: 20 }}>
        <button onClick={() => setAuthMode("stealth")} style={seg(isStealth)}>
          <div style={{ fontWeight: "inherit" }}>🕶 Stealth <span style={{ fontSize: 10.5, color: "var(--success)", fontWeight: 600 }}>recommended</span></div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 400, marginTop: 2 }}>Your installed Chrome, isolated profile</div>
        </button>
        <button onClick={() => setAuthMode("attach")} style={seg(!isStealth)}>
          <div style={{ fontWeight: "inherit" }}>🔗 Attach</div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 400, marginTop: 2 }}>Attach to your own Chrome (CDP)</div>
        </button>
      </div>

      {!isStealth && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 8 }}>Attach mode: quit Chrome, relaunch it with remote debugging, sign in, then confirm below.</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 12, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", color: "var(--info)", whiteSpace: "pre-wrap" }}>
            {"google-chrome --remote-debugging-port=9222"}
          </div>
        </div>
      )}

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 22, minHeight: 170, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        {(authStep === "idle" || authStep === "error") && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 14 }}>⚿</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Ready to sign in</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, maxWidth: 360, marginBottom: 18 }}>
              The bridge opens Chrome at your login URL. Sign in normally — reeltreat saves the session cookie.
            </div>
            <button onClick={startLogin} disabled={!!busy || !projectName} style={{ ...primaryBtn, boxShadow: "var(--shadow-sm)", opacity: projectName ? 1 : 0.5 }}>
              {busy ?? "Open Chrome & sign in"}
            </button>
          </>
        )}
        {authStep === "opening" && (
          <>
            <span style={{ width: 34, height: 34, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: 999, animation: "spin .8s linear infinite", marginBottom: 16 }} />
            <div style={{ fontWeight: 600, fontSize: 15 }}>Opening Chrome…</div>
          </>
        )}
        {authStep === "active" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: "var(--info)", animation: "pulse 1.4s infinite" }} /><span style={{ fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--info)" }}>Chrome window open</span></div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Sign in in the Chrome window</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, maxWidth: 360, marginBottom: 18 }}>Once you're logged in, confirm here — the bridge saves the session for capture.</div>
            <button onClick={confirmLogin} disabled={!!busy} style={primaryBtn}>{busy ?? "I've signed in"}</button>
          </>
        )}
        {authStep === "success" && (
          <>
            <div style={{ width: 52, height: 52, borderRadius: 999, background: "rgba(52,211,153,.14)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 14 }}>✓</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Session saved locally</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 18 }}>Stored at <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>auth/{projectName}.json</span> · gitignored. You can capture now.</div>
            <button onClick={() => nav("capture")} style={primaryBtn}>Continue to Capture →</button>
          </>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 16, fontFamily: "var(--mono)", fontSize: 12, color: "var(--danger)", background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 8, padding: "10px 12px", whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      )}
      <div style={{ marginTop: 14, fontSize: 12, color: "var(--text-faint)" }}>
        Login needs a machine with a display and Google Chrome. For an image-only project you can skip this and capture directly.
      </div>
    </div>
  );
}
