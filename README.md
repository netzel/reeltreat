# reeltreat

Every project deserves a trailer. reeltreat turns your web apps into crisp, branded demo videos — any length, zero editing.

Point it at any web app (local or deployed). reeltreat logs in with your saved session, captures screenshots of the screens you choose, has AI curate the best shots and write a tagline, then renders a polished, branded demo video at whatever duration you want — 5 seconds, 15, 45 — complete with an animated title card and a hero poster frame.

## How it works
1. **Init** — point reeltreat at a local app repo; it detects the framework, discovers routes, extracts brand colors, and writes a ready-to-run project manifest for you.
2. **Capture** — Playwright visits the routes in your manifest and screenshots each screen, authenticated as you.
3. **Curate** — one Claude API call ranks the shots, picks the hero frame, writes callout labels and a tagline.
4. **Render** — Remotion composes a branded video: animated title card, Ken Burns motion over your screens, crossfades, callouts, and a poster image.

## Usage

```sh
npm run init    -- myapp --repo ../myapp   # generate projects/myapp.yaml from a local repo
npm run login   -- myapp   # one-time: log in, session is saved to auth/myapp.json
npm run capture -- myapp   # screenshot every shot in projects/myapp.yaml
npm run curate  -- myapp   # AI-curate the shots (add --force to re-run)
```

### Generating a manifest

`init` introspects a local app repo and writes `projects/<project>.yaml` with
routes, captions, and brand colors already filled in:

```sh
npm run init -- myapp --repo ../myapp [--base-url http://localhost:3000] [--force]
```

It supports Next.js (App and Pages Router), SvelteKit, and Vite + React. The
generated file opens with a short TODO checklist for the one or two things it
can't know — typically the base URL and any dynamic routes (like `/blog/[slug]`),
which are emitted commented-out for you to fill an id into. `login`, `capture`,
and `curate` refuse to run until those placeholders are resolved, and tell you
exactly which lines to fix.

If your framework isn't supported, hand-write the manifest instead: copy
`projects/example.yaml` to `projects/<your-project>.yaml` and edit it.

The curated result is cached to `out/<your-project>/curation.json`; re-running
`curate` reuses the cache unless the screenshots or manifest change (or you pass
`--force`).

## Configuration

`init` (for caption generation) and `curate` both need an Anthropic API key.
Supply it either way — reeltreat picks it up automatically:

- Put it in a `.env` file at the repo root (copy `.env.example`):

  ```sh
  ANTHROPIC_API_KEY=sk-ant-...
  ```

- Or export it as an environment variable:

  ```sh
  export ANTHROPIC_API_KEY=sk-ant-...
  ```

The repo-root `.env` is loaded on startup, so `npm run init -- ...` and
`npm run curate -- myapp` just work with no extra flags.

## Status
Early development. See BACKLOG.md for the roadmap.

## License
MIT
