import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { loadManifest, type Manifest, type Shot } from "./manifest.js";
import { assertManifestReady } from "./doctor.js";
import {
  TIER_KEYS,
  validateCuration,
  type CurationResult,
} from "./curation-schema.js";

/** The model used for the single curation call. */
export const CURATION_MODEL = "claude-sonnet-5";

/** Max width (px) screenshots are downscaled to before upload, for cost control. */
const MAX_UPLOAD_WIDTH = 900;

/** A screenshot ready to send to the model: its shot id, caption, and base64 PNG. */
export interface ShotImage {
  id: string;
  caption: string;
  base64: string;
}

/** A screenshot file's name and raw bytes, used for the cache key. */
export interface ShotFile {
  name: string;
  bytes: Buffer;
}

/** Minimal client surface curateProject needs — lets tests inject a stub. */
export type CurationClient = Pick<Anthropic, "messages">;

const SYSTEM_PROMPT = `You are curating screenshots of a web application into a short, branded demo video reel.

Pick the most visually impressive and functionally representative shots, write a punchy tagline, and produce shot lists for 5-, 15-, 30-, and 45-second cuts.

Rules:
- The tagline is a single soundbite of at most 90 characters, overlaid on the poster frame.
- Choose one hero shot: the single most striking frame.
- Rank the shots you keep, best first (rank 1 is best).
- Each callout is a 2-4 word label naming the capability the shot shows (at most 40 characters).
- For each duration tier, list shots in order with a per-shot number of seconds. The seconds in each tier must sum to that tier's total (5, 15, 30, or 45).
- Shorter cuts must be strict subsets of the priorities in longer cuts: a shot in the 5s cut should also appear in the 15s, 30s, and 45s cuts.
- Use only the shot ids provided. Submit your answer via the submit_curation tool.`;

/** JSON Schema for the submit_curation tool, mirroring CurationResult. */
const CURATION_INPUT_SCHEMA = {
  type: "object",
  properties: {
    tagline: {
      type: "string",
      maxLength: 90,
      description: "Soundbite overlaid on the poster, at most 90 characters.",
    },
    heroShotId: {
      type: "string",
      description: "The id of the single most striking shot.",
    },
    shots: {
      type: "array",
      description: "Ranked shots to keep, best first.",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          rank: { type: "integer", minimum: 1 },
          callout: {
            type: "string",
            maxLength: 40,
            description: "2-4 word capability label.",
          },
          reason: { type: "string" },
        },
        required: ["id", "rank", "callout", "reason"],
      },
    },
    cuts: {
      type: "object",
      description:
        "Ordered shot lists per duration tier; per-tier seconds must sum to the tier value.",
      properties: {
        "5": cutSchema(),
        "15": cutSchema(),
        "30": cutSchema(),
        "45": cutSchema(),
      },
      required: ["5", "15", "30", "45"],
    },
  },
  required: ["tagline", "heroShotId", "shots", "cuts"],
} as const;

function cutSchema() {
  return {
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "string" },
        seconds: { type: "number", exclusiveMinimum: 0 },
      },
      required: ["id", "seconds"],
    },
  } as const;
}

/**
 * Deterministic cache key over the sorted screenshot filenames, their bytes,
 * and the manifest shots. Changing any of these changes the key.
 */
export function computeCacheKey(files: ShotFile[], shots: Shot[]): string {
  const hash = createHash("sha256");
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));
  for (const f of sorted) {
    hash.update(f.name);
    hash.update("\0");
    hash.update(f.bytes);
    hash.update("\0");
  }
  hash.update(JSON.stringify(shots));
  return hash.digest("hex");
}

/**
 * Build the interleaved user content: for each shot, a text block naming it
 * followed by its image block, in shot order.
 */
export function buildMessageContent(
  images: ShotImage[],
): Anthropic.ContentBlockParam[] {
  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of images) {
    content.push({ type: "text", text: `id: ${img.id} | caption: ${img.caption}` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: img.base64 },
    });
  }
  return content;
}

