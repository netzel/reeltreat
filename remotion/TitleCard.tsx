import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { TitleCardProps } from "./types";
import { accentColor, fontFamily, primaryColor } from "./theme";

/**
 * Animated opening card: brand-colored background with a subtle gradient, an
 * optional logo springing in, the app name, and the tagline fading up beneath.
 * The whole card fades out over its final `crossfade` frames so it dissolves into
 * the first scene (its Sequence is extended by that many frames in Reel.tsx).
 */
export const TitleCard: React.FC<TitleCardProps> = ({
  appName,
  tagline,
  brand,
  durationInFrames,
  logoSrc,
  crossfade,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const primary = primaryColor(brand);
  const accent = accentColor(brand);
  const font = fontFamily(brand);

  // Logo springs in (scale + fade). spring() signature per /docs/spring.
  const logoSpring = spring({ frame, fps, config: { damping: 14 }, durationInFrames: 24 });

  // App name rises and fades in.
  const nameOpacity = interpolate(frame, [4, 4 + Math.round(fps * 0.4)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const nameY = interpolate(frame, [4, 4 + Math.round(fps * 0.4)], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Tagline follows, slightly delayed.
  const tagStart = 4 + Math.round(fps * 0.25);
  const tagOpacity = interpolate(frame, [tagStart, tagStart + Math.round(fps * 0.4)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tagY = interpolate(frame, [tagStart, tagStart + Math.round(fps * 0.4)], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Whole-card crossfade into the first scene over the final `crossfade` frames.
  const cardOpacity = interpolate(
    frame,
    [durationInFrames, durationInFrames + crossfade],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ opacity: cardOpacity }}>
      {/* Base brand color plus a subtle diagonal gradient for depth. */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, ${primary} 0%, ${shade(primary)} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          fontFamily: font,
          padding: "0 8%",
        }}
      >
        {logoSrc ? (
          <Img
            src={logoSrc}
            style={{
              width: 96,
              height: 96,
              objectFit: "contain",
              marginBottom: 28,
              opacity: logoSpring,
              transform: `scale(${0.85 + logoSpring * 0.15})`,
            }}
          />
        ) : null}
        <div
          style={{
            color: "#ffffff",
            fontSize: 76,
            fontWeight: 800,
            letterSpacing: -1,
            opacity: nameOpacity,
            transform: `translateY(${nameY}px)`,
          }}
        >
          {appName}
        </div>
        <div
          style={{
            color: accent,
            fontSize: 30,
            fontWeight: 500,
            marginTop: 20,
            maxWidth: 900,
            opacity: tagOpacity,
            transform: `translateY(${tagY}px)`,
          }}
        >
          {tagline}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Darken a hex color a touch for the gradient's far stop. Falls back to the
 * input for non-hex values so custom CSS colors still render. */
function shade(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - 24);
  const g = Math.max(0, ((n >> 8) & 0xff) - 24);
  const b = Math.max(0, (n & 0xff) - 24);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
