import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Pre-flight check for generated manifests. `init` writes greppable placeholder
 * tokens for anything the user must fill in; login/capture/curate run this first
 * so they fail loudly (with line numbers) instead of half-working.
 */

/** Placeholder emitted for an unset baseUrl. */
export const TODO_BASE_URL = "TODO_SET_BASE_URL";
/** Placeholder emitted for the id in a dynamic route path. */
export const TODO_ID = "<ID>";

export interface DoctorIssue {
  line: number;
  message: string;
}

export interface DoctorResult {
  ready: boolean;
  issues: DoctorIssue[];
}

/**
 * Scan manifest YAML text for remaining placeholder tokens. Fully-commented
 * lines are ignored, so the header TODO block and the commented-out dynamic
 * routes section never trip the check — only active config does.
 */
export function checkManifestReady(yamlText: string): DoctorResult {
  const issues: DoctorIssue[] = [];
  let currentShotId: string | undefined;

  yamlText.split(/\r?\n/).forEach((line, i) => {
    const lineNo = i + 1;
    if (line.trimStart().startsWith("#")) return; // comment — ignore

    const idMatch = /(?:^|\s)id:\s*([A-Za-z0-9-]+)/.exec(line);
    if (idMatch) currentShotId = idMatch[1];

    if (line.includes(TODO_BASE_URL)) {
      issues.push({ line: lineNo, message: `baseUrl is still ${TODO_BASE_URL}` });
    }
    if (line.includes(TODO_ID)) {
      issues.push({
        line: lineNo,
        message: currentShotId
          ? `shot "${currentShotId}" path contains ${TODO_ID}`
          : `path contains ${TODO_ID}`,
      });
    }
  });

  return { ready: issues.length === 0, issues };
}

/** Human-readable report matching the format printed by the CLI commands. */
export function formatDoctorReport(
  projectName: string,
  result: DoctorResult,
): string {
  const header = `projects/${projectName}.yaml is not ready:`;
  const body = result.issues
    .map((iss) => `  line ${iss.line}: ${iss.message}`)
    .join("\n");
  return `${header}\n${body}\nFix these, then rerun.`;
}

/**
 * Guard used at the start of login/capture/curate: if the manifest still has
 * placeholder tokens, print exactly what to fix and exit 1. A missing file is
 * left for loadManifest to report.
 */
export function assertManifestReady(projectName: string): void {
  const file = resolve("projects", `${projectName}.yaml`);
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return; // loadManifest will produce the "not found" error
  }

  const result = checkManifestReady(text);
  if (!result.ready) {
    console.error(formatDoctorReport(projectName, result));
    process.exit(1);
  }
}
