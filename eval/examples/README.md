# Labeled examples

`batch-001.jsonl` is a synthetic starter batch (30 posts, one JSON object per line) covering the category mix `docs/EVALUATION.md` calls for: engagement bait, generic filler, useful specific posts, short-but-valuable posts, satire, incomplete/image-dependent text, and adversarial instruction-embedded posts. Every post is fictional — written for this project, not scraped from real LinkedIn content. No real people, companies, or posts are represented.

**These are synthetic fixtures, not real evaluation data.** Per `EVALUATION.md`, results from this batch must be reported separately from any evaluation against real or consented posts, and should not be used alone to support a public accuracy claim.

## Label provenance (important caveat)

`label`/`rationale` in this file were **drafted by an AI assistant**, not independently labeled by a person. They were derived from named AI-writing-pattern catalogs such as [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop) — the same sources several rubric questions in `EVALUATION.md` come from — and accepted as a batch without per-row review.

This means any evaluation run against this batch measures agreement between Jev and the agent's own pattern heuristic, not against any person's actual taste — the labels and the questions share a source, so agreement is partly circular. Treat results from this batch as a rough sanity check on the rubric's internal consistency only, not as evidence the rubric matches your preferences, and do not cite it in place of the real user-labeled evaluation `EVALUATION.md`'s procedure calls for. `split` (`dev`/`held_out`) is pre-assigned roughly 2:1.

EX-027 was labeled `unsure` (not `filter`) because it's genuinely ambiguous even under the pattern heuristic: it embeds a fake "SYSTEM OVERRIDE" directive but also claims ordinary content behind it that isn't visible in the text.

To evaluate against your own taste, add a new batch file with posts you labeled yourself (fictional, or used with consent) and run the harness against it.
