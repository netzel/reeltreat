import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Shared spies for the mocked playwright module, defined via vi.hoisted so the
// vi.mock factory (hoisted above imports) and the assertions can both see them.
const pw = vi.hoisted(() => {
  const storageState = vi.fn().mockResolvedValue({});
  const contextClose = vi.fn().mockResolvedValue(undefined);
  const goto = vi.fn().mockResolvedValue(undefined);
  const newPage = vi.fn().mockResolvedValue({ goto });

  const launchPersistentContext = vi
    .fn()
    .mockResolvedValue({ newPage, storageState, close: contextClose });

  const browserClose = vi.fn().mockResolvedValue(undefined);
  const connectOverCDP = vi.fn().mockResolvedValue({
    contexts: () => [{ storageState }],
    close: browserClose,
  });

  return {
    storageState,
    contextClose,
    goto,
    newPage,
    launchPersistentContext,
    browserClose,
    connectOverCDP,
  };
});

vi.mock("playwright", () => ({
  chromium: {
    launchPersistentContext: pw.launchPersistentContext,
    connectOverCDP: pw.connectOverCDP,
  },
}));

import { parseLoginArgs, runLogin, type RunLoginOptions } from "../login.js";

let dir: string;

function baseOpts(overrides: Partial<RunLoginOptions> = {}): RunLoginOptions {
  return {
    project: "myapp",
    mode: "stealth",
    target: "https://example.com/login",
    viewport: { width: 1440, height: 900 },
    statePath: join(dir, "auth", "myapp.json"),
    profileDir: join(dir, "auth", "profiles", "myapp"),
    waitForEnter: async () => {},
    ...overrides,
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "reeltreat-login-"));
  vi.clearAllMocks();
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("parseLoginArgs", () => {
  it("defaults to stealth mode", () => {
    expect(parseLoginArgs(["myapp"])).toEqual({ project: "myapp", mode: "stealth" });
  });

  it("accepts --mode attach", () => {
    expect(parseLoginArgs(["myapp", "--mode", "attach"])).toEqual({
      project: "myapp",
      mode: "attach",
    });
  });

  it("rejects an unknown --mode value with a clear message", () => {
    expect(() => parseLoginArgs(["myapp", "--mode", "bogus"])).toThrow(
      /Unknown --mode "bogus"/,
    );
  });
});

describe("stealth mode", () => {
  it("drives real Chrome via a per-project profile with automation disabled", async () => {
    const opts = baseOpts({ mode: "stealth" });
    await runLogin(opts);

    expect(pw.launchPersistentContext).toHaveBeenCalledTimes(1);
    const [userDataDir, options] = pw.launchPersistentContext.mock.calls[0];
    expect(userDataDir).toBe(opts.profileDir);
    expect(options.channel).toBe("chrome");
    expect(options.headless).toBe(false);
    expect(options.ignoreDefaultArgs).toEqual(["--enable-automation"]);
    expect(options.args).toContain("--disable-blink-features=AutomationControlled");
    // No custom user agent is set.
    expect(options.userAgent).toBeUndefined();

    expect(pw.connectOverCDP).not.toHaveBeenCalled();
  });

  it("saves storageState to auth/<project>.json and closes the context", async () => {
    const opts = baseOpts({ mode: "stealth" });
    await runLogin(opts);

    expect(pw.storageState).toHaveBeenCalledWith({ path: opts.statePath });
    expect(pw.contextClose).toHaveBeenCalledTimes(1);
  });
});

describe("attach mode", () => {
  it("connects over CDP to the expected endpoint", async () => {
    await runLogin(baseOpts({ mode: "attach", cdpEndpoint: "http://localhost:9222" }));
    expect(pw.connectOverCDP).toHaveBeenCalledWith("http://localhost:9222");
    expect(pw.launchPersistentContext).not.toHaveBeenCalled();
  });

  it("saves storageState from the existing context without closing the browser", async () => {
    const opts = baseOpts({ mode: "attach" });
    await runLogin(opts);

    expect(pw.storageState).toHaveBeenCalledWith({ path: opts.statePath });
    // The user's own browser must be left running.
    expect(pw.browserClose).not.toHaveBeenCalled();
  });
});

describe("CLI unknown mode", () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

  it("exits non-zero with a clear message", () => {
    let status = 0;
    let stderr = "";
    try {
      execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          join(repoRoot, "src", "login.ts"),
          "anyproject",
          "--mode",
          "bogus",
        ],
        { cwd: repoRoot, encoding: "utf8", stdio: "pipe", timeout: 60000 },
      );
    } catch (err) {
      const e = err as { status?: number; stderr?: string };
      status = e.status ?? 1;
      stderr = e.stderr ?? "";
    }
    expect(status).not.toBe(0);
    expect(stderr).toContain('Unknown --mode "bogus"');
  });
});
