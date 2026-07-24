import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { parse as parseYaml, parseDocument, YAMLSeq } from "yaml";
import Anthropic from "@anthropic-ai/sdk";
import {
  loadManifest,
  ManifestSchema,
  isImageShot,
  type Manifest,
} from "../manifest.js";
import { checkManifestReady } from "../doctor.js";
import {
  captureProject,
  pruneStaleOutputs,
  screenshotFilename,
  type CaptureProjectOptions,
  type CaptureRunResult,
  type ShotProgress,
} from "../capture.js";
import {
  curateProject,
  loadShotImages,
  type CurateOptions,
  type CurateResult,
} from "../curate.js";
import { writeCuratedSet } from "../curated.js";
import { renderProject, type RenderOptions, type RenderResult } from "../render.js";
import { initProject } from "../init.js";
import { runLogin, type LoginMode, type RunLoginOptions } from "../login.js";
import { validateCuration, type CurationResult } from "../curation-schema.js";
import type { CaptionClient } from "../captions.js";
import { loadEnv } from "../env.js";
import {
  capturesDir,
  curatedDir,
  curationPath,
  manifestPath,
  manualDir,
  projectDir,
  rendersDir,
} from "../paths.js";

/**
 * src/bridge/service.ts — the pipeline the Studio drives, exposed as plain
 * functions the HTTP bridge (server.ts) wraps. Each wraps an existing CLI piece
 * (src/*), but returns structured results and throws typed errors instead of
 * writing to stdout or calling process.exit, so a browser can run the whole
 * capture → curate → edit → render flow. Heavy, side-effectful steps (capture,
 * curate, render, login) take an injectable runner with a real default, so the
 * orchestration is unit-testable with stubs.
 */

export type ProjectStatus = "Draft" | "Captured" | "Curated" | "Rendered";

export interface ProjectInfo {
  /** Folder name = CLI project name. */
  name: string;
  /** manifest `name` (display name on the title card). */
  displayName: string;
  baseUrl: string;
  status: ProjectStatus;
  shots: number;
  primaryColor?: string;
  accentColor?: string;
  /** A saved login session exists (auth/<name>.json). */
  hasAuth: boolean;
  /** Manifest parses and has no unresolved TODO placeholders. */
  ready: boolean;
}

export interface ShotInfo {
  id: string;
  caption: string;
  kind: "browser" | "manual";
  /** 1-based manifest position (drives the NN- capture filename). */
  index: number;
  /** Capture filename in captures/ (NN-<id>.png). */
  file: string;
  /** The capture exists on disk. */
  captured: boolean;
}

export interface ProjectDetail {
  info: ProjectInfo;
  /** Shots in manifest order, each with its capture filename + presence. */
  shots: ShotInfo[];
  /** Cached curation, or null if not curated yet. */
  curation: CurationResult | null;
}

/** The stored curation.json record shape (curation plus cache metadata). */
interface CurationRecord {
  cacheKey?: string;
  model?: string;
  generatedAt?: string;
  curation: CurationResult;
}

const AUTH_DIR = "auth";
function statePathFor(project: string): string {
  return resolve(AUTH_DIR, `${project}.json`);
}

/** True if any browser (path) shot exists — i.e. capture needs a login session. */
function needsAuth(manifest: Manifest): boolean {
  return manifest.shots.some((s) => !isImageShot(s));
}

/** Derive a coarse project status from which artifacts exist on disk. */
function deriveStatus(project: string): ProjectStatus {
  const renders = rendersDir(project);
  if (existsSync(renders) && readdirSync(renders).length > 0) return "Rendered";
  if (existsSync(curationPath(project))) return "Curated";
  const caps = capturesDir(project);
  if (existsSync(caps) && readdirSync(caps).some((n) => n.toLowerCase().endsWith(".png"))) {
    return "Captured";
  }
  return "Draft";
}

