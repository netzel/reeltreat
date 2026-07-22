/**
 * Force Remotion's esbuild-loader to use an explicit `tsconfigRaw`, so it never
 * calls the classic `typescript` JS API. This repo pins TypeScript 7 (the native
 * preview), whose npm package has no `ts.sys` / `ts.readConfigFile` — exactly the
 * calls the loader makes when a `typescript` module is resolvable and
 * `tsconfigRaw` is unset, which would crash the bundle. Presetting `tsconfigRaw`
 * skips that path entirely and also pins the JSX transform to the automatic
 * runtime regardless of any tsconfig on disk.
 *
 * The types here are intentionally structural (only the bits we touch) to avoid
 * coupling to Remotion's exact webpack config typing across versions.
 */

interface LoaderUse {
  loader?: string;
  options?: Record<string, unknown>;
}
interface WebpackLike {
  module?: { rules?: unknown[] };
}

export function withEsbuildTsconfig<T extends WebpackLike>(config: T): T {
  const rules = config.module?.rules;
  if (Array.isArray(rules)) {
    for (const rule of rules) {
      const use = (rule as { use?: unknown }).use;
      if (!Array.isArray(use)) continue;
      for (const u of use as LoaderUse[]) {
        if (u && typeof u.loader === "string" && u.loader.includes("esbuild-loader")) {
          u.options = {
            ...(u.options ?? {}),
            tsconfigRaw: {
              compilerOptions: { jsx: "react-jsx", jsxImportSource: "react" },
            },
          };
        }
      }
    }
  }
  return config;
}
