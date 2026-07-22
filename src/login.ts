import { mkdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { chromium, type BrowserContext } from "playwright";
import { loadManifest } from "./manifest.js";
import { assertManifestReady } from "./doctor.js";

/**
 * Two login modes, both of which end by writing storageState to
 * auth/<project>.json — the exact file capture.ts consumes — so the two modes
 * are interchangeable from the rest of the pipeline's point of view.
 *
 * The default bundled Chromium is flagged as automation-controlled, which some
 * identity providers block ("this browser may not be secure") when a user signs
 * in to their own app. Both modes below drive a real Chrome instead.
 */
export type LoginMode = "stealth" | "attach";

/** CDP endpoint the attach mode connects to. */
const DEFAULT_CDP_ENDPOINT = "http://localhost:9222";

/** Resolve a login target (path or full URL) against the base URL. */
function resolveLoginUrl(baseUrl: string, loginUrl?: string): string {
  if (!loginUrl) return baseUrl;
  return new URL(loginUrl, baseUrl).href;
}

function waitForEnter(prompt: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question(prompt, () => {
      rl.close();
      res();
    });
  });
}

/** Parse the CLI args into a project and a validated mode. Throws on bad input. */
export function parseLoginArgs(argv: string[]): {
  project: string;
  mode: LoginMode;
} {
  const modeIdx = argv.indexOf("--mode");
  const modeVal = modeIdx >= 0 ? argv[modeIdx + 1] : "stealth";
  // Drop flags and the value that follows --mode when picking the project name.
  const modeValIdx = modeIdx >= 0 ? modeIdx + 1 : -1;
  const positionals = argv.filter(
    (a, i) => !a.startsWith("--") && i !== modeValIdx,
  );
  const project = positionals[0];

  if (!project) {
    throw new Error("Usage: npm run login -- <project> [--mode stealth|attach]");
  }
  if (modeVal !== "stealth" && modeVal !== "attach") {
    throw new Error(
      `Unknown --mode "${modeVal}". Use "stealth" (default) or "attach".`,
    );
  }
  return { project, mode: modeVal };
}

export interface RunLoginOptions {
  project: string;
  mode: LoginMode;
  target: string;
  viewport: { width: number; height: number };
  /** Where to write the saved session (auth/<project>.json). */
  statePath: string;
  /** Persistent Chrome profile dir for stealth mode (auth/profiles/<project>/). */
  profileDir: string;
  /** CDP endpoint for attach mode. */
  cdpEndpoint?: string;
  /** Injected so tests can drive the flow without real stdin. */
  waitForEnter?: (prompt: string) => Promise<void>;
}

/**
 * Stealth mode: drive the user's real, installed Google Chrome via a persistent
 * profile, with the automation fingerprint removed, so the sign-in looks like an
 * ordinary Chrome session.
 */
async function stealthLogin(opts: RunLoginOptions): Promise<void> {
  const wait = opts.waitForEnter ?? waitForEnter;

  let context: BrowserContext;
  try {
    // launchPersistentContext(userDataDir, options) -> Promise<BrowserContext>.
    // channel "chrome" drives the installed Google Chrome (not bundled Chromium).
    // ignoreDefaultArgs as an array filters out just the listed default flags,
    // dropping Playwright's "--enable-automation".
    // https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context
    context = await chromium.launchPersistentContext(opts.profileDir, {
      channel: "chrome",
      headless: false,
      viewport: opts.viewport,
      ignoreDefaultArgs: ["--enable-automation"],
      args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not launch Google Chrome (channel "chrome"): ${detail}\n` +
        `Install Google Chrome (https://www.google.com/chrome/), or rerun with:\n` +
        `  npm run login -- ${opts.project} --mode attach`,
    );
  }

  const page = await context.newPage();
  await page.goto(opts.target);

  await wait(
    "Log in in the Chrome window, then press Enter here to save your session. ",
  );

  await context.storageState({ path: opts.statePath });
  await context.close();
  console.log(`Saved session to ${opts.statePath}`);
}

/** Platform-specific commands to relaunch Chrome with remote debugging enabled. */
function attachInstructions(endpoint: string): string {
  const port = new URL(endpoint).port || "9222";
  return [
    "Attach mode — sign in using your own everyday Chrome:",
    "",
    "  1. Fully quit Chrome first (close ALL windows), or the flag is ignored.",
    `  2. Relaunch Chrome with remote debugging on port ${port}:`,
    "",
    "     Windows:",
    `       "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=${port}`,
    "     macOS:",
    `       "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=${port}`,
    "     Linux:",
    `       google-chrome --remote-debugging-port=${port}`,
    "",
    "  3. In that Chrome window, sign in to your app.",
    "  4. Come back here and press Enter.",
    "",
  ].join("\n");
}

/**
 * Attach mode: connect to the user's own Chrome over CDP. From the provider's
 * perspective it is an ordinary Chrome session. We only read its storage state
 * and disconnect — we never close the user's browser.
 */
async function attachLogin(opts: RunLoginOptions): Promise<void> {
  const wait = opts.waitForEnter ?? waitForEnter;
  const endpoint = opts.cdpEndpoint ?? DEFAULT_CDP_ENDPOINT;

  console.log(attachInstructions(endpoint));
  await wait("Press Enter once you have signed in in that Chrome window. ");

  let browser;
  try {
    // connectOverCDP(endpointURL) -> Promise<Browser>, attaching to a running
    // Chrome started with --remote-debugging-port.
    // https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp
    browser = await chromium.connectOverCDP(endpoint);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not connect to Chrome at ${endpoint}: ${detail}\n` +
        `Make sure you closed all Chrome windows first, then relaunched Chrome\n` +
        `with --remote-debugging-port and left that window open.`,
    );
  }

  // A CDP-attached browser exposes its existing context(s); the user's session
  // lives in the first one. https://playwright.dev/docs/api/class-browser#browser-contexts
  const context = browser.contexts()[0];
  if (!context) {
    throw new Error(
      `Connected to Chrome at ${endpoint}, but it has no open browser context. ` +
        `Open a tab and sign in, then rerun.`,
    );
  }

  await context.storageState({ path: opts.statePath });
  // Intentionally NOT calling browser.close(): that would disconnect (and we do
  // not want to risk the user's browser). Letting the process exit drops the
  // CDP socket cleanly on its own.
  console.log(`Saved session to ${opts.statePath}`);
}

/** Run the selected login mode. Exported for tests (playwright is mocked there). */
export async function runLogin(opts: RunLoginOptions): Promise<void> {
  if (opts.mode === "attach") {
    await attachLogin(opts);
  } else {
    await stealthLogin(opts);
  }
}

async function main(): Promise<void> {
  const { project, mode } = parseLoginArgs(process.argv.slice(2));

  assertManifestReady(project);
  const manifest = loadManifest(project);
  const target = resolveLoginUrl(manifest.baseUrl, manifest.loginUrl);

  const authDir = resolve("auth");
  mkdirSync(authDir, { recursive: true });
  const statePath = resolve(authDir, `${project}.json`);

  // Per-project persistent Chrome profile (gitignored under auth/).
  const profileDir = resolve(authDir, "profiles", project);
  mkdirSync(profileDir, { recursive: true });

  await runLogin({
    project,
    mode,
    target,
    viewport: manifest.viewport,
    statePath,
    profileDir,
  });
}

/** True when this file is run directly (not imported by tests). */
function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  main()
    // Attach mode leaves the CDP socket open; exit explicitly so the CLI ends.
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
