import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { chromium } from "playwright";
import { loadManifest } from "./manifest.js";

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

async function main(): Promise<void> {
  const project = process.argv[2];
  if (!project) {
    console.error("Usage: npm run login -- <project>");
    process.exit(1);
  }

  const manifest = loadManifest(project);
  const target = resolveLoginUrl(manifest.baseUrl, manifest.loginUrl);

  const authDir = resolve("auth");
  mkdirSync(authDir, { recursive: true });
  const statePath = resolve(authDir, `${project}.json`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: manifest.viewport });
  const page = await context.newPage();
  await page.goto(target);

  await waitForEnter(
    "Log in in the browser window, then press Enter here to save your session. ",
  );

  await context.storageState({ path: statePath });
  await browser.close();
  console.log(`Saved session to ${statePath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
