// Decision rules — combines the narrow per-question answers from rubric.mjs
// into keep/filter/uncertain, in code rather than via a single broad model
// question, per AGENTS.md's "use narrow questions for individual signals;
// combine the answers with explicit code" rule.
//
// v1's thresholds (slopScore>=4 filter, <=1 keep, concrete>=2 override) were
// designed assuming near-integer scores. The real API returns continuous
// "expected score" floats (per the JS SDK docs: "may fall between integer
// rubric levels"), which made v1 land almost every post in the 2-3 gap as
// "uncertain" (0% coverage on a 5-example smoke test, 47% on the full
// 30-example run — see eval/runs/2026-09-18T20-25-35-530Z.md). v2's
// thresholds are retuned against that same run's actual answer distribution.
//
// IMPORTANT CAVEAT: eval/examples/batch-001.jsonl's labels are agent-drafted
// and user-approved-as-a-batch, not independently reviewed (see its
// README's "Label provenance" note) — so this is tuning against a
// synthetic/circular signal, not real user preference. Re-tune again once
// genuine (real or independently-reviewed) labels exist; don't read v2's
// numbers as validated accuracy.
//
// One specific disagreement found while tuning, left unresolved on purpose:
// two adversarial-instruction posts in the batch (EX-026, EX-028) were
// drafted with label "filter" (reasoning: manipulation itself is bad-faith
// and low-value), but the severity guard below routes any high-severity
// adversarial hit to "uncertain" regardless, per ARCHITECTURE.md's
// conservative default ("leave uncertain evaluations visible").
// The guard's behavior was kept as-is; the labels look like the more
// questionable side of that disagreement, not the code.

export const DECISION_RULES_VERSION = "v2";

const NOUL_TRUE_THRESHOLD = 0.5;
// Softened from the v1 exact "== max score" check: a continuous score
// essentially never hits the literal maximum, so >=2 almost never fired
// (e.g. two genuinely concrete posts scored 1.98/1.99 and missed it).
const CONCRETE_SUBSTANCE_OVERRIDE = 1.7;
// Tuned to sit strictly above the highest observed slopScore among posts
// labeled "keep" in this run (EX-021, a satire post, at 2.82) with a small
// margin, and strictly below the lowest observed "filter" slopScore beyond
// that gap (EX-003 at 3.63). This deliberately leaves some true-filter
// posts (EX-001/002/005, slop 2.68-2.95) as "uncertain" misses rather than
// risk misfiring on borderline posts like EX-021 — matching EVALUATION.md's
// stated priority: "avoiding unwanted hiding over catching every low-value
// post."
const FILTER_THRESHOLD = 3.0;
const KEEP_THRESHOLD = 1.7;

export function decide(answers) {
  // A high-severity attempt to instruct the classifier overrides everything
  // else: don't trust the post's own framing in either direction.
  if (answers.adversarial_severity.score >= 2) {
    return {
      decision: "uncertain",
      reasonCodes: ["adversarial_instruction_detected"],
    };
  }

  const concrete = answers.concrete_substance.score;
  const filler = answers.generic_filler.score;
  const corporate = answers.corporate_phrasing_density.score;

  const baitFlags = [
    ["engagement_bait", answers.engagement_bait],
    ["formulaic_storytelling", answers.formulaic_storytelling],
    ["formulaic_rhetorical_hook", answers.formulaic_rhetorical_hook],
    ["fake_profound_framing", answers.fake_profound_framing],
    ["vague_sourcing", answers.vague_sourcing],
  ].filter(([, a]) => a.noul >= NOUL_TRUE_THRESHOLD);

  // Concrete substance is a strong override: real content should not be
  // filtered on style alone (PROJECT.md: "concrete substance should reduce
  // the chance that stylistic traits alone trigger filtering").
  if (concrete >= CONCRETE_SUBSTANCE_OVERRIDE) {
    return { decision: "keep", reasonCodes: ["concrete_substance_high"] };
  }

  const slopScore = baitFlags.length + filler + corporate;
  const reasonCodes = baitFlags.map(([name]) => name);
  if (filler >= 1.5) reasonCodes.push("generic_filler");
  if (corporate >= 1.5) reasonCodes.push("corporate_phrasing");

  if (slopScore >= FILTER_THRESHOLD) {
    return { decision: "filter", reasonCodes };
  }
  if (slopScore <= KEEP_THRESHOLD) {
    return { decision: "keep", reasonCodes: [] };
  }
  return { decision: "uncertain", reasonCodes };
}
