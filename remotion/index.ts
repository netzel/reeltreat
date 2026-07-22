import { registerRoot } from "remotion";
import { Root } from "./Root";

// registerRoot must live in its own entry file, separate from the composition
// list, to avoid re-registration during Fast Refresh (see /docs/register-root).
registerRoot(Root);
