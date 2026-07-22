# Evals

Checked-in evaluations for reeltreat's AI curation step. They are **opt-in** and
make a real (billable) Claude API call, so they are excluded from `npm test`.

## Running

```sh
# Requires ANTHROPIC_API_KEY in the environment (or a .env file, see below).
RUN_EVALS=1 npx vitest run --config evals/vitest.config.ts
```

With a `.env` file:

```sh
RUN_EVALS=1 node --env-file=.env node_modules/vitest/vitest.mjs run --config evals/vitest.config.ts
```

Without `RUN_EVALS=1` the eval suite is skipped (no API call, no cost).

## What's covered

- **`curation.eval.ts`** — generates three tiny solid-color PNG fixtures at run
  time with sharp (no binary screenshots of any real app are committed), sends
  them through the real curation call, and asserts the result is schema-valid,
  the tagline is within 90 characters, the hero shot is one of the fixtures, and
  the 15-second cut's per-shot seconds sum to within tolerance.
