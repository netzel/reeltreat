import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractBrand } from "../brand.js";

let repo: string;

function file(rel: string, contents: string): void {
  const full = join(repo, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "reeltreat-brand-"));
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("extractBrand", () => {
  it("prefers CSS variables named primary/accent and finds a logo", () => {
    file(
      "app/globals.css",
      `:root {
        --primary: #0B5FFF;
        --accent: #00C2A8;
        --background: #ffffff;
      }
      .btn { color: var(--primary); }`,
    );
    file("public/logo.svg", "<svg/>");

    const brand = extractBrand(repo);
    expect(brand.primaryColor).toBe("#0B5FFF");
    expect(brand.accentColor).toBe("#00C2A8");
    expect(brand.logoPath).toBe("./public/logo.svg");
  });

  it("falls back to the most frequent non-neutral hex colors", () => {
    file(
      "src/index.css",
      `.a { color: #ff0000; }
       .b { border-color: #ff0000; }
       .c { background: #00ff00; }
       .d { color: #ffffff; background: #000000; }`,
    );

    const brand = extractBrand(repo);
    expect(brand.primaryColor).toBe("#ff0000"); // most frequent
    expect(brand.accentColor).toBe("#00ff00");
  });

  it("returns empty output when nothing matches, inventing nothing", () => {
    file("src/index.css", `.a { color: #ffffff; background: #000000; }`);
    const brand = extractBrand(repo);
    expect(brand.primaryColor).toBeUndefined();
    expect(brand.accentColor).toBeUndefined();
    expect(Object.keys(brand)).toHaveLength(0);
  });

  it("returns empty output for a repo with no stylesheets", () => {
    expect(extractBrand(repo)).toEqual({});
  });
});
