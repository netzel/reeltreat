// @vitest-environment jsdom
import type { ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { Thumbnail } from "@remotion/player";
import { describe, expect, it } from "vitest";
import { TitleCard } from "../TitleCard";
import { Scene } from "../Scene";
import { Poster } from "../Poster";
import type { KenBurns } from "../types";

/**
 * Component smoke tests. The Remotion docs (/docs/testing) prescribe rendering a
 * composition component through <Thumbnail> (which supplies the Remotion React
 * contexts so hooks like useCurrentFrame/useVideoConfig work) and asserting on
 * the output of renderToString — rather than a bare @testing-library render,
 * which would leave those contexts undefined. `noSuspense` keeps the render
 * synchronous so the markup is available immediately.
 */

// 1x1 transparent PNG — enough for <Img> to have a valid src in the markup.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const kb: KenBurns = { fromScale: 1.0, toScale: 1.08, panX: -1, panY: 0 };

function renderAt(
  component: ComponentType<any>,
  inputProps: Record<string, unknown>,
  frameToDisplay: number,
): string {
  return renderToString(
    <Thumbnail
      component={component}
      compositionWidth={1280}
      compositionHeight={720}
      durationInFrames={120}
      fps={30}
      frameToDisplay={frameToDisplay}
      inputProps={inputProps}
      noSuspense
    />,
  );
}

describe("TitleCard", () => {
  const props = {
    appName: "Acme",
    tagline: "Ship demos in seconds",
    brand: {},
    durationInFrames: 100,
    crossfade: 10,
  };
  it.each([0, 30])("renders the app name and tagline at frame %i", (frame) => {
    const html = renderAt(TitleCard, props, frame);
    expect(html).toContain("Acme");
    expect(html).toContain("Ship demos in seconds");
  });
});

describe("Scene", () => {
  const props = {
    src: PNG,
    callout: "Live waveform",
    durationInFrames: 100,
    fadeInFrames: 10,
    kenBurns: kb,
    brand: {},
  };
  // Remotion's <Img> assigns `src` via a ref/effect to control load ordering, so
  // the data URI is not present in the static SSR markup — assert on the callout
  // text (and the <img> element's presence) instead.
  it.each([0, 20, 90])("renders the callout at frame %i", (frame) => {
    const html = renderAt(Scene, props, frame);
    expect(html).toContain("Live waveform");
    expect(html).toContain("<img");
  });
});

describe("Poster", () => {
  const props = {
    appName: "Acme",
    tagline: "Ship demos in seconds",
    brand: {},
    src: PNG,
    width: 1280,
    height: 720,
    fps: 30,
  };
  it("renders the app name, tagline, and hero image", () => {
    const html = renderAt(Poster, props, 0);
    expect(html).toContain("Acme");
    expect(html).toContain("Ship demos in seconds");
    expect(html).toContain("<img"); // hero screenshot element present
  });
});
