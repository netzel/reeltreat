import React from "react";
import { AbsoluteFill, Img } from "remotion";
import type { PosterProps } from "./types";
import { accentColor, fontFamily, primaryColor } from "./theme";

/**
 * The hero poster still (rendered via renderStill): the hero screenshot behind a
 * darkening overlay, with the app name, tagline, and optional logo. Static — it
 * is captured at a single frame, so it uses no time-based animation.
 */
export const Poster: React.FC<PosterProps> = ({
  appName,
  tagline,
  brand,
  src,
  logoSrc,
}) => {
  const primary = primaryColor(brand);
  const accent = accentColor(brand);
  const font = fontFamily(brand);

  return (
    <AbsoluteFill style={{ backgroundColor: primary }}>
      {src ? (
        <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : null}

      {/* Darken the screenshot so the title reads clearly on any image. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.8) 100%)",
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "flex-start",
          fontFamily: font,
          padding: "0 72px 72px",
        }}
      >
        {logoSrc ? (
          <Img
            src={logoSrc}
            style={{ width: 80, height: 80, objectFit: "contain", marginBottom: 24 }}
          />
        ) : null}
        <div
          style={{ color: "#ffffff", fontSize: 88, fontWeight: 800, letterSpacing: -1 }}
        >
          {appName}
        </div>
        <div
          style={{
            color: accent,
            fontSize: 34,
            fontWeight: 500,
            marginTop: 16,
            maxWidth: 1100,
          }}
        >
          {tagline}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
