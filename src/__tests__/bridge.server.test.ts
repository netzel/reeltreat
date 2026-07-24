import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { createServer, matchRoute } from "../bridge/server.js";

const MANIFEST = [
  "name: myapp",
  "baseUrl: https://myapp.example.com",
  "shots:",
  "  - id: home",
  "    path: /home",
  "    caption: Home",
  "",
].join("\n");

describe("matchRoute", () => {
  it("extracts named params from the project routes", () => {
    const m = matchRoute("GET", "/api/projects/myapp/manifest");
    expect(m?.params.project).toBe("myapp");
  });

  it("extracts project/dir/file for media", () => {
    const m = matchRoute("GET", "/media/myapp/captures/01-home.png");
    expect(m?.params).toMatchObject({ project: "myapp", dir: "captures", file: "01-home.png" });
  });

  it("returns null for unknown routes and wrong methods", () => {
    expect(matchRoute("GET", "/nope")).toBeNull();
    expect(matchRoute("DELETE", "/api/projects")).toBeNull();
  });
});

describe("bridge server (integration)", () => {
  let cwd: string;
  let root: string;
  let server: ReturnType<typeof createServer>;
  let base: string;

  beforeEach(async () => {
    cwd = process.cwd();
    root = mkdtempSync(join(tmpdir(), "reeltreat-server-"));
    process.chdir(root);
    mkdirSync(join(root, "projects", "myapp", "captures"), { recursive: true });
    writeFileSync(join(root, "projects", "myapp", "manifest.yaml"), MANIFEST);
    await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 9, g: 9, b: 9 } } })
      .png()
      .toFile(join(root, "projects", "myapp", "captures", "01-home.png"));

    server = createServer();
    await new Promise<void>((res) => server.listen(0, "127.0.0.1", res));
    const port = (server.address() as AddressInfo).port;
    base = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await new Promise<void>((res) => server.close(() => res()));
    process.chdir(cwd);
    rmSync(root, { recursive: true, force: true });
  });

  it("lists projects", async () => {
    const r = await fetch(`${base}/api/projects`);
    expect(r.status).toBe(200);
    const data = (await r.json()) as { projects: { name: string }[] };
    expect(data.projects.map((p) => p.name)).toEqual(["myapp"]);
  });

  it("returns the manifest text and saves edits", async () => {
    const get = (await (await fetch(`${base}/api/projects/myapp/manifest`)).json()) as { text: string };
    expect(get.text).toContain("name: myapp");

    const put = await fetch(`${base}/api/projects/myapp/manifest`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: MANIFEST.replace("Home", "Overview") }),
    });
    expect(put.status).toBe(200);
    const after = (await (await fetch(`${base}/api/projects/myapp/manifest`)).json()) as { text: string };
    expect(after.text).toContain("Overview");
  });

  it("serves a capture image and rejects path traversal", async () => {
    const img = await fetch(`${base}/media/myapp/captures/01-home.png`);
    expect(img.status).toBe(200);
    expect(img.headers.get("content-type")).toBe("image/png");

    const bad = await fetch(`${base}/media/myapp/captures/..%2f..%2fmanifest.yaml`);
    expect([403, 404]).toContain(bad.status);
  });

  it("400s a save with an invalid manifest and 404s unknown routes", async () => {
    const bad = await fetch(`${base}/api/projects/myapp/manifest`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "name: myapp\nshots: []\n" }),
    });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toMatch(/Invalid manifest/);

    const missing = await fetch(`${base}/nope`);
    expect(missing.status).toBe(404);
  });
});
