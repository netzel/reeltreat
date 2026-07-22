import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { checkManifestReady, formatDoctorReport } from "../doctor.js";

describe("checkManifestReady", () => {
  it("passes a clean manifest, ignoring comments (header TODO + commented dynamic routes)", () => {
    const yaml = [
      "# ============================================================",
      "# TODO — 1 item before this will run",
      "# [ ] 1. Replace <ID> in the 1 dynamic route at the bottom",
      "# ============================================================",
      "name: myapp",
      "baseUrl: http://localhost:3000",
      "shots:",
      "  - id: dashboard",
      "    path: /dashboard",
      "    caption: Overview",
      "# --- Dynamic routes: need a real id ---",
      "#  - id: entry-detail",
      "#    path: /entries/<ID>",
      "#    caption: Entry detail",
      "",
    ].join("\n");

    expect(checkManifestReady(yaml)).toEqual({ ready: true, issues: [] });
  });

  it("detects active TODO tokens with correct line numbers", () => {
    const yaml = [
      "name: myapp", // line 1
      "baseUrl: TODO_SET_BASE_URL", // line 2
      "shots:", // line 3
      "  - id: entry-detail", // line 4
      "    path: /entries/<ID>", // line 5
      "    caption: Entry detail", // line 6
    ].join("\n");

    const result = checkManifestReady(yaml);
    expect(result.ready).toBe(false);
    expect(result.issues).toEqual([
      { line: 2, message: "baseUrl is still TODO_SET_BASE_URL" },
      { line: 5, message: 'shot "entry-detail" path contains <ID>' },
    ]);
  });

  it("formats a human-readable report", () => {
    const result = checkManifestReady("baseUrl: TODO_SET_BASE_URL");
    const report = formatDoctorReport("myapp", result);
    expect(report).toContain("projects/myapp.yaml is not ready:");
    expect(report).toContain("line 1: baseUrl is still TODO_SET_BASE_URL");
    expect(report).toContain("Fix these, then rerun.");
  });
});

// --- The guard is wired into login/capture/curate ---
// Run each command as a subprocess against a manifest that still has TODO
// tokens and assert it exits non-zero before doing any real work.

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const NOT_READY = [
  "name: doctorwire",
  "baseUrl: TODO_SET_BASE_URL",
  "shots:",
  "  - id: home",
  "    path: /home",
  "    caption: Home",
  "",
].join("\n");

const project = "__doctor_wire_test__";
const manifestPath = join(repoRoot, "projects", `${project}.yaml`);

/** Run `node --import tsx <script> <project>` and return {status, stderr}. */
function runCli(script: string): { status: number; stderr: string } {
  try {
    execFileSync(
      process.execPath,
      ["--import", "tsx", join(repoRoot, "src", script), project],
      { cwd: repoRoot, encoding: "utf8", stdio: "pipe", timeout: 60000 },
    );
    return { status: 0, stderr: "" };
  } catch (err) {
    const e = err as { status?: number; stderr?: string };
    return { status: e.status ?? 1, stderr: e.stderr ?? "" };
  }
}

afterEach(() => {
  rmSync(manifestPath, { force: true });
});

describe.each(["login.ts", "capture.ts", "curate.ts"])(
  "%s refuses a manifest with TODO tokens",
  (script) => {
    it("exits non-zero and explains what to fix", () => {
      writeFileSync(manifestPath, NOT_READY);
      const { status, stderr } = runCli(script);
      expect(status).not.toBe(0);
      expect(stderr).toContain(`projects/${project}.yaml is not ready`);
    });
  },
);
