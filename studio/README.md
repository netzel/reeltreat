# reeltreat Studio (web UI)

A local web front end for the reeltreat pipeline — a browser-based control panel
for the same `capture → curate → render` flow the CLI runs, plus cropping and
manual-shot upload. Built with Vite + React + TypeScript, it runs entirely on your
machine (no deploy target, matching the project's local-first design).

## Run it

From the **repo root** (one command starts the bridge + UI together):

```sh
npm install && npm --prefix studio install   # first time only
npm run studio                                # opens http://localhost:5175
```

`npm run studio` launches the local **bridge** (`../src/bridge/server.ts`, port 5179)
and this Vite dev server (port 5175) together, and stops both on Ctrl-C. Vite proxies
`/api` and `/media` to the bridge, so the browser makes same-origin requests. Prefer
separate terminals? `npm run bridge` (root) and `npm run dev` (here) do the same.

Other scripts here: `npm run build`, `npm run preview`, `npm run typecheck`, `npm test`.

## How it talks to the pipeline

The browser can't run Playwright, call Anthropic, or invoke Remotion directly, so
those actions go through the **bridge** (`../src/bridge/server.ts` + `service.ts`),
which calls the very same `../src/*` functions the CLI uses and streams progress back
as NDJSON. `src/api.ts` is the typed client for it.

| Studio action        | Bridge → pipeline call        | CLI equivalent      |
| -------------------- | ----------------------------- | ------------------- |
| Detect / New project | `svc.detectTarget` / `createProject` | `npm run init`  |
| Authenticate         | `svc.startLogin`              | `npm run login`     |
| Capture              | `svc.runCapture`              | `npm run capture`   |
| Crop                 | `svc.setCrop` / `clearCrop` (edit.json) | — (Studio only) |
| Curate + edits       | `svc.runCurate` / `saveCuration` | `npm run curate` |
| Export / render      | `svc.runRender`               | `npm run render`    |

Crops are non-destructive: a normalized rectangle per shot in the project's
`edit.json`, applied by the renderer (`../src/render.ts`) — the captured screenshots
are never altered.

## Structure

```
src/
  main.tsx            entry
  App.tsx             shell: sidebar + top bar + step nav + active screen
  theme.css           design tokens / reset / keyframes
  store.tsx           app state + actions (React context)
  workflow.ts         pure step/title model (unit-tested)
  curation.ts         pure curation edit model (unit-tested)
  crop.ts             pure crop math (unit-tested)
  api.ts              bridge client (fetch + NDJSON streaming)
  types.ts            shared unions + Rect / Edit
  ui.ts               small style helpers
  components/         Sidebar, TopBar, StepNav, CropModal
  screens/            one file per screen (Projects, Target, Manifest, Auth,
                      Capture, Curate, Frame, Preview)
```

Icons in `public/` are generated from `../brand/reeltreat-logo.png`.
