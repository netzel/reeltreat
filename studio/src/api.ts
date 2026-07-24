// reeltreat Studio — bridge client.
//
// Talks to the local bridge server (src/bridge/server.ts) that invokes the
// reeltreat CLI. In dev, Vite proxies /api and /media to the bridge (see
// vite.config.ts), so these are same-origin relative fetches. Long-running
// steps (capture, render) stream NDJSON progress lines; the rest are plain JSON.

import type { Curation } from "./curation";

export type ProjectStatus = "Draft" | "Captured" | "Curated" | "Rendered";

export interface ProjectInfo {
  name: string;
  displayName: string;
  baseUrl: string;
  status: ProjectStatus;
  shots: number;
  primaryColor?: string;
  accentColor?: string;
  hasAuth: boolean;
  ready: boolean;
}

export interface ShotInfo {
  id: string;
  caption: string;
  kind: "browser" | "manual";
  index: number;
  file: string;
  captured: boolean;
}

export interface ProjectDetail {
  info: ProjectInfo;
  shots: ShotInfo[];
  curation: Curation | null;
}

export interface DetectResult {
  framework: string;
  routes: number;
  brand: { primaryColor?: string; accentColor?: string; font?: string };
}

export interface ShotProgress {
  id: string;
  index: number;
  kind: "browser" | "manual";
  status: "captured" | "warning" | "failed";
}

export interface CaptureSummary {
  captured: number;
  warnings: number;
  failed: number;
  browserLaunched: boolean;
  shots: { id: string; kind: "browser" | "manual" }[];
}

export interface RenderProgress {
  phase: "bundle" | "render" | "poster" | "done";
  tier?: number;
  frames?: number;
  progress?: number;
}

export interface RenderOutput {
  kind: "video" | "poster";
  tier?: number;
  relPath: string;
  bytes: number;
}

export interface RenderSummary {
  runId: string;
  tiers: number[];
  outputs: RenderOutput[];
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

function getJson<T>(path: string): Promise<T> {
  return fetch(path).then((r) => unwrap<T>(r));
}

function sendJson<T>(path: string, method: "POST" | "PUT", body: unknown): Promise<T> {
  return fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }).then((r) => unwrap<T>(r));
}

/**
 * POST a request whose response is a stream of NDJSON events. Each
 * `{type:"progress", ...}` line is forwarded to `onEvent`; a `{type:"done"}`
 * line carries the final summary; a `{type:"error"}` line rejects.
 */
async function stream<Progress, Summary>(
  path: string,
  body: unknown,
  onEvent: (p: Progress) => void,
): Promise<Summary> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok || !res.body) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let summary: Summary | undefined;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const evt = JSON.parse(line) as { type: string; message?: string; summary?: Summary };
      if (evt.type === "error") throw new Error(evt.message ?? "stream error");
      if (evt.type === "done") summary = evt.summary;
      else onEvent(evt as unknown as Progress);
    }
  }
  if (summary === undefined) throw new Error("stream ended without a result");
  return summary;
}

/** URL for a project media file, served by the bridge (Vite-proxied in dev). */
export function mediaUrl(project: string, dir: "captures" | "curated" | "renders" | "manual", file: string): string {
  return `/media/${encodeURIComponent(project)}/${dir}/${file}`;
}

export const api = {
  listProjects: () => getJson<{ projects: ProjectInfo[] }>("/api/projects").then((r) => r.projects),

  detectTarget: (input: { repoPath: string }) =>
    sendJson<DetectResult>("/api/detect", "POST", input),

  createProject: (input: { name: string; repoPath: string; baseUrl?: string; force?: boolean }) =>
    sendJson<{ ok: true; manifestPath: string }>("/api/projects", "POST", input),

  getProject: (name: string) => getJson<ProjectDetail>(`/api/projects/${encodeURIComponent(name)}`),

  getManifest: (name: string) =>
    getJson<{ text: string }>(`/api/projects/${encodeURIComponent(name)}/manifest`).then((r) => r.text),

  saveManifest: (name: string, text: string) =>
    sendJson<{ ok: true }>(`/api/projects/${encodeURIComponent(name)}/manifest`, "PUT", { text }),

  getCuration: (name: string) =>
    getJson<{ curation: Curation | null }>(`/api/projects/${encodeURIComponent(name)}/curation`).then(
      (r) => r.curation,
    ),

  saveCuration: (name: string, curation: Curation) =>
    sendJson<{ ok: true }>(`/api/projects/${encodeURIComponent(name)}/curation`, "PUT", { curation }),

  runCurate: (name: string, force = false) =>
    sendJson<{ cached: boolean; curation: Curation; curatedCount: number }>(
      `/api/projects/${encodeURIComponent(name)}/curate`,
      "POST",
      { force },
    ),

  login: (name: string, mode: "stealth" | "attach") =>
    sendJson<{ started: true }>(`/api/projects/${encodeURIComponent(name)}/login`, "POST", { mode }),

  confirmLogin: (name: string) =>
    sendJson<{ savedTo: string }>(`/api/projects/${encodeURIComponent(name)}/login/confirm`, "POST", {}),

  runCapture: (name: string, onEvent: (p: ShotProgress) => void) =>
    stream<ShotProgress, CaptureSummary>(`/api/projects/${encodeURIComponent(name)}/capture`, {}, onEvent),

  runRender: (
    name: string,
    opts: { duration?: number; all?: boolean; fps?: number },
    onEvent: (p: RenderProgress) => void,
  ) => stream<RenderProgress, RenderSummary>(`/api/projects/${encodeURIComponent(name)}/render`, opts, onEvent),
};
