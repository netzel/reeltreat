#!/usr/bin/env node
// One-command launch for the reeltreat Studio web app.
//
// Starts the local bridge (src/bridge/server.ts, port 5179) and the Vite dev
// server for the UI (studio/, port 5175) together, prefixes their output, and
// shuts BOTH down on Ctrl-C or if either one exits. Zero extra dependencies —
// just Node's child_process — matching the repo's lean, no-deploy design.
//
// Vite (studio/vite.config.ts) auto-opens http://localhost:5175 and proxies
// /api + /media to the bridge, so the browser makes same-origin requests.

import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";

/** Child processes we manage, so we can tear them all down together. */
const procs = [];
let shuttingDown = false;

/** Spawn a labeled child, streaming its output with a [name] prefix. */
function run(name, args) {
  const child = spawn("npm", args, {
    // npm is npm.cmd on Windows, which needs a shell to resolve. On POSIX, run
    // detached so the child leads its own process group — then a group kill on
    // shutdown reaches npm AND its descendants (the sh → vite/tsx it spawns),
    // which a plain child.kill() would leave orphaned.
    shell: isWindows,
    detached: !isWindows,
  });
  const prefix = `[${name}] `;

  const pipe = (stream, out) => {
    let buf = "";
    stream.on("data", (chunk) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) out.write(prefix + line + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on("exit", (code, signal) => {
    process.stdout.write(prefix + `stopped (${signal ?? `exit ${code}`})\n`);
    // If one half dies, bring the other down too so we never leave a half-up app.
    shutdown(code ?? 0);
  });
  procs.push(child);
}

/** Kill a child and its whole process tree, cross-platform. */
function killTree(child) {
  if (!child.pid) return;
  try {
    if (isWindows) {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
    } else {
      // Negative pid targets the child's process group (see detached above).
      process.kill(-child.pid, "SIGTERM");
    }
  } catch {
    /* already gone */
  }
}

/** Terminate every child (and its descendants) once, then exit. */
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of procs) killTree(p);
  setTimeout(() => process.exit(code), 300);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// Bridge first (the UI proxies to it), then the Vite dev server.
run("bridge", ["run", "bridge"]);
run("ui", ["--prefix", "studio", "run", "dev"]);

console.log("reeltreat Studio starting…");
console.log("  • bridge  → http://localhost:5179  (pipeline API)");
console.log("  • web app → http://localhost:5175  (opens automatically once Vite is ready)");
console.log("Press Ctrl-C to stop both.\n");