/** Read + validate a project's manifest into a ProjectInfo, best-effort. */
function readProjectInfo(project: string): ProjectInfo {
  const manifest = loadManifest(project); // throws if unparseable
  const text = readFileSync(manifestPath(project), "utf8");
  const ready = checkManifestReady(text).ready;
  return {
    name: project,
    displayName: manifest.name,
    baseUrl: manifest.baseUrl,
    status: deriveStatus(project),
    shots: manifest.shots.length,
    primaryColor: manifest.brand.primaryColor,
    accentColor: manifest.brand.accentColor,
    hasAuth: existsSync(statePathFor(project)),
    ready,
  };
}

/** List every project folder that holds a manifest.yaml, newest data first. */
export function listProjects(): ProjectInfo[] {
  const root = resolve("projects");
  if (!existsSync(root)) return [];
  const infos: ProjectInfo[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!existsSync(manifestPath(entry.name))) continue;
    try {
      infos.push(readProjectInfo(entry.name));
    } catch {
      // A malformed manifest shouldn't hide every other project.
      infos.push({
        name: entry.name,
        displayName: entry.name,
        baseUrl: "",
        status: "Draft",
        shots: 0,
        hasAuth: existsSync(statePathFor(entry.name)),
        ready: false,
      });
    }
  }
  return infos.sort((a, b) => a.name.localeCompare(b.name));
}

/** Read the raw manifest YAML text (for the manifest editor). */
export function getManifestText(project: string): string {
  const file = manifestPath(project);
  if (!existsSync(file)) throw new Error(`No manifest for project "${project}"`);
  return readFileSync(file, "utf8");
}

/**
 * Validate + write manifest YAML text. Rejects invalid YAML or a manifest that
 * fails the schema, so the editor never persists an unloadable file.
 */
