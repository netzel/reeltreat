// Shared types for reeltreat Studio.

export type Screen =
  | "projects"
  | "target"
  | "manifest"
  | "auth"
  | "capture"
  | "curate"
  | "frame"
  | "preview";

export type Theme = "dark" | "light";
export type Tier = "5" | "15" | "30" | "45";

export type ConnectMode = "repo" | "blank";
export type AuthMode = "stealth" | "attach";
export type AuthStep = "idle" | "opening" | "active" | "success" | "error";
export type CaptureState = "empty" | "done";
export type ExportState = "idle" | "rendering" | "done";

export type ShotStatus = "captured" | "warning" | "failed" | "manual";
export type ShotKind = "browser" | "manual";
export type ProjectStatus = "Draft" | "Captured" | "Curated" | "Rendered";
