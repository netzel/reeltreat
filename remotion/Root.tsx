import React from "react";
import { Composition } from "remotion";
import { Reel } from "./Reel";
import { Poster } from "./Poster";
import { CROSSFADE_FRAMES, type PosterProps, type ReelProps } from "./types";

/**
 * The two compositions. Both take their real content via inputProps and use
 * calculateMetadata to derive dimensions/fps/duration from those props (see
 * /docs/calculate-metadata) — the returned fields override the placeholder props
 * on <Composition>. The placeholders below only make the Studio load with
 * something neutral; the render CLI always passes full inputProps.
 */

const reelDefaults: ReelProps = {
  fps: 30,
  width: 1280,
  height: 720,
  titleCard: {
    appName: "reeltreat",
    tagline: "Every project deserves a trailer.",
    brand: {},
    durationInFrames: 36,
    crossfade: CROSSFADE_FRAMES,
  },
  scenes: [],
};

const posterDefaults: PosterProps = {
  fps: 30,
  width: 1280,
  height: 720,
  appName: "reeltreat",
  tagline: "Every project deserves a trailer.",
  brand: {},
  src: "",
};

/** Reel duration = title card frames + the sum of every scene's frames. */
function reelDuration(props: ReelProps): number {
  return (
    props.titleCard.durationInFrames +
    props.scenes.reduce((a, s) => a + s.durationInFrames, 0)
  );
}

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Reel"
        component={Reel}
        durationInFrames={reelDuration(reelDefaults)}
        fps={reelDefaults.fps}
        width={reelDefaults.width}
        height={reelDefaults.height}
        defaultProps={reelDefaults}
        calculateMetadata={({ props }) => ({
          width: props.width,
          height: props.height,
          fps: props.fps,
          durationInFrames: reelDuration(props),
        })}
      />
      <Composition
        id="Poster"
        component={Poster}
        durationInFrames={1}
        fps={posterDefaults.fps}
        width={posterDefaults.width}
        height={posterDefaults.height}
        defaultProps={posterDefaults}
        calculateMetadata={({ props }) => ({
          width: props.width,
          height: props.height,
          fps: props.fps,
          durationInFrames: 1,
        })}
      />
    </>
  );
};
