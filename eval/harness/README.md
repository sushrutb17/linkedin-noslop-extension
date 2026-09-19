# Evaluation harness

Runs `docs/EVALUATION.md`'s rubric against `eval/examples/batch-001.jsonl` using the real TypeSafe/Jev API, and writes a run report to `eval/runs/`.

## Setup

```sh
cd eval/harness
npm install
cp .env.example .env   # then edit .env yourself and paste in your own TYPESAFE_API_KEY — do not share this key in chat or commit it
```

`.env` is git-ignored at the repo root. The client reads `TYPESAFE_API_KEY` automatically (before a real run, check TypeSafe's [pricing and rate limits](https://docs.typesafe.ai/models.md); at the time of writing: $0.042 per million input tokens, free output, 1,200 requests/minute).

## Run

```sh
node run.mjs --dry-run        # sanity-checks the pipeline, no network calls, no cost, no key needed
node run.mjs --dry-run --rubric=v1  # preserved ten-question baseline, also no network
node --env-file=.env run.mjs                 # real run, all 30 examples
node --env-file=.env run.mjs --limit 5        # real run, first 5 examples only (cheap smoke test)
```

The default rubric is `v2-experimental`: the original ten questions plus three 0–2 diagnostic Scores (`redundant_restatement`, `decorative_explanation`, `relationship_obscurity`). Use `--rubric=v1` for a separately reproducible baseline request. Invalid rubric names fail before API calls.

The three new Scores have **zero filtering weight**. Decision rules remain v2 and ignore their values. With identical baseline answers, diagnostic changes cannot change decisions or reasons. Adding questions can still affect the model's baseline answers, so equivalent live decisions require comparison rather than assumption. No new API run has established the candidates' semantic accuracy or usefulness.

## Output

Each real run writes `eval/runs/<timestamp>.json` (raw per-example results, including every question's raw answer) and `eval/runs/<timestamp>.md` (a human-readable report following `EVALUATION.md`'s run report template).

The report includes per-example diagnostic scores and their zero-weight status. Older v1 artifacts and failed requests show `not available`; absence is never interpreted as a zero score. Existing artifacts remain unchanged. Obtain a fresh held-out split before evaluating new rules: EX-021 from the original held-out split was used to tune v2.

**Read the provenance caveat before trusting the numbers**: `eval/examples/README.md`'s "Label provenance" section explains why this batch's labels are a rubric sanity check, not evidence the rubric matches your real preferences.

## Files

- `rubric.mjs` — default experimental question set (`RUBRIC_VERSION = v2-experimental`), mirrors `docs/EVALUATION.md`.
- `rubric-v1.mjs` — preserved original baseline question set and version.
- `decide.mjs` — the versioned decision rules (`DECISION_RULES_VERSION`) that combine narrow per-question answers into keep/filter/uncertain in code, per `AGENTS.md`.
- `run.mjs` — loads examples, calls the API with bounded concurrency (5), computes metrics, writes the report.
- `report.mjs` — shared metrics/report rendering, including optional diagnostics.

Run `npm test` for offline SDK-construction, cached-decision invariance, and diagnostic availability checks. These tests make no network calls and do not measure model accuracy.

Bump `RUBRIC_VERSION`/`DECISION_RULES_VERSION` whenever either changes, so old run reports stay interpretable.