export function saveManifestText(project: string, text: string): { ok: true } {
  let data: unknown;
  try {
    data = parseYaml(text);
  } catch (err) {
    throw new Error(`Invalid YAML: ${err instanceof Error ? err.message : String(err)}`);
  }
  const result = ManifestSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid manifest:\n${issues}`);
  }
  mkdirSync(projectDir(project), { recursive: true });
  writeFileSync(manifestPath(project), text);
  return { ok: true };
}

/** Allowed manual-image extensions — sharp normalizes these at capture time. */
const MANUAL_IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const SLUG_RE = /^[a-z0-9-]+$/;

export interface AddManualShotInput {
  /** Shot id — a unique slug (lowercase letters, numbers, hyphens). */
  id: string;
  caption: string;
  /** Original upload filename, used to name the stored file. */
  filename: string;
  /** Base64-encoded image bytes. */
  dataBase64: string;
}

export interface AddManualShotResult {
  ok: true;
  id: string;
  /** Manifest-relative image path written (manual/<file>). */
  image: string;
}

/**
 * Add a manual (image) shot: save the uploaded image into the project's manual/
 * folder and append a shot to the manifest pointing at it. The manifest is
 * edited through the YAML document API so existing comments and formatting are
 * preserved, and the result is re-validated before it's written, so an upload
 * can never produce an unloadable manifest. The image is stored as-is; capture
 * normalizes it to the viewport (and converts to PNG) like any manual shot.
 */
export function addManualShot(project: string, input: AddManualShotInput): AddManualShotResult {
  const file = manifestPath(project);
  if (!existsSync(file)) throw new Error(`No manifest for project "${project}"`);

  const id = input.id.trim();
  if (!SLUG_RE.test(id)) {
    throw new Error(`shot id "${id}" must be a slug (lowercase letters, numbers, hyphens)`);
  }
  const manifest = loadManifest(project);
  if (manifest.shots.some((s) => s.id === id)) {
    throw new Error(`shot id "${id}" already exists in the manifest`);
  }

  // Sanitize to a safe basename with an allowed image extension.
  const storedName = basename(input.filename).replace(/[^A-Za-z0-9._-]/g, "_");
  const ext = extname(storedName).toLowerCase();
  if (!MANUAL_IMAGE_EXTS.has(ext)) {
    throw new Error(`unsupported image type "${ext || "(none)"}" — use PNG, JPG, WEBP, or GIF`);
  }

  const bytes = Buffer.from(input.dataBase64, "base64");
  if (bytes.length === 0) throw new Error("empty image upload");

  const dir = manualDir(project);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, storedName), bytes);

  const image = `manual/${storedName}`;

  // Append the shot, preserving the manifest's comments/formatting.
  const doc = parseDocument(readFileSync(file, "utf8"));
  let shots = doc.get("shots");
  if (!(shots instanceof YAMLSeq)) {
    shots = new YAMLSeq();
    doc.set("shots", shots);
  }
  (shots as YAMLSeq).add({ id, image, caption: input.caption });
  const nextText = String(doc);

  // Re-validate before persisting, so a bad edit never lands on disk.
  const parsed = ManifestSchema.safeParse(parseYaml(nextText));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`adding the shot produced an invalid manifest:\n${issues}`);
  }
  writeFileSync(file, nextText);

  return { ok: true, id, image };
}

/** Read the stored curation record for a project, or null if not curated. */
function readCurationRecord(project: string): CurationRecord | null {
  const file = curationPath(project);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as CurationRecord;
}

/** Build the full detail payload (info + shots + curation) for a project. */
export function getProjectDetail(project: string): ProjectDetail {
  const info = readProjectInfo(project);
  const manifest = loadManifest(project);
  const caps = capturesDir(project);
  const shots: ShotInfo[] = manifest.shots.map((s, i) => {
    const file = screenshotFilename(i + 1, s.id);
    return {
      id: s.id,
      caption: s.caption,
      kind: isImageShot(s) ? "manual" : "browser",
      index: i + 1,
      file,
      captured: existsSync(join(caps, file)),
    };
  });
  const record = readCurationRecord(project);
  return { info, shots, curation: record ? record.curation : null };
}

/** Read just the curation (validated against the manifest), or null. */
export function getCuration(project: string): CurationResult | null {
  const record = readCurationRecord(project);
  if (!record) return null;
  const manifest = loadManifest(project);
  return validateCuration(record.curation, manifest.shots.map((s) => s.id));
}

/**
 * Persist an edited curation: validate it against the manifest, write it back to
 * curation.json (preserving cache metadata so a later `curate` still short-
 * circuits), and rebuild curated/ so the browsable set mirrors the edits. This
 * is how UI edits to shot order, callouts, and the tagline reach `render`.
 */
export function saveCuration(
  project: string,
  curation: unknown,
  now: Date = new Date(),
): { ok: true } {
  const manifest = loadManifest(project);
  const validated = validateCuration(curation, manifest.shots.map((s) => s.id));
  const prev = readCurationRecord(project);
  const record: CurationRecord = {
    cacheKey: prev?.cacheKey,
    model: prev?.model,
    generatedAt: now.toISOString(),
    curation: validated,
  };
  mkdirSync(projectDir(project), { recursive: true });
  writeFileSync(curationPath(project), JSON.stringify(record, null, 2));
  // Refresh curated/ so the folder always mirrors the saved curation.
  writeCuratedSet(manifest, validated, capturesDir(project), curatedDir(project));
  return { ok: true };
}

// ---- Heavy, side-effectful steps (injectable runners for testing) ----

export interface DetectResult {
  framework: string;
  routes: number;
  brand: {
    primaryColor?: string;
    accentColor?: string;
    font?: string;
  };
}

/** Introspect a local repo (framework, route count, brand) without writing. */
export async function detectTarget(
  input: { repoPath: string },
  deps: { init?: typeof initProject; client?: CaptionClient } = {},
): Promise<DetectResult> {
  // Reuse initProject's introspection; it needs a caption client, but detection
  // only reports counts, so we still run the full plan to surface route count.
  const client = deps.client ?? anthropicClient();
  const init = deps.init ?? initProject;
  const result = await init({ project: "detect", repoPath: input.repoPath, client });
  return {
    framework: result.framework,
    routes: result.routesFound,
    brand: {
      primaryColor: result.brand.primaryColor,
      accentColor: result.brand.accentColor,
      font: result.brand.font,
    },
  };
}

export interface CreateProjectInput {
  name: string;
  repoPath: string;
  baseUrl?: string;
  force?: boolean;
}

/** `init`: introspect a repo and write projects/<name>/manifest.yaml. */
export async function createProject(
  input: CreateProjectInput,
  deps: { init?: typeof initProject; client?: CaptionClient } = {},
): Promise<{ ok: true; manifestPath: string }> {
  const out = manifestPath(input.name);
  if (existsSync(out) && !input.force) {
    throw new Error(`${out} already exists. Pass force to overwrite it.`);
  }
  const client = deps.client ?? anthropicClient();
  const init = deps.init ?? initProject;
  const result = await init({
    project: input.name,
    repoPath: input.repoPath,
    baseUrl: input.baseUrl,
    client,
  });
  mkdirSync(projectDir(input.name), { recursive: true });
  writeFileSync(out, result.yaml);
  return { ok: true, manifestPath: out };
}

export interface CaptureSummary {
  captured: number;
  warnings: number;
  failed: number;
  browserLaunched: boolean;
  shots: { id: string; kind: "browser" | "manual" }[];
}

/**
 * `capture`: prune stale frames, then screenshot every shot into captures/.
 * Throws a readiness/auth error (rather than exiting) when the manifest isn't
 * ready or a browser shot has no saved login.
 */
export async function runCapture(
  project: string,
  onProgress?: (p: ShotProgress) => void,
  deps: { capture?: (opts: CaptureProjectOptions) => Promise<CaptureRunResult> } = {},
): Promise<CaptureSummary> {
  assertReady(project);
  const manifest = loadManifest(project);
  const statePath = statePathFor(project);
  if (needsAuth(manifest) && !existsSync(statePath)) {
    throw new Error(
      `No saved session at ${statePath}. Authenticate this project first.`,
    );
  }

  const outDir = capturesDir(project);
  mkdirSync(outDir, { recursive: true });
  const expected = manifest.shots.map((s, i) => screenshotFilename(i + 1, s.id));
  pruneStaleOutputs(projectDir(project), expected);

  const capture = deps.capture ?? captureProject;
  const result = await capture({
    manifest,
    imageBaseDir: projectDir(project),
    outDir,
    statePath,
    onProgress,
  });

  return {
    captured: result.results.length,
    warnings: result.warned.length,
    failed: result.failed.length,
    browserLaunched: result.browserLaunched,
    shots: result.results.map((r) => ({ id: r.id, kind: r.kind })),
  };
}

export interface CurateSummary {
  cached: boolean;
  curation: CurationResult;
  curatedCount: number;
}

/** `curate`: one Claude call to rank shots + write a tagline; refresh curated/. */
export async function runCurate(
  project: string,
  options: { force?: boolean } = {},
  deps: {
    curate?: (opts: CurateOptions) => Promise<CurateResult>;
    client?: CurateOptions["client"];
  } = {},
): Promise<CurateSummary> {
  assertReady(project);
  const manifest = loadManifest(project);
  const caps = capturesDir(project);
  const pngCount = existsSync(caps)
    ? readdirSync(caps).filter((n) => n.toLowerCase().endsWith(".png")).length
    : 0;
  if (pngCount === 0) {
    throw new Error(`No captures for "${project}". Run capture first.`);
  }

  const { images, files } = await loadShotImages(caps, manifest);
  const client = deps.client ?? anthropicClient();
  const curate = deps.curate ?? curateProject;
  const result = await curate({
    images,
    files,
    shots: manifest.shots,
    manifestShotIds: manifest.shots.map((s) => s.id),
    outPath: curationPath(project),
    force: options.force ?? false,
    client,
  });

  const { copied } = writeCuratedSet(
    manifest,
    result.curation,
    caps,
    curatedDir(project),
  );
  return { cached: result.cached, curation: result.curation, curatedCount: copied.length };
}

/** One render output with a project-relative path the browser can fetch. */
export interface RenderOutputDTO {
  kind: "video" | "poster";
  tier?: number;
  /** Path relative to the project folder, e.g. renders/<runId>/demo-15s.mp4. */
  relPath: string;
  bytes: number;
}

export interface RenderSummary {
  runId: string;
  tiers: number[];
  outputs: RenderOutputDTO[];
}

/** `render`: build the reel(s) + poster into a fresh, uniquely-named run folder. */
export async function runRender(
  project: string,
  options: { duration?: number; all?: boolean; fps?: number },
  onProgress?: RenderOptions["onProgress"],
  deps: { render?: (opts: RenderOptions) => Promise<RenderResult> } = {},
): Promise<RenderSummary> {
  assertReady(project);
  const render = deps.render ?? renderProject;
  const result = await render({
    project,
    duration: options.duration,
    all: options.all,
    fps: options.fps,
    onProgress,
  });
  const base = projectDir(project);
  return {
    runId: result.runId,
    tiers: result.tiers,
    outputs: result.outputs.map((o) => ({
      kind: o.kind,
      tier: o.tier,
      relPath: toRel(base, o.path),
      bytes: o.bytes,
    })),
  };
}

/**
 * `login`: launch a headed browser so the user can sign in, then save the
 * session. Interactive by nature — the returned promise resolves once the caller
 * signals completion via `confirm` (the server ties that to an HTTP request).
 * Only usable on a machine with a display + Chrome; not exercised headlessly.
 */
export function startLogin(
  project: string,
  mode: LoginMode,
  deps: { login?: (opts: RunLoginOptions) => Promise<void> } = {},
): { done: Promise<{ savedTo: string }>; confirm: () => void } {
  assertReady(project);
  const manifest = loadManifest(project);
  const target = manifest.loginUrl
    ? new URL(manifest.loginUrl, manifest.baseUrl).href
    : manifest.baseUrl;

  const authDir = resolve(AUTH_DIR);
  mkdirSync(authDir, { recursive: true });
  const statePath = statePathFor(project);
  const profileDir = join(authDir, "profiles", project);
  mkdirSync(profileDir, { recursive: true });

  let signal!: () => void;
  const gate = new Promise<void>((res) => {
    signal = res;
  });

  const login = deps.login ?? runLogin;
  const done = login({
    project,
    mode,
    target,
    viewport: manifest.viewport,
    statePath,
    profileDir,
    // The bridge replaces the CLI's "press Enter" with an HTTP confirm.
    waitForEnter: () => gate,
  }).then(() => ({ savedTo: statePath }));

  return { done, confirm: signal };
}

// ---- helpers ----

/** Non-exiting manifest readiness check; throws the doctor report if not ready. */
function assertReady(project: string): void {
  const file = manifestPath(project);
  if (!existsSync(file)) throw new Error(`No manifest for project "${project}"`);
  const result = checkManifestReady(readFileSync(file, "utf8"));
  if (!result.ready) {
    const issues = result.issues.map((i) => `  line ${i.line}: ${i.message}`).join("\n");
    throw new Error(`Manifest for "${project}" is not ready:\n${issues}`);
  }
}

/** A real Anthropic client from the configured key (throws if the key is absent). */
function anthropicClient(): Anthropic {
  const { anthropicApiKey } = loadEnv();
  return new Anthropic({ apiKey: anthropicApiKey });
}

/** Path of `abs` relative to `base`, using forward slashes for URLs. */
function toRel(base: string, abs: string): string {
  const b = base.endsWith("/") ? base : base + "/";
  return abs.startsWith(b) ? abs.slice(b.length).split("\\").join("/") : abs;
}

/** Whitelisted media subfolders the bridge is allowed to serve. */
export const MEDIA_DIRS: Record<string, (project: string) => string> = {
  captures: capturesDir,
  curated: curatedDir,
  renders: rendersDir,
  manual: manualDir,
};
