import { useStudio } from "../store";
import { stepModels, PIPELINE } from "../workflow";

export function StepNav() {
  const { screen, nav } = useStudio();
  const steps = stepModels(screen);

  return (
    <nav
      style={{
        flex: "0 0 auto",
        borderBottom: "1px solid var(--shell-border)",
        background: "var(--shell)",
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "0 16px",
        height: 52,
        overflowX: "auto",
      }}
    >
      {steps.map((st) => {
        const dotBg: React.CSSProperties =
          st.status === "done"
            ? { background: "var(--brand-blue)", color: "#04121f" }
            : st.status === "active"
              ? { background: "var(--accent)", color: "var(--accent-contrast)", boxShadow: "0 0 0 4px rgba(248,154,28,.18)" }
              : { background: "var(--surface-2)", color: "var(--text-faint)", border: "1px solid var(--border)" };

        const isLast = st.index === PIPELINE.length - 1;
        const curIdx = steps.findIndex((s) => s.status === "active");

        return (
          <span key={st.screen} style={{ display: "flex", alignItems: "center" }}>
            <button
              onClick={() => nav(st.screen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "8px 12px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                borderRadius: 8,
                opacity: st.status === "available" && st.index > curIdx ? 0.7 : 1,
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  flex: "0 0 24px",
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: st.status === "done" ? "inherit" : "var(--mono)",
                  ...dotBg,
                }}
              >
                {st.status === "done" ? "✓" : st.num}
              </span>
              <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, textAlign: "left" }}>
                <span style={{ fontSize: 9.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-faint)" }}>Step {st.num}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{st.name}</span>
              </span>
            </button>
            {!isLast && (
              <span
                style={{
                  width: 28,
                  height: 2,
                  borderRadius: 2,
                  background: st.index < curIdx ? "var(--brand-blue)" : "var(--border)",
                  margin: "0 2px",
                }}
              />
            )}
          </span>
        );
      })}
    </nav>
  );
}
