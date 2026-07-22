import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  detectFramework,
  discoverRoutes,
  isDemoWorthy,
} from "../introspect.js";

let repo: string;

/** Write a file (and its parent dirs) relative to the fixture repo root. */
function file(rel: string, contents = "export default function P(){return null}"): void {
  const full = join(repo, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
}

function pkg(deps: Record<string, string>): void {
  file("package.json", JSON.stringify({ name: "fixture", dependencies: deps }));
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "reeltreat-introspect-"));
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

/** Convenience: map of routePath -> discovered route. */
function routeMap(framework: Parameters<typeof discoverRoutes>[1]) {
  return new Map(
    discoverRoutes(repo, framework).map((r) => [r.routePath, r]),
  );
}

describe("Next.js App Router", () => {
  beforeEach(() => {
    pkg({ next: "15.0.0" });
    file("app/page.tsx");
    file("app/dashboard/page.tsx");
    file("app/(marketing)/about/page.tsx"); // route group -> /about
    file("app/blog/[slug]/page.tsx"); // dynamic
    file("app/api/health/route.ts"); // API route -> excluded
    file("app/dashboard/loading.tsx"); // not a page -> excluded
    file("app/dashboard/layout.tsx"); // not a page -> excluded
    file("app/_internal/page.tsx"); // private folder -> excluded
    file("app/login/page.tsx"); // auth -> not demo-worthy
  });

  it("detects the framework", () => {
    expect(detectFramework(repo)).toBe("next-app");
  });

  it("discovers pages and strips route groups from the URL", () => {
    const routes = routeMap("next-app");
    expect([...routes.keys()].sort()).toEqual([
      "/",
      "/about",
      "/blog/[slug]",
      "/dashboard",
    ]);
  });

  it("flags dynamic routes with their segment names", () => {
    const routes = routeMap("next-app");
    const blog = routes.get("/blog/[slug]")!;
    expect(blog.isDynamic).toBe(true);
    expect(blog.dynamicSegments).toEqual(["slug"]);
    expect(routes.get("/dashboard")!.isDynamic).toBe(false);
  });

  it("excludes api routes, private folders, layouts/loading, and auth pages", () => {
    const keys = [...routeMap("next-app").keys()];
    expect(keys).not.toContain("/api/health");
    expect(keys).not.toContain("/_internal");
    expect(keys).not.toContain("/login");
    // layout/loading never appear because only `page` files are considered.
  });
});

describe("Next.js Pages Router", () => {
  beforeEach(() => {
    pkg({ next: "14.0.0" });
    file("pages/index.tsx");
    file("pages/about.tsx");
    file("pages/blog/[id].tsx"); // dynamic
    file("pages/api/hello.ts"); // API -> excluded
    file("pages/_app.tsx"); // underscore -> excluded
    file("pages/_document.tsx"); // underscore -> excluded
  });

  it("detects the framework (pages/ but no app/)", () => {
    expect(detectFramework(repo)).toBe("next-pages");
  });

  it("maps index to root and excludes api/underscore files", () => {
    const routes = routeMap("next-pages");
    expect([...routes.keys()].sort()).toEqual(["/", "/about", "/blog/[id]"]);
    expect(routes.get("/blog/[id]")!.dynamicSegments).toEqual(["id"]);
  });
});

describe("SvelteKit", () => {
  beforeEach(() => {
    pkg({ "@sveltejs/kit": "2.0.0" });
    file("src/routes/+page.svelte", "<h1>home</h1>");
    file("src/routes/about/+page.svelte", "<h1>about</h1>");
    file("src/routes/blog/[slug]/+page.svelte", "<h1>post</h1>");
    file("src/routes/(app)/settings/+page.svelte", "<h1>settings</h1>");
    file("src/routes/blog/+layout.svelte", "<slot/>"); // not a page
  });

  it("detects the framework and discovers +page.svelte routes", () => {
    expect(detectFramework(repo)).toBe("sveltekit");
    const routes = routeMap("sveltekit");
    expect([...routes.keys()].sort()).toEqual([
      "/",
      "/about",
      "/blog/[slug]",
      "/settings",
    ]);
    expect(routes.get("/blog/[slug]")!.dynamicSegments).toEqual(["slug"]);
  });
});

describe("Vite + React", () => {
  it("detects the framework but discovers no filesystem routes", () => {
    pkg({ vite: "5.0.0", react: "18.0.0", "react-dom": "18.0.0" });
    file("src/App.tsx");
    file("src/main.tsx");
    expect(detectFramework(repo)).toBe("vite-react");
    expect(discoverRoutes(repo, "vite-react")).toEqual([]);
  });
});

describe("unknown projects", () => {
  it("detects unknown and returns no routes gracefully", () => {
    pkg({ express: "4.0.0" });
    expect(detectFramework(repo)).toBe("unknown");
    expect(discoverRoutes(repo, "unknown")).toEqual([]);
  });

  it("returns unknown when there is no package.json", () => {
    expect(detectFramework(repo)).toBe("unknown");
  });
});

describe("isDemoWorthy", () => {
  it("rejects api and auth-flow paths, keeps real features", () => {
    expect(isDemoWorthy("/dashboard")).toBe(true);
    expect(isDemoWorthy("/api/users")).toBe(false);
    expect(isDemoWorthy("/login")).toBe(false);
    expect(isDemoWorthy("/sign-in")).toBe(false);
    expect(isDemoWorthy("/auth/callback")).toBe(false);
  });
});
