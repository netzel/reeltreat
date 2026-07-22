// Config for `remotion studio` (see `npm run studio`). Programmatic rendering in
// src/render.ts passes the same override to bundle() directly.
import { Config } from "@remotion/cli/config";
import { withEsbuildTsconfig } from "./remotion/webpack-override";

Config.overrideWebpackConfig(withEsbuildTsconfig);
