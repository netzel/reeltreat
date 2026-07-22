import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import type { ReelProps } from "./types";
import { CROSSFADE_FRAMES } from "./types";
import { TitleCard } from "./TitleCard";
import { Scene } from "./Scene";
import { primaryColor } from "./theme";

/**
 * The full reel: the title card, then each scene, laid out with a crossfade
 * overlap. Scenes are laid out back-to-back (their durations sum exactly to the
 * scene budget); the overlap is created by pulling each scene's mount point
 * `CROSSFADE_FRAMES` earlier — into the previous scene's tail — and extending its
 * Sequence by the same amount, so the LAST scene still ends exactly at
 * titleCard + Σ scene frames. That keeps the composition's total frame count
 * equal to durationSeconds * fps (calculateMetadata derives it the same way).
 */
export const Reel: React.FC<ReelProps> = ({ titleCard, scenes }) => {
  const background = primaryColor(titleCard.brand);

  // `base` tracks the nominal start of each scene (titleCard end + Σ prior d).
  let base = titleCard.durationInFrames;
  const sceneSequences = scenes.map((scene, i) => {
    const from = i === 0 ? titleCard.durationInFrames : base - CROSSFADE_FRAMES;
    const duration =
      i === 0 ? scene.durationInFrames : scene.durationInFrames + CROSSFADE_FRAMES;
    const node = (
      <Sequence key={i} from={from} durationInFrames={duration}>
        <Scene {...scene} />
      </Sequence>
    );
    base += scene.durationInFrames;
    return node;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      {/* Title card extended by the crossfade so it overlaps the first scene. */}
      <Sequence from={0} durationInFrames={titleCard.durationInFrames + CROSSFADE_FRAMES}>
        <TitleCard {...titleCard} />
      </Sequence>
      {sceneSequences}
    </AbsoluteFill>
  );
};
