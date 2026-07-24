import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as svc from "./service.js";
import { projectDir } from "../paths.js";

/**
 * src/bridge/server.ts — the Studio bridge. A localhost-only HTTP server the
 * browser UI talks to, since a browser can't run Playwright, call Anthropic, or
 * invoke Remotion itself. Every route delegates to bridge/service.ts (which
 * wraps the CLI pieces). Long-running steps (capture, render) stream NDJSON
 * progress; media routes serve a project's captures/curated/renders so the UI
 * can show real images and video.
 *
 * It executes captures/renders and writes files, so it binds to 127.0.0.1 only
 * and must never be exposed to a network.
 *
 * Run it with:  npm run bridge   (then start the UI: cd studio && npm run dev)
 */

const HOST = "127.0.0.1";
const DEFAULT_PORT = 5179;

/** A matched route: the HTTP method, a path regex, and its handler. */
interface Route {
  method: string;
  pattern: RegExp;
  handler: (ctx: RouteContext) => Promise<void> | void;
}

interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  /** Named capture groups from the path pattern (e.g. project, dir, file). */
  params: Record<string, string>;
  /** Parsed JSON body (empty object for GET/no body). */
  body: Record<string, unknown>;
  /** Parsed query string. */
  query: URLSearchParams;
}

// --- response helpers ---

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(body);
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

