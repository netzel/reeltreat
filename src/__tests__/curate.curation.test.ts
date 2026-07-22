import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildMessageContent,
  computeCacheKey,
  curateProject,
  requestCuration,
  type CurationClient,
  type ShotFile,
} from "../curate.js";
import { validateCuration } from "../curation-schema.js";
import type { Shot } from "../manifest.js";

// The real SDK is never constructed in these tests (clients are injected), but
// mock it so importing curate.ts never reaches native SDK init.
vi.mock("@anthropic-ai/sdk", () => ({ default: class Anthropic {} }));

const MANIFEST_IDS = ["dashboard", "settings"];

function shot(id: string): Shot {
  return {
    id,
    path: `/${id}`,
    caption: `Caption ${id}`,
    waitUntil: "load",
    timeoutMs: 30000,
    fullPage: false,
  };
}

/** A well-formed curation whose cuts sum to their tier values. */
function validCuration() {
  return {
    tagline: "Ship faster",
    heroShotId: "dashboard",
    shots: [
      { id: "dashboard", rank: 1, callout: "Overview", reason: "striking" },
      { id: "settings", rank: 2, callout: "Controls", reason: "clear" },
    ],
    cuts: {
      "5": [{ id: "dashboard", seconds: 5 }],
      "15": [
        { id: "dashboard", seconds: 8 },
        { id: "settings", seconds: 7 },
      ],
      "30": [
        { id: "dashboard", seconds: 16 },
        { id: "settings", seconds: 14 },
      ],
      "45": [
        { id: "dashboard", seconds: 23 },
        { id: "settings", seconds: 22 },
      ],
    },
  };
}

/** A stub client whose messages.create returns a submit_curation tool call. */
function stubClient(input: unknown = validCuration()) {
  const create = vi.fn().mockResolvedValue({
    content: [{ type: "tool_use", name: "submit_curation", input }],
    usage: { input_tokens: 10, output_tokens: 20 },
  });
  return { create, client: { messages: { create } } as unknown as CurationClient };
}

describe("computeCacheKey", () => {
  const files: ShotFile[] = [
    { name: "01-dashboard.png", bytes: Buffer.from("aaa") },
    { name: "02-settings.png", bytes: Buffer.from("bbb") },
  ];
  const shots = [shot("dashboard"), shot("settings")];

  it("is stable for identical inputs", () => {
    expect(computeCacheKey(files, shots)).toBe(computeCacheKey(files, shots));
  });

  it("is order-independent for the file list", () => {
    expect(computeCacheKey([...files].reverse(), shots)).toBe(
      computeCacheKey(files, shots),
    );
  });

  it("changes when a file's bytes change", () => {
    const changed = [{ ...files[0], bytes: Buffer.from("zzz") }, files[1]];
    expect(computeCacheKey(changed, shots)).not.toBe(computeCacheKey(files, shots));
  });

  it("changes when a file is added", () => {
    const added = [...files, { name: "03-help.png", bytes: Buffer.from("ccc") }];
    expect(computeCacheKey(added, shots)).not.toBe(computeCacheKey(files, shots));
  });

  it("changes when the manifest shots change", () => {
    const changed = [shot("dashboard"), shot("settings"), shot("help")];
    expect(computeCacheKey(files, changed)).not.toBe(computeCacheKey(files, shots));
  });
});

describe("buildMessageContent", () => {
  it("interleaves text and image blocks in shot order", () => {
    const content = buildMessageContent([
      { id: "a", caption: "Cap A", base64: "AAA" },
      { id: "b", caption: "Cap B", base64: "BBB" },
    ]);

    expect(content).toHaveLength(4);
    expect(content[0]).toEqual({ type: "text", text: "id: a | caption: Cap A" });
    expect(content[1]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "AAA" },
    });
    expect(content[2]).toEqual({ type: "text", text: "id: b | caption: Cap B" });
    expect(content[3]).toMatchObject({
      type: "image",
      source: { media_type: "image/png", data: "BBB" },
    });
  });
});