/** Read the screenshots dir, downscale each PNG, and pair it with its manifest caption. */
export async function loadShotImages(
  screenshotsDir: string,
  manifest: Manifest,
): Promise<{ images: ShotImage[]; files: ShotFile[] }> {
  const names = readdirSync(screenshotsDir)
    .filter((n) => n.toLowerCase().endsWith(".png"))
    .sort();

  const captionById = new Map(manifest.shots.map((s) => [s.id, s.caption]));
  const images: ShotImage[] = [];
  const files: ShotFile[] = [];

  for (const name of names) {
    const bytes = readFileSync(join(screenshotsDir, name));
    files.push({ name, bytes });

    const match = /^\d+-(.+)\.png$/i.exec(name);
    const id = match ? match[1] : name.replace(/\.png$/i, "");
    const caption = captionById.get(id) ?? "";

    const resized = await sharp(bytes)
      .resize({ width: MAX_UPLOAD_WIDTH, withoutEnlargement: true })
      .png()
      .toBuffer();

    images.push({ id, caption, base64: resized.toString("base64") });
  }

  return { images, files };
}

/**
 * Make the single curation API call and return the tool input plus token usage.
 * Exported so the request shape can be asserted with a stubbed client.
 */
export async function requestCuration(
  client: CurationClient,
  images: ShotImage[],
  model: string = CURATION_MODEL,
): Promise<{ input: unknown; usage: Anthropic.Usage }> {
  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    thinking: { type: "disabled" },
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "submit_curation",
        description: "Submit the curated shot lists, callouts, and tagline.",
        input_schema: CURATION_INPUT_SCHEMA as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "submit_curation" },
    messages: [{ role: "user", content: buildMessageContent(images) }],
  });

  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === "submit_curation",
  );
  if (!block) {
    throw new Error("model did not return a submit_curation tool call");
  }

  return { input: block.input, usage: response.usage };
}

export interface CurateOptions {
  images: ShotImage[];
  files: ShotFile[];
  shots: Shot[];
  manifestShotIds: string[];
  outPath: string;
  force: boolean;
  client: CurationClient;
  model?: string;
}

export interface CurateResult {
  cached: boolean;
  cacheKey: string;
  curation: CurationResult;
  model: string;
  usage?: Anthropic.Usage;
}

/**
 * Return cached curation if the cache key matches and --force wasn't passed;
 * otherwise call the model, validate, and write out/<project>/curation.json.
 */
export async function curateProject(opts: CurateOptions): Promise<CurateResult> {
  const model = opts.model ?? CURATION_MODEL;
  const cacheKey = computeCacheKey(opts.files, opts.shots);

  if (!opts.force && existsSync(opts.outPath)) {
    const stored = JSON.parse(readFileSync(opts.outPath, "utf8"));
    if (stored.cacheKey === cacheKey) {
      return {
        cached: true,
        cacheKey,
        curation: stored.curation,
        model: stored.model,
      };
    }
  }

  const { input, usage } = await requestCuration(opts.client, opts.images, model);
  // Throws before writing if invalid, so no bad cache file is produced.
  const curation = validateCuration(input, opts.manifestShotIds);

  const record = {
    cacheKey,
    model,
    generatedAt: new Date().toISOString(),
    curation,
  };
  writeFileSync(opts.outPath, JSON.stringify(record, null, 2));

  return { cached: false, cacheKey, curation, model, usage };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const project = args.find((a) => !a.startsWith("--"));
  if (!project) {
    console.error("Usage: npm run curate -- <project> [--force]");
    process.exit(1);
  }

  assertManifestReady(project);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "ANTHROPIC_API_KEY is not set. Export it, or run with: node --env-file=.env",
    );
    process.exit(1);
  }

  const manifest = loadManifest(project);

  const screenshotsDir = resolve("out", project, "screenshots");
  const pngCount = existsSync(screenshotsDir)
    ? readdirSync(screenshotsDir).filter((n) => n.toLowerCase().endsWith(".png")).length
    : 0;
  if (pngCount === 0) {
    console.error(
      `No screenshots in ${screenshotsDir}. Run: npm run capture -- ${project} first`,
    );
    process.exit(1);
  }

  const outPath = resolve("out", project, "curation.json");
  const { images, files } = await loadShotImages(screenshotsDir, manifest);

  const client = new Anthropic({ apiKey });
  const result = await curateProject({
    images,
    files,
    shots: manifest.shots,
    manifestShotIds: manifest.shots.map((s) => s.id),
    outPath,
    force,
    client,
  });

  if (result.cached) {
    console.log("curation up to date (cached)");
    return;
  }

  console.log(`tagline: ${result.curation.tagline}`);
  console.log(`hero:    ${result.curation.heroShotId}`);
  if (result.usage) {
    console.log(
      `tokens:  in ${result.usage.input_tokens}, out ${result.usage.output_tokens}`,
    );
  }
  console.log(`wrote ${outPath}`);
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
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
