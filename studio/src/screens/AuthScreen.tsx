import { useStudio } from "../store";
import { seg } from "../ui";

export function AuthScreen() {
  const { authMode, setAuthMode, authStep, setAuthStep, openChrome, nav } = useStudio();
  const isStealth = authMode === "stealth";

  const primaryBtn: React.CSSProperties = { padding: "11px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" };
  const ghostBtn: React.CSSProperties = { padding: "11px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, cursor: "pointer" };

  return (
    <div style={{ padding: 28, maxWidth: 680 }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em", marginBottom: 4 }}>Authenticate</div>
      <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 22 }}>Studio opens a real Chrome window so you can sign in to myapp. The session is saved locally and never leaves your machine.</div>

      <div style={{ display: "flex", gap: 6, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 5, marginBottom: 20 }}>
        <button onClick={() => setAuthMode("stealth")} style={seg(isStealth)}>
          <div style={{ fontWeight: "inherit" }}>🕶 Stealth <span style={{ fontSize: 10.5, color: "var(--success)", fontWeight: 600 }}>recommended</span></div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 400, marginTop: 2 }}>Fresh isolated Chrome profile</div>
        </button>
        <button onClick={() => setAuthMode("attach")} style={seg(!isStealth)}>
          <div style={{ fontWeight: "inherit" }}>🔗 Attach</div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 400, marginTop: 2 }}>Use your existing Chrome</div>
        </button>
      </div>

      {isStealth ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface-2)", marginBottom: 18, fontSize: 12.5, color: "var(--text-muted)" }}>
          <span style={{ color: "var(--info)" }}>ⓘ</span> A clean, isolated Chrome profile keeps your everyday browser untouched. No extensions, no existing cookies.
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 8 }}>Start Chrome with remote debugging, then Studio attaches:</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 12, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", color: "var(--info)", whiteSpace: "pre-wrap" }}>
            {"/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\\n  --remote-debugging-port=9222"}
          </div>
        </div>
      )}

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 22, minHeight: 170, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        {authStep === "idle" && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 14 }}>⚿</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Ready to sign in</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, maxWidth: 340, marginBottom: 18 }}>Studio will open Chrome at <span style={{ fontFamily: "var(--mono)" }}>/login</span>. Sign in normally — reeltreat captures the session cookie.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={openChrome} style={{ ...primaryBtn, boxShadow: "var(--shadow-sm)" }}>Open Chrome & sign in</button>
              <button onClick={() => setAuthStep("error")} style={{ padding: "11px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-faint)", fontSize: 12, cursor: "pointer" }}>simulate error</button>
            </div>
          </>
        )}
        {authStep === "opening" && (
          <>
            <span style={{ width: 34, height: 34, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: 999, animation: "spin .8s linear infinite", marginBottom: 16 }} />
            <div style={{ fontWeight: 600, fontSize: 15 }}>Opening Chrome…</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Launching isolated profile</div>
          </>
        )}
        {authStep === "active" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: "var(--info)", animation: "pulse 1.4s infinite" }} /><span style={{ fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--info)" }}>Chrome window open</span></div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Sign in to myapp in the Chrome window</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, maxWidth: 360, marginBottom: 18 }}>Once you're logged in, come back and confirm — Studio saves the session for capture.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setAuthStep("success")} style={primaryBtn}>I've signed in</button>
              <button onClick={() => setAuthStep("idle")} style={ghostBtn}>Cancel</button>
            </div>
          </>
        )}
        {authStep === "success" && (
          <>
            <div style={{ width: 52, height: 52, borderRadius: 999, background: "rgba(52,211,153,.14)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 14 }}>✓</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Session saved locally</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 4 }}>Stored at <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>auth/myapp.json</span> · gitignored</div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 18 }}>You can capture now.</div>
            <button onClick={() => nav("capture")} style={primaryBtn}>Continue to Capture →</button>
          </>
        )}
        {authStep === "error" && (
          <>
            <div style={{ width: 52, height: 52, borderRadius: 999, background: "rgba(248,113,113,.14)", color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 14 }}>✕</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Couldn't launch Chrome</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12.5, maxWidth: 380, marginBottom: 6 }}>No Chrome executable found. Set the path in Settings or install Google Chrome.</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--danger)", background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 6, padding: "6px 10px", marginBottom: 16 }}>Error: spawn chrome ENOENT</div>
            <button onClick={() => setAuthStep("idle")} style={ghostBtn}>Try again</button>
          </>
        )}
      </div>
    </div>
  );
}
