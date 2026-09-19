// Verbatim port of eval/harness/decide.mjs (pure JS, no Node-specific APIs,
// so this is a straight copy, not a reimplementation). Keep both in sync —
// bump DECISION_RULES_VERSION on either side if the logic changes.

export const DECISION_RULES_VERSION = "v2";

const NOUL_TRUE_THRESHOLD = 0.5;
const CONCRETE_SUBSTANCE_OVERRIDE = 1.7;
const FILTER_THRESHOLD = 3.0;
const KEEP_THRESHOLD = 1.7;

export function decide(answers) {
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
