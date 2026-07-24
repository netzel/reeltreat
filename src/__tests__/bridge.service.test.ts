import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import {
  addManualShot,
  clearCrop,
  createProject,
  getCuration,
  getEdit,
  getManifestText,
  getProjectDetail,
  listProjects,
  runCapture,
  runCurate,
  runRender,
  saveCuration,
  saveManifestText,
  setCrop,
  startLogin,
} from "../bridge/service.js";
import type { CurationResult } from "../curation-schema.js";

const MANIFEST = [
  "name: myapp",
  "baseUrl: https://myapp.example.com",
  "shots:",
  "  - id: home",
  "    path: /home",
  "    caption: Home",
  "  - id: about",
  "    path: /about",
  "    caption: About",
  "",
].join("\n");

function validCuration(): CurationResult {
  return {
    tagline: "Ship faster",
    heroShotId: "home",
    shots: [
      { id: "home", rank: 1, callout: "Home", reason: "x" },
      { id: "about", rank: 2, callout: "About", reason: "y" },
    ],
    cuts: {
      "5": [{ id: "home", seconds: 5 }],
      "15": [{ id: "home", seconds: 15 }],
      "30": [{ id: "home", seconds: 30 }],
      "45": [{ id: "home", seconds: 45 }],
    },
  };
}

async function writePng(path: string): Promise<void> {
  mkdirSync(dirname(path), { recursive: true });
  await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } })
    .png()
    .toFile(path);
}

let cwd: string;
let root: string;

beforeEach(() => {
  cwd = process.cwd();
  root = mkdtempSync(join(tmpdir(), "reeltreat-bridge-"));
  process.chdir(root);
  mkdirSync(join(root, "projects", "myapp"), { recursive: true });
  writeFileSync(join(root, "projects", "myapp", "manifest.yaml"), MANIFEST);
});
afterEach(() => {
  process.chdir(cwd);
  rmSync(root, { recursive: true, force: true });
});

describe("listProjects", () => {
  it("lists projects with a manifest and derives status from artifacts", async () => {
    // Second project with a capture on disk → status "Captured".
    mkdirSync(join(root, "projects", "docs", "captures"), { recursive: true });
    writeFileSync(join(root, "projects", "docs", "manifest.yaml"), MANIFEST.replace("myapp", "docs"));
    await writePng(join(root, "projects", "docs", "captures", "01-home.png"));

    const projects = listProjects();
    const byName = Object.fromEntries(projects.map((p) => [p.name, p]));

    expect(Object.keys(byName).sort()).toEqual(["docs", "myapp"]);
    expect(byName.myapp.status).toBe("Draft");
    expect(byName.myapp.shots).toBe(2);
    expect(byName.docs.status).toBe("Captured");
  });

  it("ignores directories without a manifest", () => {
    mkdirSync(join(root, "projects", "empty"), { recursive: true });
    expect(listProjects().map((p) => p.name)).toEqual(["myapp"]);
  });
});

describe("manifest read/write", () => {
  it("reads the raw manifest text", () => {
    expect(getManifestText("myapp")).toContain("name: myapp");
  });

  it("saves valid manifest text", () => {
    const next = MANIFEST.replace("Home", "Overview");
    expect(saveManifestText("myapp", next)).toEqual({ ok: true });
    expect(getManifestText("myapp")).toContain("Overview");
  });

  it("rejects invalid YAML and invalid schema without writing", () => {
    expect(() => saveManifestText("myapp", "name: [unclosed")).toThrow(/Invalid YAML/);
    expect(() => saveManifestText("myapp", "name: myapp\nshots: []\n")).toThrow(/Invalid manifest/);
    // The good manifest is untouched.
    expect(getManifestText("myapp")).toContain("- id: home");
  });
});

