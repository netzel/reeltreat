# reeltreat

Every project deserves a trailer. reeltreat turns your web apps into crisp, branded demo videos — any length, zero editing. Point it at a local or deployed app, it logs in with saved Playwright auth state, captures screenshots per a project manifest, uses one Claude API call to curate shots and write a tagline, and renders branded demo videos with Remotion.

## Public repo rules
- This repo is PUBLIC. Never commit anything specific to the author: no personal project names, employer references, real URLs, emails, or credentials in code, comments, commits, examples, or docs.
- Example manifests and docs use placeholder names (myapp, example.com).
- Commit messages: conventional commits, generic descriptions of the change.
- auth/, out/, and .env are gitignored and must stay that way — user assets never ship.

## Stack
- Node 20 + TypeScript, local CLI (no server, no database, no deploy target)
- Playwright — capture layer. Auth via saved storageState in auth/<project>.json (gitignored). One-time headed login flow per project.
- Remotion 4 — render layer. Video = React compositions: TitleCard, ShotSequence (Ken Burns pan/zoom, crossfades, animated callouts). renderStill for poster.png.
- @anthropic-ai/sdk — single curation call per capture run: screenshots in, JSON out (hero shot, ordered shot list per duration, per-shot seconds, callout labels + regions, tagline). Cached to out/<project>/curation.json.
- Vitest — tests baked into every slice.

## Key architecture decisions
- Stills-based v1. No live interaction recordings — motion comes from camera moves and overlays, not screen capture. Interaction clips are a possible v2.
- Per-project manifest in projects/<name>.yaml: base URL, routes + optional pre-shot actions, viewport, brand tokens (logo path, colors, font).
- Outputs to out/<project>/ (screenshots/, curation.json, demo-<N>s.mp4, poster.png).
- Curation JSON is cached; re-renders never re-call the LLM unless screenshots change.
- Evals live in evals/, checked in.