describe("validateCuration", () => {
  it("accepts a well-formed result", () => {
    expect(() => validateCuration(validCuration(), MANIFEST_IDS)).not.toThrow();
  });

  it("rejects an unknown heroShotId", () => {
    const c = { ...validCuration(), heroShotId: "ghost" };
    expect(() => validateCuration(c, MANIFEST_IDS)).toThrow(/heroShotId/);
  });

  it("rejects an unknown shot id in a cut", () => {
    const c = validCuration();
    c.cuts["5"] = [{ id: "ghost", seconds: 5 }];
    expect(() => validateCuration(c, MANIFEST_IDS)).toThrow(/ghost/);
  });

  it("rejects a tier whose seconds sum is off by more than 0.5", () => {
    const c = validCuration();
    c.cuts["5"] = [{ id: "dashboard", seconds: 9 }];
    expect(() => validateCuration(c, MANIFEST_IDS)).toThrow(/within 0.5/);
  });

  it("rejects a tagline over 90 characters", () => {
    const c = { ...validCuration(), tagline: "x".repeat(91) };
    expect(() => validateCuration(c, MANIFEST_IDS)).toThrow(/tagline/);
  });

  it("rejects empty cuts", () => {
    const c = { ...validCuration(), cuts: {} };
    expect(() => validateCuration(c, MANIFEST_IDS)).toThrow();
  });
});

describe("requestCuration", () => {
  it("calls the model with the sonnet-5 model and forces the submit_curation tool", async () => {
    const { create, client } = stubClient();
    await requestCuration(client, [{ id: "dashboard", caption: "c", base64: "AAA" }]);

    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0][0];
    expect(params.model).toBe("claude-sonnet-5");
    expect(params.tool_choice).toEqual({ type: "tool", name: "submit_curation" });
    expect(params.tools[0].name).toBe("submit_curation");
  });

  it("returns the tool_use input and usage", async () => {
    const { client } = stubClient();
    const { input, usage } = await requestCuration(client, []);
    expect(input).toMatchObject({ heroShotId: "dashboard" });
    expect(usage.output_tokens).toBe(20);
  });
});

describe("curateProject", () => {
  let dir: string;
  let outPath: string;
  const files: ShotFile[] = [{ name: "01-dashboard.png", bytes: Buffer.from("x") }];
  const shots = [shot("dashboard"), shot("settings")];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "reeltreat-"));
    outPath = join(dir, "curation.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns cached curation without invoking the client when the key matches", async () => {
    const cacheKey = computeCacheKey(files, shots);
    writeFileSync(
      outPath,
      JSON.stringify({ cacheKey, model: "claude-sonnet-5", curation: validCuration() }),
    );

    const { create, client } = stubClient();
    const result = await curateProject({
      images: [],
      files,
      shots,
      manifestShotIds: MANIFEST_IDS,
      outPath,
      force: false,
      client,
    });

    expect(result.cached).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it("calls the model and writes curation.json on a cache miss", async () => {
    const { create, client } = stubClient();
    const result = await curateProject({
      images: [],
      files,
      shots,
      manifestShotIds: MANIFEST_IDS,
      outPath,
      force: false,
      client,
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.cached).toBe(false);
    expect(existsSync(outPath)).toBe(true);
    const stored = JSON.parse(readFileSync(outPath, "utf8"));
    expect(stored.cacheKey).toBe(computeCacheKey(files, shots));
    expect(stored.curation.tagline).toBe("Ship faster");
  });

  it("re-runs when --force is set even if the key matches", async () => {
    const cacheKey = computeCacheKey(files, shots);
    writeFileSync(
      outPath,
      JSON.stringify({ cacheKey, model: "claude-sonnet-5", curation: validCuration() }),
    );

    const { create } = stubClient();
    const client = { messages: { create } } as unknown as CurationClient;
    await curateProject({
      images: [],
      files,
      shots,
      manifestShotIds: MANIFEST_IDS,
      outPath,
      force: true,
      client,
    });

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does not write a cache file when the model returns an invalid curation", async () => {
    const { client } = stubClient({ ...validCuration(), heroShotId: "ghost" });
    await expect(
      curateProject({
        images: [],
        files,
        shots,
        manifestShotIds: MANIFEST_IDS,
        outPath,
        force: false,
        client,
      }),
    ).rejects.toThrow(/heroShotId/);
    expect(existsSync(outPath)).toBe(false);
  });
});
