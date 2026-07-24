# reeltreat web icons

Generated from `brand/reeltreat-logo.png`. Drop these into your site and paste the
`<head>` snippet below. Covers browser tabs, bookmarks, iOS/iPadOS "Add to Home
Screen", and Android/PWA install icons.

## Files

| File | Size | Purpose |
| --- | --- | --- |
| `favicon.ico` | 16/32/48 | Browser tabs, bookmarks, legacy fallback |
| `favicon-16x16.png` | 16 | Tab (hi-dpi hint) |
| `favicon-32x32.png` | 32 | Tab / taskbar |
| `favicon-48x48.png` | 48 | Windows / bookmarks |
| `apple-touch-icon.png` | 180 | iPhone / iPad home screen (opaque, corners filled) |
| `icon-192.png` | 192 | Android / PWA |
| `icon-512.png` | 512 | Android splash / PWA / maskable |
| `site.webmanifest` | — | PWA metadata referencing the 192/512 icons |

## Where to put them

Copy every file into your site's **web root** — the folder served at `/`.

- Static site / plain HTML: the root directory (next to `index.html`).
- Next.js / Vite / SvelteKit / CRA: the `public/` folder.
- Astro: the `public/` folder.

The links below use root-relative paths (`/favicon.ico`), so this placement makes
them resolve correctly. Browsers also auto-request `/favicon.ico` even without a
tag, so keeping it at the root is what makes bookmarks and tabs "just work."

## Paste into `<head>`

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0f214f">
```

## Regenerating

If the source logo changes, re-run the generator (it uses `sharp`, already a
project dependency). The script that produced these lived at the repo root as
`gen-icons.mjs`; re-create it from `brand/reeltreat-logo.png` if you need to
rebuild. `theme_color`/`background_color` in the manifest and the `theme-color`
meta are sampled from the logo's corner background (`#0f214f`).
