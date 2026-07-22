import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

/**
 * Configuration loading. Entry points that need the Anthropic key call loadEnv()
 * at startup so the key resolves whether it lives in a repo-root .env file or is
 * exported in the environment — without the caller having to pass --env-file.
 */

/** Repo-root .env path, resolved relative to this module (src/env.ts -> ../.env). */
const DEFAULT_ENV_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".env",
);

export interface Env {
  anthropicApiKey: string;
}

/**
 * Normalize a raw env value: trim whitespace, strip one layer of surrounding
 * quotes, and drop trailing carriage returns (Windows .env files are commonly
 * CRLF, which can otherwise leave a stray \r on the value).
 */
function sanitize(raw: string): string {
  let value = raw.trim();
  const quoted = /^(['"])([\s\S]*)\1$/.exec(value);
  if (quoted) value = quoted[2];
  return value.replace(/\r+$/g, "").trim();
}

/**
 * Load environment configuration and return the resolved values.
 *
 * dotenv.config() is a no-op when the file is absent and never overrides
 * variables already present in process.env, so an exported ANTHROPIC_API_KEY
 * keeps working with no .env file. Throws a clear, actionable error if the key
 * is missing or empty after normalization.
 *
 * @param envPath Path to the .env file; defaults to the repo root. Overridable
 *   for tests.
 */
export function loadEnv(envPath: string = DEFAULT_ENV_PATH): Env {
  dotenv.config({ path: envPath, quiet: true });

  const anthropicApiKey = sanitize(process.env.ANTHROPIC_API_KEY ?? "");
  if (!anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY was not found.\n" +
        "Set it in a .env file at the repo root, or export it as an environment variable.\n" +
        "See .env.example for the expected format.",
    );
  }

  return { anthropicApiKey };
}