describe("addManualShot", () => {
  const b64 = Buffer.from("fake-image-bytes").toString("base64");

  it("saves the image and appends a manual shot to the manifest", () => {
    const result = addManualShot("myapp", {
      id: "mic",
      caption: "Live mic",
      filename: "shot.png",
      dataBase64: b64,
    });
    expect(result).toMatchObject({ ok: true, id: "mic", image: "manual/shot.png" });
    // Image written into manual/.
    expect(existsSync(join(root, "projects", "myapp", "manual", "shot.png"))).toBe(true);
    // Shot appended and readable via the detail payload.
    const detail = getProjectDetail("myapp");
    expect(detail.shots.map((s) => s.id)).toEqual(["home", "about", "mic"]);
    const mic = detail.shots.find((s) => s.id === "mic");
    expect(mic).toMatchObject({ kind: "manual", caption: "Live mic" });
  });

  it("preserves existing manifest comments when appending", () => {
    const commented = "# my project\nname: myapp\nbaseUrl: https://myapp.example.com\nshots:\n  - id: home\n    path: /home\n    caption: Home\n";
    writeFileSync(join(root, "projects", "myapp", "manifest.yaml"), commented);
    addManualShot("myapp", { id: "mic", caption: "Live mic", filename: "shot.png", dataBase64: b64 });
    const text = readFileSync(join(root, "projects", "myapp", "manifest.yaml"), "utf8");
    expect(text).toContain("# my project"); // comment survived the edit
    expect(text).toContain("id: mic");
  });

  it("rejects a non-slug id, a duplicate id, and an unsupported file type", () => {
    expect(() => addManualShot("myapp", { id: "Not Slug", caption: "c", filename: "a.png", dataBase64: b64 })).toThrow(/slug/);
    expect(() => addManualShot("myapp", { id: "home", caption: "c", filename: "a.png", dataBase64: b64 })).toThrow(/already exists/);
    expect(() => addManualShot("myapp", { id: "vid", caption: "c", filename: "a.mov", dataBase64: b64 })).toThrow(/unsupported image type/);
  });

  it("rejects an empty upload", () => {
    expect(() => addManualShot("myapp", { id: "mic", caption: "c", filename: "a.png", dataBase64: "" })).toThrow(/empty/);
  });
});

describe("getProjectDetail", () => {
  it("reports shots with capture presence and null curation before curating", async () => {
    await writePng(join(root, "projects", "myapp", "captures", "01-home.png"));
    const detail = getProjectDetail("myapp");
    expect(detail.shots.map((s) => [s.id, s.captured])).toEqual([
      ["home", true],
      ["about", false],
    ]);
    expect(detail.shots[0].file).toBe("01-home.png");
    expect(detail.curation).toBeNull();
  });
});

describe("curation read/write", () => {
  beforeEach(async () => {
    // captures present so saveCuration can rebuild curated/.
    await writePng(join(root, "projects", "myapp", "captures", "01-home.png"));
    await writePng(join(root, "projects", "myapp", "captures", "02-about.png"));
  });

  it("returns null before curation exists", () => {
    expect(getCuration("myapp")).toBeNull();
  });

  it("saves an edited curation, validates it, and rebuilds curated/", () => {
    const cur = validCuration();
    cur.shots[0].callout = "Command center"; // an edit from the UI
    saveCuration("myapp", cur, new Date(2026, 0, 1));

    const stored = getCuration("myapp");
    expect(stored?.shots[0].callout).toBe("Command center");
    // curated/ mirrors the saved curation (hero flagged, rank-ordered).
    expect(existsSync(join(root, "projects", "myapp", "curated", "01-home-hero.png"))).toBe(true);
    expect(existsSync(join(root, "projects", "myapp", "curated", "02-about.png"))).toBe(true);
    // generatedAt is refreshed from the injected clock.
    const record = JSON.parse(readFileSync(join(root, "projects", "myapp", "curation.json"), "utf8"));
    expect(record.generatedAt).toBe(new Date(2026, 0, 1).toISOString());
  });

  it("rejects a curation that references an unknown shot id", () => {
    const cur = validCuration();
    cur.heroShotId = "ghost";
    expect(() => saveCuration("myapp", cur)).toThrow(/not a manifest shot/);
  });
});

