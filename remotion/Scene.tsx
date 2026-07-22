import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import type { SceneProps } from "./types";
import { accentColor, fontFamily } from "./theme";

/**
 * One full-bleed screenshot with a Ken Burns move (scale + pan driven by
 * interpolate), a soft vignette, and a callout chip that slides/fades in near the
 * bottom-left then out before the scene ends. The scene fades in over its first
 * `fadeInFrames` frames so it crossfades with whatever precedes it.
 *
 * The image sits in a container inset beyond the frame edges (overscan), so the
 * pan never reveals a blank margin while scale stays in the subtle 1.0–1.08 range.
 */
export const Scene: React.FC<SceneProps> = ({
  src,
  callout,
  durationInFrames,
  fadeInFrames,
  kenBurns,
  brand,
}) => {
  const frame = useCurrentFrame();
  const accent = accentColor(brand);
  const font = fontFamily(brand);

  const scale = interpolate(
    frame,
    [0, durationInFrames],
    [kenBurns.fromScale, kenBurns.toScale],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const PAN_PX = 24;
  const tx = interpolate(frame, [0, durationInFrames], [0, kenBurns.panX * PAN_PX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ty = interpolate(frame, [0, durationInFrames], [0, kenBurns.panY * PAN_PX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sceneOpacity = interpolate(frame, [0, fadeInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Callout: slide up + fade in early, hold, then fade/slide out before the end.
  const inEnd = 6 + 14;
  const outStart = Math.max(inEnd + 1, durationInFrames - 24);
  const outEnd = durationInFrames - 10;
  const calloutOpacity = interpolate(
    frame,
    [6, inEnd, outStart, outEnd],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const calloutY = interpolate(frame, [6, inEnd], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", opacity: sceneOpacity }}>
      <div
        style={{
          position: "absolute",
          inset: -40,
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: "center",
        }}
      >
        <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      {/* Soft vignette to focus the eye and seat the callout. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 120% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)",
        }}
      />

      {callout ? (
        <div
          style={{
            position: "absolute",
            left: 56,
            bottom: 56,
            opacity: calloutOpacity,
            transform: `translateY(${calloutY}px)`,
          }}
        >
          <div
            style={{
              display: "inline-block",
              backgroundColor: accent,
              color: "#ffffff",
              fontFamily: font,
              fontSize: 26,
              fontWeight: 600,
              padding: "12px 22px",
              borderRadius: 999,
              boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            }}
          >
            {callout}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