/** Begin an NDJSON stream (one JSON object per line) for progress + final result. */
function ndjsonInit(res: ServerResponse): void {
  res.writeHead(200, {
    "content-type": "application/x-ndjson",
    "cache-control": "no-cache",
  });
}
function ndjsonSend(res: ServerResponse, obj: unknown): void {
  res.write(JSON.stringify(obj) + "\n");
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// --- routes ---

/** In-flight logins, keyed by project: the confirm callback + completion promise. */
const pendingLogins = new Map<string, { confirm: () => void; done: Promise<{ savedTo: string }> }>();

export const ROUTES: Route[] = [
  {
    method: "GET",
    pattern: /^\/api\/projects$/,
    handler: ({ res }) => sendJson(res, 200, { projects: svc.listProjects() }),
  },
  {
    method: "POST",
    pattern: /^\/api\/detect$/,
    handler: async ({ res, body }) => {
      sendJson(res, 200, await svc.detectTarget({ repoPath: String(body.repoPath ?? "") }));
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/projects$/,
    handler: async ({ res, body }) => {
      sendJson(
        res,
        200,
        await svc.createProject({
          name: String(body.name ?? ""),
          repoPath: String(body.repoPath ?? ""),
          baseUrl: body.baseUrl ? String(body.baseUrl) : undefined,
          force: Boolean(body.force),
        }),
      );
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/projects\/(?<project>[^/]+)$/,
    handler: ({ res, params }) => sendJson(res, 200, svc.getProjectDetail(params.project)),
  },
  {
    method: "GET",
    pattern: /^\/api\/projects\/(?<project>[^/]+)\/manifest$/,
    handler: ({ res, params }) => sendJson(res, 200, { text: svc.getManifestText(params.project) }),
  },
  {
    method: "PUT",
    pattern: /^\/api\/projects\/(?<project>[^/]+)\/manifest$/,
    handler: ({ res, params, body }) =>
      sendJson(res, 200, svc.saveManifestText(params.project, String(body.text ?? ""))),
  },
  {
    method: "GET",
    pattern: /^\/api\/projects\/(?<project>[^/]+)\/curation$/,
    handler: ({ res, params }) => sendJson(res, 200, { curation: svc.getCuration(params.project) }),
  },
  {
    method: "PUT",
    pattern: /^\/api\/projects\/(?<project>[^/]+)\/curation$/,
    handler: ({ res, params, body }) =>
      sendJson(res, 200, svc.saveCuration(params.project, body.curation)),
  },
  {
    method: "POST",
    pattern: /^\/api\/projects\/(?<project>[^/]+)\/capture$/,
    handler: async ({ res, params }) => {
      ndjsonInit(res);
      try {
        const summary = await svc.runCapture(params.project, (p) =>
          ndjsonSend(res, { type: "progress", ...p }),
        );
        ndjsonSend(res, { type: "done", summary });
      } catch (e) {
        ndjsonSend(res, { type: "error", message: errMsg(e) });
      }
      res.end();
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/projects\/(?<project>[^/]+)\/curate$/,
    handler: async ({ res, params, body }) => {
      sendJson(res, 200, await svc.runCurate(params.project, { force: Boolean(body.force) }));
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/projects\/(?<project>[^/]+)\/render$/,
    handler: async ({ res, params, body }) => {
      ndjsonInit(res);
      try {
        const summary = await svc.runRender(
          params.project,
          {
            duration: body.duration ? Number(body.duration) : undefined,
            all: Boolean(body.all),
            fps: body.fps ? Number(body.fps) : undefined,
          },
          (p) => ndjsonSend(res, { type: "progress", ...p }),
        );
        ndjsonSend(res, { type: "done", summary });
      } catch (e) {
        ndjsonSend(res, { type: "error", message: errMsg(e) });
      }
      res.end();
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/projects\/(?<project>[^/]+)\/login$/,
    handler: ({ res, params, body }) => {
      const mode = body.mode === "attach" ? "attach" : "stealth";
      const { done, confirm } = svc.startLogin(params.project, mode);
      // Keep the browser open until the UI confirms sign-in via /login/confirm.
      pendingLogins.set(params.project, { confirm, done });
      done.catch(() => {}).finally(() => {
        // Leave the entry until confirm reads it; only clear on failure here.
      });
      sendJson(res, 200, { started: true });
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/projects\/(?<project>[^/]+)\/login\/confirm$/,
    handler: async ({ res, params }) => {
      const pending = pendingLogins.get(params.project);
      if (!pending) return sendError(res, 400, "no login in progress for this project");
      pending.confirm();
      try {
        const result = await pending.done;
        sendJson(res, 200, result);
      } catch (e) {
        sendError(res, 500, errMsg(e));
      } finally {
        pendingLogins.delete(params.project);
      }
    },
  },
  {
    method: "GET",
    pattern: /^\/media\/(?<project>[^/]+)\/(?<dir>captures|curated|renders|manual)\/(?<file>.+)$/,
    handler: ({ res, params }) => serveMedia(res, params.project, params.dir, params.file),
  },
];

/** Match a method + pathname against ROUTES; null if nothing matches. */
export function matchRoute(
  method: string,
  pathname: string,
): { route: Route; params: Record<string, string> } | null {
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const m = route.pattern.exec(pathname);
    if (m) return { route, params: { ...(m.groups ?? {}) } };
  }
  return null;
}

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".json": "application/json",
};

/**
 * Serve a file from one of a project's whitelisted media folders, guarding
 * against path traversal by confirming the resolved path stays inside the
 * allowed directory.
 */
function serveMedia(res: ServerResponse, project: string, dir: string, file: string): void {
  const baseFn = svc.MEDIA_DIRS[dir];
  if (!baseFn) return sendError(res, 404, "unknown media dir");
  const base = resolve(baseFn(project));
  const target = resolve(base, file);
  if (target !== base && !target.startsWith(base + "/")) {
    return sendError(res, 403, "path traversal rejected");
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    return sendError(res, 404, "not found");
  }
  res.writeHead(200, {
    "content-type": MIME[extname(target).toLowerCase()] ?? "application/octet-stream",
    "cache-control": "no-cache",
  });
  createReadStream(target).pipe(res);
}

/** Read and JSON-parse a request body (empty object when there's no body). */
function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((res, rej) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (!raw.trim()) return res({});
      try {
        res(JSON.parse(raw));
      } catch (e) {
        rej(new Error(`invalid JSON body: ${errMsg(e)}`));
      }
    });
    req.on("error", rej);
  });
}

/** Build the HTTP server (not yet listening), so tests can drive it on any port. */
export function createServer() {
  return createHttpServer(async (req, res) => {
    // Same-origin in production (Vite proxies /api). Permissive CORS keeps the
    // dev server usable if pointed straight at the bridge; localhost-only bind
    // means this never widens exposure beyond the local machine.
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET,POST,PUT,OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url ?? "/", `http://${HOST}`);
    const matched = matchRoute(req.method ?? "GET", url.pathname);
    if (!matched) return sendError(res, 404, `no route for ${req.method} ${url.pathname}`);

    try {
      const body = await readBody(req);
      await matched.route.handler({
        req,
        res,
        params: matched.params,
        body,
        query: url.searchParams,
      });
    } catch (e) {
      if (!res.headersSent) sendError(res, 400, errMsg(e));
      else res.end();
    }
  });
}

function main(): void {
  const portArg = process.argv[2];
  const port = portArg ? Number(portArg) : DEFAULT_PORT;
  const server = createServer();
  server.listen(port, HOST, () => {
    console.log(`reeltreat bridge listening on http://${HOST}:${port}`);
    console.log(`serving projects from ${projectDir("<project>")}/..`);
    console.log("start the UI in another terminal:  cd studio && npm run dev");
  });
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return resolve(entry) === resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) main();
