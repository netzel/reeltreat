import { useMemo, useRef, useState } from "react";
import { useStudio } from "../store";
import { mediaUrl } from "../api";
import { applyAspect, clampRect, cropImageStyle, FULL_RECT, pixelAspect } from "../crop";
import type { Rect } from "../types";

/**
 * Non-destructive crop editor, opened from a Capture thumbnail. Draws a
 * draggable/resizable rectangle over the captured screenshot; the chosen region
 * becomes the whole video frame (fit: fill), previewed live. Applying persists a
 * normalized Rect to edit.json via the store; the original screenshot is never
 * altered.
 */

type Handle = "nw" | "ne" | "sw" | "se";
type Drag =
  | { kind: "move"; startX: number; startY: number; rect: Rect }
  | { kind: "resize"; handle: Handle; rect: Rect };

const PRESETS: { key: string; label: string; aspect: number | null }[] = [
  { key: "original", label: "Frame", aspect: null }, // resolved to the image's own ratio
  { key: "16:9", label: "16:9", aspect: 16 / 9 },
  { key: "1:1", label: "1:1", aspect: 1 },
  { key: "free", label: "Free", aspect: null },
];

export function CropModal() {
  const { projectName, detail, cropShotId, crops, applyCrop, resetCrop, closeCrop, busy } =
    useStudio();

  const shot = detail?.shots.find((s) => s.id === cropShotId);
  const saved = cropShotId ? crops[cropShotId] : undefined;

  const [rect, setRect] = useState<Rect>(saved ?? FULL_RECT);
  const [presetKey, setPresetKey] = useState<string>(saved ? "free" : "original");
  const [natural, setNatural] = useState<{ w: number; h: number }>({ w: 16, h: 9 });

  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag | null>(null);

  // The active aspect: "Frame" means the source image's own ratio (= viewport).
  const aspect = useMemo<number | null>(() => {
    if (presetKey === "original") return natural.w / natural.h;
    return PRESETS.find((p) => p.key === presetKey)?.aspect ?? null;
  }, [presetKey, natural]);

  if (!projectName || !cropShotId || !shot) return null;

  const src = mediaUrl(projectName, "captures", shot.file);

  // --- pointer-normalized position within the image box ---
  const toNorm = (e: PointerEvent | React.PointerEvent) => {
    const b = boxRef.current?.getBoundingClientRect();
    if (!b || b.width === 0 || b.height === 0) return { nx: 0, ny: 0 };
    return {
      nx: Math.min(Math.max((e.clientX - b.left) / b.width, 0), 1),
      ny: Math.min(Math.max((e.clientY - b.top) / b.height, 0), 1),
    };
  };

  const snap = (raw: Rect, handle?: Handle): Rect => {
    if (aspect === null) return clampRect(raw);
    const fixedRight = handle && handle.includes("w") ? raw.x + raw.w : null;
    const fixedBottom = handle && handle[0] === "n" ? raw.y + raw.h : null;
    let next = applyAspect(raw, natural.w, natural.h, aspect);
    if (fixedRight !== null) next = clampRect({ ...next, x: fixedRight - next.w });
    if (fixedBottom !== null) next = clampRect({ ...next, y: fixedBottom - next.h });
    return next;
  };

  const onMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const { nx, ny } = toNorm(e);
    if (d.kind === "move") {
      setRect(clampRect({ ...d.rect, x: nx - d.startX, y: ny - d.startY }));
      return;
    }
    // resize: the opposite corner stays put.
    const r = d.rect;
    let raw: Rect;
    if (d.handle === "se") raw = { x: r.x, y: r.y, w: nx - r.x, h: ny - r.y };
    else if (d.handle === "nw") raw = { x: nx, y: ny, w: r.x + r.w - nx, h: r.y + r.h - ny };
    else if (d.handle === "ne") raw = { x: r.x, y: ny, w: nx - r.x, h: r.y + r.h - ny };
    else raw = { x: nx, y: r.y, w: r.x + r.w - nx, h: ny - r.y }; // sw
    setRect(snap(raw, d.handle));
  };

  const endDrag = () => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", endDrag);
  };

  const beginMove = (e: React.PointerEvent) => {
    e.preventDefault();
    const { nx, ny } = toNorm(e);
    dragRef.current = { kind: "move", startX: nx - rect.x, startY: ny - rect.y, rect };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag);
  };

  const beginResize = (handle: Handle) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { kind: "resize", handle, rect };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag);
  };

  const pickPreset = (key: string) => {
    setPresetKey(key);
    const a = key === "original" ? natural.w / natural.h : PRESETS.find((p) => p.key === key)?.aspect ?? null;
    if (a !== null) setRect(applyAspect(rect, natural.w, natural.h, a));
  };

  const box = (r: Rect) => ({
    left: `${r.x * 100}%`,
    top: `${r.y * 100}%`,
    width: `${r.w * 100}%`,
    height: `${r.h * 100}%`,
  });

  const busyNow = !!busy;
  const pxAspect = pixelAspect(rect, natural.w, natural.h);

  return (
    <div
      onClick={closeCrop}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.6)",
        backdropFilter: "blur(2px)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          width: "min(980px, 96vw)",
          maxHeight: "92vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,.5)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Crop</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-faint)" }}>{shot.id}</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>Non-destructive · the original screenshot is untouched</span>
          <button onClick={closeCrop} style={{ marginLeft: 8, width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-muted)", cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 0, minHeight: 0 }}>
          {/* Editor */}
          <div style={{ padding: 18, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
            <div style={{ position: "relative", maxWidth: "100%", maxHeight: "62vh", lineHeight: 0 }}>
              <div ref={boxRef} style={{ position: "relative", userSelect: "none", touchAction: "none" }}>
                <img
                  src={src}
                  alt={shot.id}
                  draggable={false}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth && img.naturalHeight) {
                      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
                      // Snap the initial (uncropped) rect to the frame ratio.
                      if (!saved) setRect(applyAspect(FULL_RECT, img.naturalWidth, img.naturalHeight, img.naturalWidth / img.naturalHeight));
                    }
                  }}
                  style={{ display: "block", maxWidth: "100%", maxHeight: "62vh", borderRadius: 6 }}
                />
                {/* Crop rectangle with a dim mask over everything outside it. */}
                <div
                  onPointerDown={beginMove}
                  style={{
                    position: "absolute",
                    ...box(rect),
                    boxShadow: "0 0 0 9999px rgba(0,0,0,.55)",
                    outline: "1px solid rgba(255,255,255,.9)",
                    cursor: "move",
                  }}
                >
                  {/* rule-of-thirds */}
                  <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                    <div style={{ position: "absolute", left: "33.33%", top: 0, bottom: 0, borderLeft: "1px solid rgba(255,255,255,.35)" }} />
                    <div style={{ position: "absolute", left: "66.66%", top: 0, bottom: 0, borderLeft: "1px solid rgba(255,255,255,.35)" }} />
                    <div style={{ position: "absolute", top: "33.33%", left: 0, right: 0, borderTop: "1px solid rgba(255,255,255,.35)" }} />
                    <div style={{ position: "absolute", top: "66.66%", left: 0, right: 0, borderTop: "1px solid rgba(255,255,255,.35)" }} />
                  </div>
                  {(["nw", "ne", "sw", "se"] as Handle[]).map((h) => (
                    <div
                      key={h}
                      onPointerDown={beginResize(h)}
                      style={{
                        position: "absolute",
                        width: 14,
                        height: 14,
                        background: "var(--accent)",
                        border: "2px solid #000",
                        borderRadius: 3,
                        cursor: `${h}-resize`,
                        left: h.includes("w") ? -7 : undefined,
                        right: h.includes("e") ? -7 : undefined,
                        top: h[0] === "n" ? -7 : undefined,
                        bottom: h[0] === "s" ? -7 : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div style={{ borderLeft: "1px solid var(--border)", padding: 16, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 7 }}>Aspect ratio</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => pickPreset(p.key)}
                    style={{
                      padding: "7px 8px",
                      borderRadius: 7,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: `1px solid ${presetKey === p.key ? "var(--accent)" : "var(--border)"}`,
                      background: presetKey === p.key ? "var(--accent)" : "var(--surface-2)",
                      color: presetKey === p.key ? "var(--accent-contrast)" : "var(--text-muted)",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 6 }}>
                "Frame" matches the video's {natural.w}×{natural.h} ratio.
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 7 }}>Preview</div>
              <div style={{ position: "relative", width: "100%", aspectRatio: `${natural.w} / ${natural.h}`, overflow: "hidden", borderRadius: 8, border: "1px solid var(--border)", background: "#000" }}>
                <img src={src} alt="" draggable={false} style={cropImageStyle(rect)} />
              </div>
            </div>

            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-faint)", display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 3 }}>
              <span>x {rect.x.toFixed(3)}</span>
              <span>y {rect.y.toFixed(3)}</span>
              <span>w {rect.w.toFixed(3)}</span>
              <span>h {rect.h.toFixed(3)}</span>
              <span style={{ gridColumn: "1 / -1", marginTop: 2 }}>ratio {pxAspect.toFixed(2)}:1</span>
            </div>

            <div style={{ flex: 1 }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => applyCrop(cropShotId, rect)}
                disabled={busyNow}
                style={{ padding: 11, borderRadius: 9, border: "none", background: "var(--accent)", color: "var(--accent-contrast)", fontWeight: 700, fontSize: 13.5, cursor: busyNow ? "not-allowed" : "pointer", opacity: busyNow ? 0.6 : 1 }}
              >
                {busy === "Saving crop" ? "Applying…" : "Apply crop"}
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => (saved ? resetCrop(cropShotId) : (setRect(FULL_RECT), setPresetKey("original")))}
                  disabled={busyNow}
                  style={{ flex: 1, padding: 9, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12.5, cursor: busyNow ? "not-allowed" : "pointer" }}
                >
                  {saved ? "Reset crop" : "Reset"}
                </button>
                <button
                  onClick={closeCrop}
                  disabled={busyNow}
                  style={{ flex: 1, padding: 9, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-muted)", fontSize: 12.5, cursor: busyNow ? "not-allowed" : "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
