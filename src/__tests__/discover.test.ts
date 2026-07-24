import { describe, expect, it } from "vitest";
import { linksToRoutes, type PageLink } from "../discover.js";

const BASE = "https://bytyme.vercel.app";
const link = (href: string, text = ""): PageLink => ({ href, text });

describe("linksToRoutes", () => {
  it("always includes the home route even with no links", () => {
    const routes = linksToRoutes([], BASE);
    expect(routes).toEqual([{ path: "/", id: "home", caption: "Home" }]);
  });

  it("keeps same-origin HTML routes and derives ids + captions", () => {
    const routes = linksToRoutes(
      [
        link("https://bytyme.vercel.app/pricing", "Pricing"),
        link("/dashboard", "Your dashboard"),
        link("/settings/profile"),
      ],
      BASE,
    );
    const byPath = Object.fromEntries(routes.map((r) => [r.path, r]));
    expect(byPath["/pricing"]).toEqual({ path: "/pricing", id: "pricing", caption: "Pricing" });
    expect(byPath["/dashboard"].caption).toBe("Your dashboard");
    // No link text → caption falls back to the title-cased last segment.
    expect(byPath["/settings/profile"]).toEqual({
      path: "/settings/profile",
      id: "settings-profile",
      caption: "Profile",
    });
  });

  it("drops cross-origin, non-http, asset, and auth/api links", () => {
    const routes = linksToRoutes(
      [
        link("https://twitter.com/bytyme", "Twitter"), // cross-origin
        link("mailto:hi@bytyme.app", "Email"), // non-http
        link("/logo.png", "logo"), // asset
        link("/_next/static/x.js"), // build asset
        link("/login", "Log in"), // auth (isDemoWorthy)
        link("/api/health"), // api
        link("/features", "Features"), // keep
      ],
      BASE,
    );
    expect(routes.map((r) => r.path).sort()).toEqual(["/", "/features"]);
  });

  it("de-duplicates by path (ignoring query, hash, and trailing slash)", () => {
    const routes = linksToRoutes(
      [
        link("/pricing", "Pricing"),
        link("/pricing/", "Pricing again"),
        link("/pricing?ref=nav#top", "Pricing nav"),
      ],
      BASE,
    );
    expect(routes.filter((r) => r.path === "/pricing")).toHaveLength(1);
  });

  it("makes ids unique when two paths slugify the same", () => {
    const routes = linksToRoutes([link("/a/b"), link("/a-b")], BASE);
    const ids = routes.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });

  it("caps the number of routes", () => {
    const many = Array.from({ length: 30 }, (_, i) => link(`/p${i}`));
    expect(linksToRoutes(many, BASE, { max: 5 })).toHaveLength(5);
  });

  it("ignores overly long link text and falls back to the segment", () => {
    const routes = linksToRoutes(
      [link("/pricing", "x".repeat(200))],
      BASE,
    );
    expect(routes.find((r) => r.path === "/pricing")?.caption).toBe("Pricing");
  });
});
