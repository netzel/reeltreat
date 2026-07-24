import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManifestSchema } from "../manifest.js";
import type { DiscoveredRoute } from "../introspect.js";
import {
  buildManifestYaml,
  buildTodoBlock,
  planShots,
  type ShotPlan,
} from "../init.js";
import {
  capTotalInput,
  generateCaptions,
  trimExcerpt,
  type CaptionClient,
  type CaptionPlan,
} from "../captions.js";

// Never construct or reach the real SDK — importing init.ts pulls it in.
vi.mock("@anthropic-ai/sdk", () => ({ default: class Anthropic {} }));

function route(
  routePath: string,
  opts: Partial<DiscoveredRoute> = {},
): DiscoveredRoute {
  const isDynamic = routePath.includes("[");
  return {
    routePath,
    sourceFile: `app${routePath === "/" ? "" : routePath}/page.tsx`,
    isDynamic,
    dynamicSegments: isDynamic ? ["slug"] : [],
    ...opts,
  };
}

describe("planShots", () => {
  const routes = [
    route("/"),
    route("/dashboard"),
    route("/blog/[slug]"),
  ];
  const plan: CaptionPlan = {
    routes: [
      { routePath: "/dashboard", include: true, id: "dashboard", caption: "Your workspace", priority: 1 },
      { routePath: "/", include: true, id: "home", caption: "Landing page", priority: 2 },
      { routePath: "/blog/[slug]", include: true, id: "blog-detail", caption: "A post", priority: 3 },
    ],
  };

  it("keeps included static routes, ordered by priority", () => {
    const { active } = planShots(routes, plan);
    expect(active.map((s) => s.id)).toEqual(["dashboard", "home"]);
    expect(active[0].path).toBe("/dashboard");
  });

  it("routes dynamic paths to the commented section with an <ID> placeholder", () => {
    const { active, dynamic }: ShotPlan = planShots(routes, plan);
    expect(active.some((s) => s.id === "blog-detail")).toBe(false);
    expect(dynamic).toHaveLength(1);
    expect(dynamic[0].path).toBe("/blog/<ID>");
    expect(dynamic[0].dynamicSegments).toEqual(["slug"]);
  });

  it("drops routes the model excluded", () => {
    const excluded: CaptionPlan = {
      routes: [
        { routePath: "/dashboard", include: false, id: "dashboard", caption: "x", priority: 1 },
        { routePath: "/", include: true, id: "home", caption: "y", priority: 1 },
      ],
    };
    const { active } = planShots(routes, excluded);
    expect(active.map((s) => s.id)).toEqual(["home"]);
  });
});

describe("buildManifestYaml", () => {
  const active = [
    { id: "home", path: "/", caption: 'Landing: "welcome"', priority: 1 },
    { id: "dashboard", path: "/dashboard", caption: "Your workspace", priority: 2 },
  ];

  it("parses cleanly through the manifest schema when dynamic routes are excluded", () => {
    const yaml = buildManifestYaml({
      project: "myapp",
      baseUrl: "http://localhost:3000",
      viewport: { width: 1440, height: 900 },
      brand: { primaryColor: "#0B5FFF" },
      active,
      dynamic: [],
    });

    const parsed = ManifestSchema.safeParse(parseYaml(yaml));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("myapp");
      expect(parsed.data.baseUrl).toBe("http://localhost:3000");
      expect(parsed.data.shots.map((s) => s.id)).toEqual(["home", "dashboard"]);
      expect(parsed.data.brand.primaryColor).toBe("#0B5FFF");
    }
  });

  it("includes a defaults block with a settle delay that parses through the schema", () => {
    const yaml = buildManifestYaml({
      project: "myapp",
      baseUrl: "http://localhost:3000",
      viewport: { width: 1440, height: 900 },
      brand: {},
      active,
      dynamic: [],
    });

    expect(yaml).toContain("defaults:");
    expect(yaml).toContain("delayMs: 2000");

    const parsed = ManifestSchema.parse(parseYaml(yaml));
    expect(parsed.defaults.delayMs).toBe(2000);
  });

  it("emits dynamic routes commented out at the bottom, never as active shots", () => {
    const yaml = buildManifestYaml({
      project: "myapp",
      baseUrl: "http://localhost:3000",
      viewport: { width: 1440, height: 900 },
      brand: {},
      active,
      dynamic: [
        { id: "blog-detail", path: "/blog/<ID>", caption: "A post", dynamicSegments: ["slug"] },
      ],
    });

    expect(yaml).toContain("# --- Dynamic routes: need a real id ---");
    expect(yaml).toContain("#    path: /blog/<ID>");

    // Commented dynamic routes must not appear in the parsed manifest.
    const parsed = ManifestSchema.parse(parseYaml(yaml));
    expect(parsed.shots.map((s) => s.id)).toEqual(["home", "dashboard"]);
  });

  it("uses the greppable base-url token and flags it via the doctor check when no url is given", () => {
    const yaml = buildManifestYaml({
      project: "myapp",
      baseUrl: "TODO_SET_BASE_URL",
      viewport: { width: 1440, height: 900 },
      brand: {},
      active,
      dynamic: [],
    });
    expect(yaml).toContain("baseUrl: TODO_SET_BASE_URL");
    // Placeholder base url is not a valid URL, so the schema must reject it.
    expect(ManifestSchema.safeParse(parseYaml(yaml)).success).toBe(false);
  });
});

