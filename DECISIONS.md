# DECISIONS.md — append-only architectural log, newest-first
Format: ## YYYY-MM-DD — Title, then a short entry. Never edit past entries.

## 2026-07-21 — Initial architecture: Playwright + Claude curation + Remotion
Stills-based pipeline chosen over screen recording: deterministic, testable, and better-looking output. Playwright handles authenticated capture via saved storage state; Remotion chosen because video-as-React keeps the whole tool in one TypeScript stack. One cached Claude vision call handles shot selection, callout labels, and tagline — everything else is deterministic. No database or hosting: pure local CLI. User assets (out/, auth/) are gitignored; the tool itself is public.
