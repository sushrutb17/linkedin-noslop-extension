# Classifier evaluation

**Status:** the default `v2-experimental` rubric in `eval/harness/rubric.mjs` includes the 10 baseline questions plus three diagnostic Score questions. The original 10-question rubric is preserved in `eval/harness/rubric-v1.mjs`. Decision rules v2 in `eval/harness/decide.mjs` do not use the new scores. Two historical real API runs and a cached v2 rescore exist in `eval/runs/`; they used rubric v1, not the new experimental rubric. Their synthetic, agent-drafted labels support a plumbing sanity check, not validated real-world accuracy.

## Question to answer

Does Jev identify posts this user wants filtered while preserving posts they find useful?

Do not evaluate whether Jev can prove AI authorship. The label is a content preference, not an author attribute.

## Initial sample

Start with 30–50 manually supplied or consented post examples. Include synthetic examples for early wiring, but report synthetic-only results separately from realistic evaluation. Do not automatically collect a feed to build the dataset.

`eval/examples/batch-001.jsonl` is a first synthetic starter batch (30 posts) covering the categories below. Its `label` fields were drafted by an AI assistant from the pattern catalogs below and accepted without independent row-by-row review — see `eval/examples/README.md`'s "Label provenance" note. Treat results from this batch as a rubric sanity check, not as evidence the rubric matches anyone's real preferences; that still requires the genuinely user-labeled evaluation this document's procedure describes.

Include a mix of:

- Obvious engagement bait and generic motivational filler.
- Specific, useful posts written in polished or formulaic language.
- Short announcements, hiring posts, personal stories, and promotional posts that may still be valuable.
- Satire and posts quoting or criticizing engagement bait.
- Incomplete text, very short posts, and content whose meaning depends on an image.
- Instructions inside a post attempting to influence the classifier.

The user should label examples before seeing model predictions. A suggested record contains an ID, text, `keep` / `filter` / `unsure` label, a short rationale, available-context notes, source type, and development/held-out split. Avoid author identifiers. Keep real text out of a publicly shared repository unless sharing is authorized.

## Candidate questions

| Dimension | Draft question | Proposed primitive |
| --- | --- | --- |
| Engagement bait | Does the post primarily ask for engagement to unlock content or inflate interaction? | Noul |
| Generic filler | How much of the post is vague advice that could apply almost anywhere? | Score |
| Concrete substance | How much specific, relevant information or actionable detail does the post provide? | Score |
| Formulaic storytelling | Does the post rely on a contrived story to deliver a generic lesson? | Noul |

Write clear descriptive levels for each Score rubric before running it. Score substance visible in the supplied text; do not imply external fact-checking. Assess language in context rather than treating punctuation or catchphrases as proof.

Jev 1.13's documented limitations constrain how these questions should be phrased: state edge cases explicitly rather than relying on implied scope, since the model interprets instructions literally; avoid double negatives and multi-hop phrasing, which measurably reduce accuracy; and do not assume a Noul question and its logical negation will sum to 1.0 — test each direction independently rather than deriving one from the other.

**Adversarial-instruction question (separate from the four slop-quality dimensions):** following TypeSafe's guardrails cookbook, add one Noul question detecting whether the post text itself tries to instruct or influence the classifier (e.g., "the text contains instructions directed at an AI classifier or asserts its own verdict" vs. "ordinary post content"), paired with a 0–3 severity Score. A high-severity hit should route to `uncertain` regardless of the slop-quality answers. Include this question in the initial sample's adversarial examples, and evaluate it against held-out data the same way as the other dimensions before trusting it.

## Writing-pattern questions implemented in rubric v1