describe("buildTodoBlock", () => {
  it("lists only the items that apply, with real counts", () => {
    const block = buildTodoBlock("myapp", true, 2);
    expect(block).toContain("TODO — 2 items before this will run");
    expect(block).toContain("1. Set baseUrl below");
    expect(block).toContain("2. Replace <ID> in the 2 dynamic routes");
  });

  it("uses singular wording for a single item", () => {
    const block = buildTodoBlock("myapp", false, 1);
    expect(block).toContain("TODO — 1 item before this will run");
    expect(block).toContain("Replace <ID> in the 1 dynamic route ");
  });

  it("says the manifest is ready when nothing needs editing", () => {
    const block = buildTodoBlock("myapp", false, 0);
    expect(block).toContain("ready to run");
    expect(block).not.toContain("TODO —");
  });
});

describe("excerpt capping", () => {
  it("trims a single excerpt to the cap", () => {
    expect(trimExcerpt("x".repeat(100), 10)).toHaveLength(10);
    expect(trimExcerpt("short", 10)).toBe("short");
  });

  it("drops the least-promising routes first when over the total cap", () => {
    const items = [
      { routePath: "/dashboard", excerpt: "a".repeat(50) },
      { routePath: "/settings/team/members", excerpt: "b".repeat(50) },
      { routePath: "/blog/[slug]", excerpt: "c".repeat(50) },
    ];
    // Room for roughly one item.
    const kept = capTotalInput(items, 70);
    expect(kept.map((k) => k.routePath)).toEqual(["/dashboard"]);
  });
});

describe("generateCaptions request shape", () => {
  function stubClient(input: unknown) {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "tool_use", name: "submit_captions", input }],
      usage: { input_tokens: 5, output_tokens: 7 },
    });
    return { create, client: { messages: { create } } as unknown as CaptionClient };
  }

  it("forces the submit_captions tool on claude-sonnet-5 with no live call", async () => {
    const { create, client } = stubClient({
      routes: [
        { routePath: "/", include: true, id: "home", caption: "Landing", priority: 1 },
      ],
    });

    const { plan } = await generateCaptions(client, [
      { routePath: "/", excerpt: "source" },
    ]);

    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0][0];
    expect(params.model).toBe("claude-sonnet-5");
    expect(params.tool_choice).toEqual({ type: "tool", name: "submit_captions" });
    expect(params.tools[0].name).toBe("submit_captions");
    expect(plan.routes[0].id).toBe("home");
  });

  it("rejects an invalid caption plan (bad slug id)", async () => {
    const { client } = stubClient({
      routes: [
        { routePath: "/", include: true, id: "Not A Slug", caption: "x", priority: 1 },
      ],
    });
    await expect(generateCaptions(client, [])).rejects.toThrow(/slug/);
  });
});

describe("init CLI overwrite protection", () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const project = "__init_overwrite_test__";
  const manifestPath = join(repoRoot, "projects", project, "manifest.yaml");

  afterEach(() => {
    rmSync(dirname(manifestPath), { recursive: true, force: true });
  });

  it("refuses to overwrite an existing manifest without --force", () => {
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, "name: existing\n");
    let status = 0;
    let stderr = "";
    try {
      // --repo points at this repo (it has a package.json) so the overwrite
      // guard is reached before any framework detection or network call.
      execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          join(repoRoot, "src", "init.ts"),
          project,
          "--repo",
          repoRoot,
        ],
        { cwd: repoRoot, encoding: "utf8", stdio: "pipe", timeout: 60000 },
      );
    } catch (err) {
      const e = err as { status?: number; stderr?: string };
      status = e.status ?? 1;
      stderr = e.stderr ?? "";
    }
    expect(status).not.toBe(0);
    expect(stderr).toContain("already exists");
  });
});
