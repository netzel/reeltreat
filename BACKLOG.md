# BACKLOG.md — open work. Items get marked done with their commit SHA when shipped.

## Open
- Slice 4: CLI wrapper (capture / curate / render --duration N)
- v2 candidate: Playwright interaction recordings for motion-heavy features

## Done
- Manual image normalization — manual shots are scaled to the manifest viewport (fit: cover center-crops, contain pads with a background color), image-only `fit`/`background` schema fields rejected on browser shots, per-shot source/output/fit logging with an aspect-mismatch warning, and a render-time guard that every screenshot matches the viewport before building the reel
- Slice 3: Remotion render layer — pure frame-accurate reel model (title card + capped/floored/renormalized Ken Burns scenes), TitleCard/Scene/Reel/Poster compositions with crossfades and callouts, and `render` CLI producing demo-<N>s.mp4 per tier (--duration/--all/--fps) plus poster.png. Screenshots embedded as data URIs; render layer isolated under remotion/ with its own bundler tsconfig
- Slice 1: manifest schema + Playwright login/capture commands — 410e196
- Slice 2: curation call + cached curation.json — f69c559
- Slice 2.5: init command generates a manifest by introspecting a local repo (framework-aware route discovery, brand extraction, AI captions, doctor pre-flight check) — ee8c304
- Slice 2.6: manual image shots — supply your own screenshot (image: <path>) for states automation cannot reach (real hardware input, live audio, human in the loop); schema enforces path xor image, browser-only fields rejected, image-only manifests skip the browser — 92d10ee
