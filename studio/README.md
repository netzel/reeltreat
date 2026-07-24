# reeltreat Studio (web UI)

A local web front end for the reeltreat pipeline — a browser-based control panel
for the same `capture → curate → render` flow the CLI runs. Built with Vite +
React + TypeScript, it runs entirely on your machine (no deploy target, matching
the project's local-first design).

## Run it

```sh
cd studio
npm install
npm run dev        # opens http://localhost:5175
```

Other scripts: `npm run build`, `npm run preview`, `npm run typecheck`, `npm test`.

## What's real vs. placeholder

The UI is complete and navigable — all eight screens (Projects, New Project,
Manifest & Shots, Authenticate, Capture, Curate, Frame Editor, Preview & Export)
plus the Crop and Manual-photo panels, dark/light themes, and the step workflow.

The **backend is stubbed**. The browser can't run Playwright, call Anthropic, or
shell out to Remotion directly, so those actions live in `src/api.ts` as
placeholder async calls that resolve with the sample data in `src/data/mock.ts`.
Each stub is annotated with the CLI verb it will eventually drive:

| Studio action        | Pipeline call         | CLI equivalent      |
| -------------------- | --------------------- | ------------------- |
| Detect / New project | `api.detectTarget`    | `npm run init`      |
| Authenticate         | `api.openAuth`        | `npm run login`     |
| Capture              | `api.runCapture`      | `npm run capture`   |
| Curate               | `api.runCurate`       | `npm run curate`    |
| Export / render      | `api.runRender`       | `npm run render`    |

Wiring these up means adding a small local bridge server (see `BRIDGE_URL` in
`src/api.ts`) that invokes the existing `../src/*.ts` CLI entry points and streams
progress back to the UI. That server does not exist yet — it's the "fill in later"
part of the current spec. Replace the stub bodies (not their signatures) when it
lands.

## Structure

```
src/
  main.tsx            entry
  App.tsx             shell: sidebar + top bar + step nav + active screen
  theme.css           design tokens / reset / keyframes (ported from the prototype)
  store.tsx           app state + actions (React context)
  workflow.ts         pure step/title model (unit-tested)
  api.ts              PLACEHOLDER backend client
  types.ts            shared unions
  ui.ts               small style helpers
  data/mock.ts        sample projects / shots / clips / curation
  components/         Sidebar, TopBar, StepNav
  screens/            one file per screen
  modals/             CropModal, ManualModal
```

Design source: `../devresources/Reeltreat Studio UI prototype/`. Icons in
`public/` are generated from `../brand/reeltreat-logo.png`.
