import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadEnv } from "../env.js";

const KEY = "ANTHROPIC_API_KEY";

let dir: string;
let original: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "reeltreat-env-"));
  // Snapshot and clear so tests control the value; restored in afterEach.
  original = process.env[KEY];
  delete process.env[KEY];
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});

function writeEnv(contents: string): string {
  const p = join(dir, ".env");
  writeFileSync(p, contents);
  return p;
}

describe("loadEnv", () => {
  it("reads the key from a .env file", () => {
    const p = writeEnv("ANTHROPIC_API_KEY=sk-ant-fromfile\n");
    expect(loadEnv(p).anthropicApiKey).toBe("sk-ant-fromfile");
  });

  it("strips surrounding quotes and a trailing carriage return", () => {
    process.env[KEY] = '"sk-ant-quoted"\r';
    const missing = join(dir, "does-not-exist.env");
    expect(loadEnv(missing).anthropicApiKey).toBe("sk-ant-quoted");
  });

  it("does not throw when the file is absent but the var is exported", () => {
    process.env[KEY] = "sk-ant-exported";
    const missing = join(dir, "does-not-exist.env");
    expect(() => loadEnv(missing)).not.toThrow();
    expect(loadEnv(missing).anthropicApiKey).toBe("sk-ant-exported");
  });

  it("throws a clear error when neither source provides the key", () => {
    const missing = join(dir, "does-not-exist.env");
    expect(() => loadEnv(missing)).toThrow(/ANTHROPIC_API_KEY was not found/);
    // Message points the user to both supply methods and the example file.
    expect(() => loadEnv(missing)).toThrow(/\.env file at the repo root/);
    expect(() => loadEnv(missing)).toThrow(/environment variable/);
    expect(() => loadEnv(missing)).toThrow(/\.env\.example/);
  });

  it("treats a whitespace-only value as missing", () => {
    process.env[KEY] = "   \r";
    const missing = join(dir, "does-not-exist.env");
    expect(() => loadEnv(missing)).toThrow(/was not found/);
  });
});
