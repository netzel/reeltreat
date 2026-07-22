import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { DiscoveredRoute } from "./introspect.js";

/**
 * One Anthropic call that decides which discovered routes are worth demoing and
 * writes a slug id, a one-sentence caption, and a priority for each. Mirrors the
 * client/env pattern in curate.ts: forced tool use, thinking disabled, and a
 * client injected as `Pick<Anthropic, "messages">` so tests never hit the wire.
 */

export const CAPTION_MODEL = "claude-sonnet-5";

/** Minimal client surface generateCaptions needs — lets tests inject a stub. */
export type CaptionClient = Pick<Anthropic, "messages">;

/** Per-route source excerpt cap, in characters. */
export const PER_ROUTE_CHAR_CAP = 2000;
/** Total input cap across all routes, in characters. */
export const TOTAL_CHAR_CAP = 60000;
/** Most included routes we ask the model for. */
export const MAX_INCLUDED = 10;

/** A route paired with a trimmed excerpt of its source, ready for the prompt. */
export interface RouteExcerpt {
  routePath: string;
  excerpt: string;
}

const SYSTEM_PROMPT = `You are selecting which screens of a web app to feature in a short demo video.

You are given a list of routes, each with the route path and an excerpt of its source file. For each route decide whether it is worth demoing, and for the ones you include, write a punchy one-sentence caption describing the capability that screen shows.

Rules:
- Include at most 10 routes — the most visually and functionally impressive ones.
- Skip settings/admin plumbing, empty shells, and anything that isn't a real user-facing feature.
- Give every route a slug id: lowercase letters, numbers, and hyphens only, derived from the route.
- caption is a single sentence, at most ~80 characters, describing what the screen lets the user do.
- priority ranks the included routes: 1 is the most important, higher numbers less so.
- Return a decision for every route path you were given, via the submit_captions tool.`;

const CAPTIONS_INPUT_SCHEMA = {
  type: "object",
  properties: {
    routes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          routePath: { type: "string" },
          include: {
            type: "boolean",
            description: "Whether this route is worth featuring in the demo.",
          },
          id: {
            type: "string",
            description: "Slug id: lowercase letters, numbers, hyphens only.",
          },
          caption: {
            type: "string",
            description: "One-sentence capability caption, ~80 chars max.",
          },
          priority: {
            type: "integer",
            minimum: 1,
            description: "Rank among included routes; 1 is most important.",
          },
        },
        required: ["routePath", "include", "id", "caption", "priority"],
      },
    },
  },
  required: ["routes"],
} as const;

/** Validated shape of the model's response. */
export const CaptionPlanSchema = z.object({
  routes: z.array(
    z.object({
      routePath: z.string(),
      include: z.boolean(),
      id: z
        .string()
        .regex(/^[a-z0-9-]+$/, "id must be a slug (lowercase, numbers, hyphens)"),
      caption: z.string(),
      priority: z.number().int(),
    }),
  ),
});
export type CaptionPlan = z.infer<typeof CaptionPlanSchema>;
export type CaptionRoute = CaptionPlan["routes"][number];

/** Trim a source file to at most `cap` characters. */
export function trimExcerpt(text: string, cap = PER_ROUTE_CHAR_CAP): string {
  return text.length <= cap ? text : text.slice(0, cap);
}

/**
 * Promise score for prioritizing which routes to keep when over the total cap.
 * Static, shallower routes score higher than dynamic, deeply-nested ones.
 */
function promiseScore(routePath: string): number {
  const depth = routePath.split("/").filter(Boolean).length;
  const dynamicPenalty = routePath.includes("[") ? 1000 : 0;
  return depth + dynamicPenalty;
}

/**
 * Enforce the total-input cap by dropping the least-promising routes first.
 * Returns the kept excerpts (in most-promising-first order).
 */
export function capTotalInput(
  items: RouteExcerpt[],
  total = TOTAL_CHAR_CAP,
): RouteExcerpt[] {
  const ordered = [...items].sort(
    (a, b) =>
      promiseScore(a.routePath) - promiseScore(b.routePath) ||
      a.routePath.localeCompare(b.routePath),
  );

  const kept: RouteExcerpt[] = [];
  let used = 0;
  for (const item of ordered) {
    const cost = item.routePath.length + item.excerpt.length;
    if (used + cost > total) continue;
    kept.push(item);
    used += cost;
  }
  return kept;
}

/**
 * Read each route's source file, trim it to the per-route cap, then enforce the
 * total cap by dropping the least-promising routes. `repoPath` + the route's
 * repo-relative sourceFile locate the file.
 */
export function collectRouteExcerpts(
  repoPath: string,
  routes: DiscoveredRoute[],
): RouteExcerpt[] {
  const items: RouteExcerpt[] = routes.map((r) => {
    const file = join(repoPath, r.sourceFile);
    let source = "";
    if (existsSync(file)) {
      try {
        source = readFileSync(file, "utf8");
      } catch {
        /* unreadable — send the path with an empty excerpt */
      }
    }
    return { routePath: r.routePath, excerpt: trimExcerpt(source) };
  });

  return capTotalInput(items);
}

/** Render the excerpts as a single user message. */
export function buildCaptionUserText(excerpts: RouteExcerpt[]): string {
  const blocks = excerpts.map(
    (e) => `ROUTE: ${e.routePath}\nSOURCE:\n${e.excerpt}`,
  );
  return [
    "Here are the discovered routes and their source excerpts:",
    "",
    blocks.join("\n\n---\n\n"),
  ].join("\n");
}

/**
 * Make the single caption call and return the validated plan plus token usage.
 * Exported so the request shape can be asserted against a stubbed client.
 */
export async function generateCaptions(
  client: CaptionClient,
  excerpts: RouteExcerpt[],
  model: string = CAPTION_MODEL,
): Promise<{ plan: CaptionPlan; usage: Anthropic.Usage }> {
  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    thinking: { type: "disabled" },
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "submit_captions",
        description: "Submit the per-route include decisions, ids, and captions.",
        input_schema:
          CAPTIONS_INPUT_SCHEMA as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "submit_captions" },
    messages: [{ role: "user", content: buildCaptionUserText(excerpts) }],
  });

  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === "submit_captions",
  );
  if (!block) {
    throw new Error("model did not return a submit_captions tool call");
  }

  const parsed = CaptionPlanSchema.safeParse(block.input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((iss) => `  - ${iss.path.join(".") || "(root)"}: ${iss.message}`)
      .join("\n");
    throw new Error(`Invalid caption plan:\n${issues}`);
  }

  return { plan: parsed.data, usage: response.usage };
}
