// PLACEHOLDER classifier for offline UI development only. NOT connected to
// TypeSafe/Jev and not the real rubric (that's eval/harness/rubric.mjs +
// decide.mjs, run offline against the labeled batch). This is a crude
// keyword heuristic so the presentation layer (blur/reveal/toggle) has
// something to render against in the offline fixture.
//
// Never use this on the live path.
// Do not treat this file's output as a quality signal about real posts.

const BAIT_PATTERNS = [
  /comment\s+['"]?\w+['"]?\s+below/i,
  /like\s+(this\s+)?post\s+if/i,
  /which\s+\w+\s+are\s+you/i,
  /nobody\s+tells\s+you/i,
  /steal\s+these/i,
  /save\s+this\s+post/i,
];

export function placeholderClassify(text) {
  const hit = BAIT_PATTERNS.some((re) => re.test(text));
  if (hit) {
    return { decision: "filter", reasonCodes: ["engagement_bait"] };
  }
  return { decision: "keep", reasonCodes: [] };
}
