// Placeholder data mirroring the UI prototype. This stands in for what a local
// bridge to the reeltreat CLI will eventually return (project list, capture
// results, curation.json). Everything here is display-only sample content.

import type { ProjectStatus, ShotKind, ShotStatus, Tier } from "../types";

export interface Project {
  name: string;
  url: string;
  status: ProjectStatus;
  shots: number;
  updated: string;
  c1: string;
  c2: string;
  unsaved: boolean;
}

export const PROJECTS: Project[] = [
  { name: "myapp", url: "https://myapp.example.com", status: "Curated", shots: 8, updated: "2m ago", c1: "#6D5EF6", c2: "#22D3AA", unsaved: true },
  { name: "docs-site", url: "https://docs.acme.dev", status: "Rendered", shots: 5, updated: "yesterday", c1: "#0EA5E9", c2: "#6366F1", unsaved: false },
  { name: "pay-flow", url: "https://pay.internal.test", status: "Captured", shots: 6, updated: "3 days ago", c1: "#F43F5E", c2: "#FB923C", unsaved: false },
  { name: "launchpad", url: "http://localhost:3000", status: "Draft", shots: 0, updated: "1 week ago", c1: "#10B981", c2: "#84CC16", unsaved: false },
];

/** CSS variable name for each project status pill. */
export const STATUS_COLOR: Record<ProjectStatus, string> = {
  Draft: "--text-faint",
  Captured: "--info",
  Curated: "--ai",
  Rendered: "--success",
};

export interface Shot {
  n: number;
  id: string;
  caption: string;
  kind: ShotKind;
  status: ShotStatus;
}

export const SHOTS: Shot[] = [
  { n: 1, id: "dashboard", caption: "Your whole workspace at a glance", kind: "browser", status: "captured" },
  { n: 2, id: "projects", caption: "Every project in one board", kind: "browser", status: "captured" },
  { n: 3, id: "editor", caption: "Write and ship without leaving the app", kind: "browser", status: "captured" },
  { n: 4, id: "analytics", caption: "See what's working, instantly", kind: "browser", status: "warning" },
  { n: 5, id: "settings", caption: "Fine-tune everything in one place", kind: "browser", status: "captured" },
  { n: 6, id: "integrations", caption: "Connect the tools you already use", kind: "browser", status: "captured" },
  { n: 7, id: "billing", caption: "Simple, transparent pricing", kind: "browser", status: "captured" },
  { n: 8, id: "live-transcription", caption: "Real-time transcription as you speak", kind: "manual", status: "manual" },
];

/** [cssVar, label] per shot status, for the corner badges. */
export const SHOT_STATUS: Record<ShotStatus, [string, string]> = {
  captured: ["--success", "captured"],
  warning: ["--warning", "warning"],
  failed: ["--danger", "failed"],
  manual: ["--ai", "manual"],
};

export interface Clip {
  id: string;
  label: string;
  dur: number;
  ai: boolean;
}

export const CLIPS: Clip[] = [
  { id: "dashboard", label: "Command center", dur: 3.5, ai: false },
  { id: "editor", label: "Write & ship", dur: 3, ai: false },
  { id: "analytics", label: "Instant insight", dur: 3, ai: false },
  { id: "live-transcription", label: "Live captions", dur: 4, ai: true },
  { id: "integrations", label: "Plug in anything", dur: 2, ai: false },
  { id: "projects", label: "Organized", dur: 2, ai: false },
];

export interface RankedShot {
  r: number;
  id: string;
  callout: string;
  reason: string;
}

export const RANKED: RankedShot[] = [
  { r: 1, id: "dashboard", callout: "Command center", reason: "Strongest first impression — shows the whole product" },
  { r: 2, id: "editor", callout: "Write & ship", reason: "Core action users care about most" },
  { r: 3, id: "analytics", callout: "Instant insight", reason: "Proof the product delivers outcomes" },
  { r: 4, id: "integrations", callout: "Plug in anything", reason: "Signals it fits an existing stack" },
  { r: 5, id: "projects", callout: "Organized by default", reason: "Reinforces the workspace metaphor" },
  { r: 6, id: "settings", callout: "Total control", reason: "Depth for power users, kept brief" },
];

export interface Override {
  label: string;
  detail: string;
}

export const OVERRIDES: Override[] = [
  { label: "Tagline rewritten", detail: '"Your product’s trailer…"' },
  { label: "1 crop", detail: "dashboard · top 80%" },
  { label: "1 insert", detail: "live-transcription after analytics" },
  { label: "1 exclusion", detail: "billing removed from cut" },
];

/** Ordered cut per duration tier: [shotId, seconds]. */
const TIER_CUTS: Record<Tier, Array<[string, number]>> = {
  "5": [["dashboard", 2.5], ["editor", 2.5]],
  "15": [["dashboard", 3], ["editor", 3], ["analytics", 3], ["integrations", 3], ["projects", 3]],
  "30": [["dashboard", 5], ["editor", 5], ["analytics", 5], ["integrations", 5], ["projects", 5], ["settings", 5]],
  "45": [["dashboard", 6], ["editor", 6], ["analytics", 6], ["integrations", 6], ["projects", 6], ["settings", 6], ["billing", 9]],
};

export function tierCuts(tier: Tier): Array<{ id: string; sec: number }> {
  return TIER_CUTS[tier].map(([id, sec]) => ({ id, sec }));
}

export interface LogLine {
  t: string;
  msg: string;
  color: string;
}

export const CAPTURE_LOG: LogLine[] = [
  { t: "0.0s", msg: "launching Chrome (stealth) — session auth/myapp.json", color: "--text-muted" },
  { t: "1.2s", msg: "dashboard ✓ 1.2s", color: "--success" },
  { t: "2.5s", msg: "projects ✓ 1.3s", color: "--success" },
  { t: "3.9s", msg: "editor ✓ 1.4s", color: "--success" },
  { t: "33.9s", msg: "analytics ⚠ nav wait exceeded 30s — captured as-is", color: "--warning" },
  { t: "35.1s", msg: "settings ✓ 1.2s", color: "--success" },
  { t: "36.3s", msg: "integrations ✓ 1.2s", color: "--success" },
  { t: "37.6s", msg: "billing ✓ 1.3s", color: "--success" },
  { t: "37.7s", msg: "live-transcription ✓ manual image", color: "--ai" },
  { t: "37.8s", msg: "done — 7 captured · 1 warning · 0 failed", color: "--text" },
];