describe("runCapture", () => {
  it("prunes, runs the injected capture, and summarizes results", async () => {
    // A browser shot needs a saved session.
    mkdirSync(join(root, "auth"), { recursive: true });
    writeFileSync(join(root, "auth", "myapp.json"), "{}");

    const capture = vi.fn().mockResolvedValue({
      results: [
        { id: "home", file: "x", kind: "browser" },
        { id: "about", file: "y", kind: "browser" },
      ],
      failed: [],
      warned: ["about"],
      browserLaunched: true,
    });

    const summary = await runCapture("myapp", undefined, { capture });
    expect(summary).toMatchObject({ captured: 2, warnings: 1, failed: 0, browserLaunched: true });
    expect(capture).toHaveBeenCalledOnce();
  });

  it("throws when a browser shot has no saved session", async () => {
    const capture = vi.fn();
    await expect(runCapture("myapp", undefined, { capture })).rejects.toThrow(/No saved session/);
    expect(capture).not.toHaveBeenCalled();
  });

  it("throws when the manifest still has TODO placeholders", async () => {
    writeFileSync(
      join(root, "projects", "myapp", "manifest.yaml"),
      "name: myapp\nbaseUrl: TODO_SET_BASE_URL\nshots:\n  - id: home\n    path: /home\n    caption: Home\n",
    );
    await expect(runCapture("myapp", undefined, { capture: vi.fn() })).rejects.toThrow(/not ready/);
  });
});

describe("runCurate", () => {
  it("throws when there are no captures", async () => {
    await expect(runCurate("myapp", {}, { curate: vi.fn(), client: {} as never })).rejects.toThrow(
      /No captures/,
    );
  });

  it("runs the injected curate and refreshes curated/", async () => {
    await writePng(join(root, "projects", "myapp", "captures", "01-home.png"));
    await writePng(join(root, "projects", "myapp", "captures", "02-about.png"));
    const curation = validCuration();
    const curate = vi.fn().mockResolvedValue({ cached: false, cacheKey: "k", curation, model: "m" });

    const summary = await runCurate("myapp", {}, { curate, client: {} as never });
    expect(summary.cached).toBe(false);
    expect(summary.curatedCount).toBe(2);
    expect(curate).toHaveBeenCalledOnce();
  });
});

describe("runRender", () => {
  it("relativizes output paths against the project folder", async () => {
    const render = vi.fn().mockResolvedValue({
      runId: "2026-01-01_090000-000",
      dir: join(root, "projects", "myapp", "renders", "2026-01-01_090000-000"),
      tiers: [15],
      outputs: [
        {
          kind: "video",
          tier: 15,
          path: join(root, "projects", "myapp", "renders", "2026-01-01_090000-000", "demo-15s.mp4"),
          bytes: 100,
        },
        {
          kind: "poster",
          path: join(root, "projects", "myapp", "renders", "2026-01-01_090000-000", "poster.png"),
          bytes: 50,
        },
      ],
    });

    const summary = await runRender("myapp", { duration: 15 }, undefined, { render });
    expect(summary.runId).toBe("2026-01-01_090000-000");
    expect(summary.outputs[0].relPath).toBe("renders/2026-01-01_090000-000/demo-15s.mp4");
    expect(summary.outputs[1].relPath).toBe("renders/2026-01-01_090000-000/poster.png");
  });
});

describe("startLogin", () => {
  it("resolves once the caller confirms, driving the injected login", async () => {
    const login = vi.fn().mockImplementation((opts) => opts.waitForEnter!("prompt"));
    const { done, confirm } = startLogin("myapp", "stealth", { login });
    confirm();
    await expect(done).resolves.toMatchObject({ savedTo: expect.stringContaining("myapp.json") });
    expect(login).toHaveBeenCalledOnce();
  });
});

describe("crops (edit.json)", () => {
  const rect = { x: 0.1, y: 0.2, w: 0.6, h: 0.5 };

  it("starts with an empty edit", () => {
    expect(getEdit("myapp")).toEqual({ version: 1, crops: {} });
  });

  it("sets, round-trips, and clears a crop for a manifest shot", () => {
    expect(setCrop("myapp", "home", rect)).toEqual({ ok: true });
    expect(getEdit("myapp").crops.home).toEqual(rect);
    // Editing crops never writes a curation or touches captures.
    expect(existsSync(join(root, "projects", "myapp", "edit.json"))).toBe(true);

    expect(clearCrop("myapp", "home")).toEqual({ ok: true });
    expect(getEdit("myapp").crops.home).toBeUndefined();
  });

  it("rejects a crop for an unknown shot id", () => {
    expect(() => setCrop("myapp", "nope", rect)).toThrow(/not in manifest/);
  });

  it("rejects an invalid rect without writing", () => {
    expect(() => setCrop("myapp", "home", { x: 0, y: 0, w: 1.5, h: 0.5 })).toThrow(/invalid crop/);
    expect(getEdit("myapp").crops.home).toBeUndefined();
  });
});
