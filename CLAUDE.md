# reeltreat

Every project deserves a trailer. reeltreat turns your web apps into crisp, branded demo videos — any length, zero editing. Point it at a local or deployed app, it logs in with saved Playwright auth state, captures screenshots per a project manifest, uses one Claude API call to curate shots and write a tagline, and renders branded demo videos with Remotion.

## Public repo rules
- This repo is PUBLIC. Never commit anything specific to the author: no personal project names, employer references, real URLs, emails, or credentials in code, comments, commits, examples, or docs.
- Example manifests and docs use placeholder names (myapp, example.com).
- Commit messages: conventional commits, generic descriptions of the change.
- auth/, projects/* (except projects/example/), and .env are gitignored and must stay that way — user assets never ship.

## Stack
- Node 20 + TypeScript, local CLI. An optional local web UI (studio/) drives the same pipeline via a localhost bridge (src/bridge/) — no hosted server, no database, no deploy target.
- Playwright — capture layer. Auth via saved storageState in auth/<project>.json (gitignored). One-time headed login flow per project.
- Remotion 4 — render layer. Video = React compositions: TitleCard, ShotSequence (Ken Burns pan/zoom, crossfades, animated callouts). renderStill for poster.png.
- @anthropic-ai/sdk — single curation call per capture run: screenshots in, JSON out (hero shot, ordered shot list per duration, per-shot seconds, callout labels + regions, tagline). Cached to projects/<project>/curation.json.
- Vitest — tests baked into every slice.

## Key architecture decisions
- Stills-based v1. No live interaction recordings — motion comes from camera moves and overlays, not screen capture. Interaction clips are a possible v2.
- One folder per project: projects/<name>/ holds everything — manifest.yaml, manual/ (hand-taken source shots), captures/ (browser + normalized manual shots, NN-<id>.png), curated/ (the shots curation picked, in video order), curation.json, and renders/ (demo-<N>s.mp4 + poster.png). src/paths.ts is the single source of truth for this layout.
- Manifest-relative asset paths (a shot's image, brand logoPath) resolve against the project folder, keeping a project self-contained. Auth stays outside, under auth/<project>.json (a credential, not an asset).
- Manual and browser shots converge at capture time: both are written into captures/ with identical naming and viewport, so curation and render are agnostic to a shot's source.
- Curation JSON is cached; re-renders never re-call the LLM unless screenshots change.
- Each render writes to renders/<runId>/ (timestamped) so no render overwrites a previous one. render.ts exports renderProject(); REMOTION_BROWSER_EXECUTABLE overrides the browser for offline/locked-down environments.
- Studio web UI: studio/ (React/Vite) is a thin client; src/bridge/ (server.ts + service.ts) wraps the same src/* pipeline functions the CLI uses and serves project media over localhost. UI edits (shot order, callouts, tagline) are validated and written back to curation.json, so render picks them up. Curation-edit logic is pure in studio/src/curation.ts.
- Evals live in evals/, checked in.
