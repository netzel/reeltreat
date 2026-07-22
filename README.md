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
npm run render  -- myapp   # render the branded video + poster (default 15s)
```

Everything lands under `out/<project>/`: `screenshots/`, `curation.json`,
one `demo-<N>s.mp4` per rendered duration, and `poster.png`.

### Logging in

`login` opens a browser, waits while you sign in to your app, then saves the
session to `auth/myapp.json`. `capture` reuses that saved session — both login
modes below produce the same file, so the rest of the pipeline is identical.

There are two modes, selected with `--mode` (default `stealth`):

```sh
npm run login -- myapp                 # stealth (default)
npm run login -- myapp --mode attach   # attach to your own Chrome
```

- **stealth** — drives your installed Google Chrome (via the `chrome` channel)
  from a per-project profile under `auth/profiles/<project>/`, with Playwright's
  automation fingerprint removed. Requires Google Chrome to be installed.
- **attach** — the fallback for when an identity provider still refuses to sign
  in on an automated browser (e.g. a "this browser may not be secure" message).
  You start your own everyday Chrome with remote debugging enabled, sign in
  there, and reeltreat attaches over CDP just to read the session — so from the
  provider's side it's an ordinary Chrome window. `login --mode attach` prints
  the exact command for your OS; in short, quit Chrome fully, then relaunch it
  with `--remote-debugging-port=9222` and sign in before pressing Enter. reeltreat
  never closes your browser.

  This is a normal user signing in to their own application — attach just avoids
  a session being rejected for looking automated.

### Capturing

Each shot navigates with `waitUntil` (default `load`) and a `timeoutMs`
(default 30000). If a shot sits on a page with a long-lived connection —
streaming media, polling, or websockets — set `waitUntil: domcontentloaded` and
lean on a `waitFor` selector or `delayMs` to time the shot; don't wait on the
network (`networkidle` never settles on such pages, and Playwright discourages
it). A navigation timeout no longer abandons a shot: if the page rendered,
capture screenshots it anyway and reports it as "captured with warnings" —
only shots that produced no page at all count as failures.

**Defaults for every shot.** A top-level `defaults` block sets capture options
once for all shots — handy for client-rendered apps, where a `delayMs` settle
keeps you from screenshotting loading skeletons:

```yaml
defaults:
  delayMs: 2000            # settle every shot before the screenshot
shots:
  - id: dashboard
    path: /dashboard
    caption: Overview      # inherits delayMs: 2000
  - id: report
    path: /report
    caption: Report
    delayMs: 0             # per-shot value wins over the default
```

It supports `waitUntil`, `timeoutMs`, `delayMs`, `waitFor`, and `fullPage`.
Resolution per field is: explicit per-shot value → manifest default → built-in
default. `init` generates a `defaults` block with `delayMs: 2000` so freshly
generated manifests work on typical client-rendered apps without hand editing.

**Stale-screenshot pruning.** Before capturing, any `.png` in
`out/<project>/screenshots/` that the current manifest no longer produces
(a renamed, reordered, or deleted shot) is removed and logged, so orphaned
frames never reach curation. When anything is pruned, the now-stale
`out/<project>/curation.json` is deleted too — re-run `curate` to regenerate it.

**Manual image shots.** Some states can't be reached by automation — anything
needing real hardware input (a live microphone or camera), live audio, or a
human in the loop. For those, take the screenshot yourself and point a shot at
it with `image` instead of `path`:

```yaml
shots:
  - id: dashboard
    path: /dashboard          # browser capture
    caption: Overview
  - id: live-transcription
    image: manual/myapp/live-transcription.png   # your own screenshot
    caption: Real-time transcription as you speak
```

A shot sets exactly one of `path` or `image`; browser-only settings
(`waitUntil`, `timeoutMs`, `waitFor`, `delayMs`, `fullPage`) aren't allowed on an
image shot. The file is resolved relative to the repo root (absolute paths work
too), converted to PNG if needed, and written into the screenshots directory
with the same `NN-<id>.png` naming as a captured shot — so curation and
rendering treat it identically. Keep these files under **`manual/<project>/`** at
the repo root; that folder is gitignored. If a manifest has only image shots,
`capture` runs without launching a browser or needing a saved login.

### Rendering

`render` builds the video from your captured screenshots and cached curation —
an animated title card, Ken Burns motion (subtle pan/zoom) over each screen with
crossfades and callout chips, plus a hero `poster.png`. All colors and fonts come
from your manifest's `brand` tokens, with neutral fallbacks when they're unset.

```sh
npm run render -- myapp                    # 15s reel + poster
npm run render -- myapp --duration 30      # a specific duration tier
npm run render -- myapp --all              # every tier in curation.json
npm run render -- myapp --duration 15 --fps 60
```

- `--duration N` picks the cut to render. Curation produces 5s, 15s, 30s, and
  45s cuts; the tier must exist in `out/<project>/curation.json` (run `curate`
  first). Default is 15.
- `--all` renders every tier present in the curation.
- `--fps N` sets the frame rate (default 30).

Outputs go to `out/<project>/`: `demo-<N>s.mp4` (h264) per tier and a single
`poster.png`. Each run prints the output paths, their sizes, and the total time.

Scene timing follows the curation's per-shot seconds, capped at 5s per scene
(any excess is redistributed) and floored at 1.2s (if a cut has more shots than
fit at that minimum, the lowest-ranked are dropped and logged). The title card
plus scenes always sum to exactly the requested duration.

To preview and tweak compositions interactively, open Remotion Studio:

```sh
npm run studio
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