External references — [`petergyang/no-ai-slop`](https://github.com/petergyang/no-ai-slop) and [`sergebulaev/linkedin-skills`](https://github.com/sergebulaev/linkedin-skills) — catalog specific, checkable rhetorical and lexical patterns rather than claiming to detect AI authorship. That framing matches this project's own boundary: flag checkable patterns, not authorship. The following four dimensions are implemented in rubric v1 and were included in the existing synthetic API runs. Their usefulness against independent user labels remains unvalidated. Some existing questions group several patterns together; a future rubric should separate them for diagnosis without automatically counting each as an independent filtering vote.

| Dimension | Draft question | Proposed primitive |
| --- | --- | --- |
| Formulaic rhetorical hook | Does the post open with, or structure itself around, a scripted device — a binary contrast ("It's not X, it's Y"), a colon reveal, or a rhetorical question-answer pair — instead of stating the point directly? | Noul |
| Fake-profound framing | Does the post use inflated importance language ("marks a pivotal moment," "a testament to") or end on a dramatic aphorism-style kicker instead of a concrete point? | Noul |
| Vague sourcing / performed authority | Does the post cite unnamed authority ("experts agree," "studies show") or frame itself as revealing insight ("what nobody tells you") without naming a concrete source? | Noul |
| Generic corporate phrasing density | How much of the post's language is generic filler (e.g. "leverage," "robust," "game changer," "delve," "at the end of the day") versus concrete, specific language? | Score |

These are lexical/rhetorical-pattern checks, not proof of AI authorship — the same boundary that applies to the four dimensions above. Test them against independent labels, and drop or reweight any that do not hold up against fresh held-out data; a pattern common in AI writing in general is not guaranteed to predict this user's filter/keep preference.

## Additional parameters implemented experimentally

These three questions are implemented in `v2-experimental` and included in future evaluation requests; their raw answers are retained in run JSON and their scores are shown as diagnostics in Markdown reports. They have **zero decision weight and no measured predictive benefit yet**. They are hypotheses about content quality, not AI authorship.

| Priority / parameter | Narrow Jev Score question | Proposed criteria indexed 0–2 | Distinction from existing signals |
| --- | --- | --- | --- |
| 1 — `redundant_restatement` | How much of the post repeats an earlier point without adding information? | 0: Each passage adds a distinct fact, example, reason, implication, action, or personal perspective. 1: Some passages repeat earlier points without adding information. 2: Repeated restatement occupies most of the post. | Repetition can occur even in topic-specific text that is not generic filler. |
| 2 — `decorative_explanation` | How much of the post's explanation labels a fact as meaningful without explaining the connection? | 0: Explanations identify a relationship, consequence, mechanism, or specific example; absence of explanation also scores 0. 1: Some explanations attach abstract significance without explaining the connection. 2: Most explanations attach abstract significance without explaining the connection. | Evaluates explanation in the body, beyond inflated framing or an aphorism ending. |
| 3 — `relationship_obscurity` | How clearly does the post describe the relationships it asserts? | 0: Asserted relationships are understandable from the text; no asserted relationships also scores 0. 1: Some asserted relationships leave an important role, action, or connection unclear. 2: Most asserted relationships leave roles, actions, or connections unclear. | Evaluates clarity of a connection rather than simply counting specific details or corporate words. |

Source mapping:

- `redundant_restatement`: no-ai-slop's interpretive metadiscourse and summary-recap endings; Humanizer's repeated closers and heading restatement.
- `decorative_explanation`: no-ai-slop's superficial analysis and interpretive metadiscourse; Humanizer's shallow “-ing” riders.
- `relationship_obscurity`: Humanizer's vague connection/association pattern; no-ai-slop's specificity/direct-verb principles; LinkedIn Humanizer's abstract noun stacks.

These patterns appear in the pinned [no-ai-slop skill](https://github.com/petergyang/no-ai-slop/blob/000650b156983f5159695b441477f4e63b25dc85/skills/no-ai-slop/SKILL.md), [Humanizer skill](https://github.com/blader/humanizer/blob/9862685f575c65a8247f90369951df1b3416e3d6/SKILL.md), and [LinkedIn scrub rules](https://github.com/sergebulaev/linkedin-skills/blob/baa9c909916f98764828e15e7cfc9dffa1aaadb1/skills/linkedin-humanizer/references/scrub-rules.md). Translating editing advice into evaluator dimensions is our proposal; those sources do not validate their predictive value for this user's preferences.

### Controls for every new question

Include the applicable exceptions explicitly in each question's instructions:

- Judge the author's use of a pattern; quoted examples being criticized, satire, and demonstrations do not count as endorsement.
- Useful recaps, definitions, accessibility explanations, and repetition that adds scope or a consequence are substantive.
- Technical terms count when they describe a specific relationship. A word such as “robust” or “leverage” is not independently a defect.
- Assess visible text only. Missing citations or numbers do not establish falsity or fabrication. No question evaluates AI authorship.
- Record partial or image-dependent context separately and preserve visibility. Do not invent the missing context.

### Candidates to defer or use only for diagnosis

Fragment stacks, empty triads, staged sincerity, and chat/draft residue may be recorded for diagnosis. They should have no filtering weight initially. Preserve three genuine steps, meaningful short sentences, real admissions, and technical posts quoting model wrappers. Emoji, dashes, curly quotes, passive voice, and sentence-length variation are not independent filtering criteria.

Unsupported superlatives largely overlap `fake_profound_framing` and corporate phrasing; refine those questions instead of adding another vote. Artificial urgency is a separate, lower-priority hypothesis rather than a named no-ai-slop pattern; real deadlines must be exempt. External claims about platform penalties, detector accuracy, “forensic” indicators, or single-hit thresholds were not independently verified and are not adopted as project facts.

### Experiment before changing filtering rules

1. Use the implemented `v2-experimental` rubric with zero decision weight for the three additions. Preserve rubric v1 and decision v2 as the baseline. Old v1 runs have no new diagnostic scores; rescoring old answers cannot supply them.
2. Obtain independent keep/filter/unsure labels before showing predictions. Include matched families with added repetition, decorative versus explicit explanation, and obscure versus clear relationships; keep variants together in one split.
3. Include useful technical posts, sparse announcements, satire, accessibility explanations, sincere personal stories, real deadlines, and partial context as counterexamples.
4. Compare the baseline with each candidate independently, then selected combinations. Report extra correctly filtered posts, new false positives, abstentions, latency, and usage with counts.
5. Tune only on development examples, then evaluate on fresh held-out data. Drop candidates that add no value beyond existing signals.

Do not append three more +1 flags to the current `slopScore`. These candidates overlap existing filler, substance, and framing signals, and Jev Scores are continuous expected values. Any adopted combination needs an explicit, versioned rule and evidence from the comparison above. No new filtering weights or thresholds are selected. Zero weight means identical baseline answers produce identical decisions; it does not guarantee that Jev returns identical baseline answers when three extra questions are included in a request.

## Procedure

**Existing split limitation:** `decide.mjs` identifies EX-021's score as an input to selecting the v2 filter threshold. EX-021 is in `batch-001.jsonl`'s `held_out` split. Consequently, that split is no longer untouched validation data for v2. Preserve the historical reports, but treat their held-out percentages as descriptive sanity-check results and obtain a fresh split for evaluating new parameters or thresholds.

1. Agree on a draft definition of slop and label examples.
2. Reserve roughly one-third as held-out examples before tuning. Keep close variants of a post in the same split.
3. Freeze the first rubric and record provider/model identity and run date.
4. Run all dimensions against each post and retain actual responses in local evaluation artifacts.
5. Tune decision rules only on development examples. Decide how uncertain outputs abstain from filtering.
6. Evaluate once on the held-out set. Review false positives and report counts alongside percentages.
7. If the rubric changes after examining held-out failures, treat that set as development data and obtain fresh held-out examples.

User labels of `unsure` should be reported separately rather than silently converted into a target class. Count model abstentions and API failures separately. Neither should be credited as correct filtering.

## Metrics

- **Filter precision:** user-labeled filter posts among all definitively labeled posts the model filters.
- **Useful-post false-positive rate:** user-labeled keep posts filtered, divided by all user-labeled keep posts.
- **Filter recall:** user-labeled filter posts actually filtered, divided by all user-labeled filter posts. Abstentions count as missed filters for this metric.
- **Coverage:** fraction of requests receiving a usable, non-abstaining decision.
- **Failure rate:** fraction of requests failing or returning unusable output.
- **Performance:** end-to-end median and p95 latency, request count, usage, and observed cost where available.

Always include numerators and denominators. State when a metric is undefined, such as precision when nothing was filtered. A 30–50-post sample supports an initial direction, not a general accuracy claim.

## Proposed progress gate

Prioritize avoiding unwanted hiding over catching every low-value post. As an initial working target, aim for at least 90% filter precision and at most 10% useful-post false positives on definitively labeled held-out examples, with nontrivial coverage and the raw counts disclosed. These are proposed targets, not approved or achieved results. Expand the dataset before public accuracy claims.

Latency and spending targets require measurements and a budget; do not invent acceptable costs or performance guarantees. If quality fails, improve the rubric or reduce automatic filtering before building a larger product around it.

## Run report template

```text
Run/date:
Dataset version and provenance:
Label counts and split:
Model identifier:
Rubric and decision-rule versions:
Thresholds/settings:
Filter precision (count/total):
Useful-post false-positive rate (count/total):
Filter recall (count/total):
Abstentions, failures, and coverage:
Median/p95 latency and sample size:
Usage and measured cost (or unavailable):
Representative mistakes:
Conclusion and next experiment:
```
