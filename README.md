# reeltreat

Every project deserves a trailer. reeltreat turns your web apps into crisp, branded demo videos — any length, zero editing.

Point it at any web app (local or deployed). reeltreat logs in with your saved session, captures screenshots of the screens you choose, has AI curate the best shots and write a tagline, then renders a polished, branded demo video at whatever duration you want — 5 seconds, 15, 45 — complete with an animated title card and a hero poster frame.

## How it works
1. **Capture** — Playwright visits the routes in your project manifest and screenshots each screen, authenticated as you.
2. **Curate** — one Claude API call ranks the shots, picks the hero frame, writes callout labels and a tagline.
3. **Render** — Remotion composes a branded video: animated title card, Ken Burns motion over your screens, crossfades, callouts, and a poster image.

## Usage

```sh
npm run login   -- myapp   # one-time: log in, session is saved to auth/myapp.json
npm run capture -- myapp   # screenshot every shot in projects/myapp.yaml
npm run curate  -- myapp   # AI-curate the shots (add --force to re-run)
```

Copy `projects/example.yaml` to `projects/<your-project>.yaml` and edit it first.
The curated result is cached to `out/<your-project>/curation.json`; re-running
`curate` reuses the cache unless the screenshots or manifest change (or you pass
`--force`).

## Configuration

Curation needs an Anthropic API key. Provide it either way:

```sh
export ANTHROPIC_API_KEY=sk-ant-...        # in your shell
# or put it in a .env file (see .env.example) and run with Node's built-in loader:
node --env-file=.env node_modules/.bin/tsx src/curate.ts myapp
```

## Status
Early development. See BACKLOG.md for the roadmap.

## License
MIT
