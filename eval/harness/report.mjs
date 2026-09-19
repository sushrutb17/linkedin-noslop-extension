// Shared metrics/report code — used by both run.mjs (live API calls) and
// rescore.mjs (reapply decide.mjs to cached answers, no network/cost).
// Metric definitions follow docs/EVALUATION.md's "Metrics" section.
import { DIAGNOSTIC_SIGNALS } from "./rubric.mjs";

export function renderDiagnostics(results) {
  const rows = results.map((r) => {
    const scores = DIAGNOSTIC_SIGNALS.map((name) => {
      const value = r.answers?.[name]?.score;
      return Number.isFinite(value) ? value.toFixed(3) : "not available";
    });
    return `| ${r.id} | ${scores.join(" | ")} |`;
  });
  return `## Experimental diagnostics (zero filtering weight)
These 0–2 Scores do not contribute to decide.mjs v2. Given identical baseline answers, changing these values leaves the decision unchanged. Adding questions to an API request may affect baseline model answers; compare separate baseline and experimental runs before claiming equivalent live behavior. Missing scores in older v1 runs or failed requests are reported as not available, never as zero.

| Example | ${DIAGNOSTIC_SIGNALS.join(" | ")} |
| --- | ${DIAGNOSTIC_SIGNALS.map(() => "---").join(" | ")} |
${rows.join("\n")}`;
}

export function computeMetrics(results) {
  const total = results.length;
  const failed = results.filter((r) => r.error);
  const ok = results.filter((r) => !r.error);
  const abstentions = ok.filter((r) => r.decision === "uncertain");

  const coverage = { numerator: ok.filter((r) => r.decision !== "uncertain").length, denominator: total };
  const failureRate = { numerator: failed.length, denominator: total };

  const filteredDefinitive = ok.filter((r) => r.decision === "filter" && r.userLabel !== "unsure");
  const precision = {
    numerator: filteredDefinitive.filter((r) => r.userLabel === "filter").length,
    denominator: filteredDefinitive.length,
  };

  const userKeep = ok.filter((r) => r.userLabel === "keep");
  const falsePositiveRate = {
    numerator: userKeep.filter((r) => r.decision === "filter").length,
    denominator: userKeep.length,
  };

  const userFilter = ok.filter((r) => r.userLabel === "filter");
  const recall = {
    numerator: userFilter.filter((r) => r.decision === "filter").length,
    denominator: userFilter.length,
  };

  const latencies = ok.map((r) => r.latencyMs).filter((n) => typeof n === "number").sort((a, b) => a - b);
  const median = latencies.length ? latencies[Math.floor(latencies.length / 2)] : undefined;
  const p95 = latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] : undefined;

  const totalUsage = ok.reduce(
    (acc, r) => {
      const u = r.usage ?? {};
      acc.input += u.inputTokens ?? u.input_tokens ?? 0;
      acc.output += u.outputTokens ?? u.output_tokens ?? 0;
      return acc;
    },
    { input: 0, output: 0 },
  );

  return {
    total,
    coverage,
    failureRate,
    abstentionCount: abstentions.length,
    precision,
    falsePositiveRate,
    recall,
    latencyMs: { median, p95, sampleSize: latencies.length },
    usage: totalUsage,
  };
}

export function formatRatio(r) {
  if (!r || r.denominator === 0) return `undefined (0/0)`;
  return `${(r.numerator / r.denominator * 100).toFixed(1)}% (${r.numerator}/${r.denominator})`;
}

export function renderReport({ runId, rubricVersion, decisionRulesVersion, model, dryRun, rescoredFrom, overall, dev, heldOut, results }) {
  const mistakes = results.filter(
    (r) => !r.error && r.userLabel !== "unsure" && r.decision !== "uncertain" && r.decision !== r.userLabel,
  );
  return `# Evaluation run ${runId}

Run/date: ${runId}${rescoredFrom ? ` (rescored from ${rescoredFrom}, no new API calls)` : ""}
Dataset version and provenance: eval/examples/batch-001.jsonl — synthetic, agent-drafted labels approved as a batch by the user (NOT independently user-reviewed; see eval/examples/README.md "Label provenance"). Results below are a rubric sanity check, not evidence the rubric matches the user's real preferences.
Label counts and split: dev=${dev.total}, held_out=${heldOut.total}, total=${overall.total}
Model identifier: ${model}
Rubric and decision-rule versions: rubric ${rubricVersion}, decision rules ${decisionRulesVersion}
Thresholds/settings: see decide.mjs for the current version's exact thresholds and rationale
Dry run: ${dryRun}

## Overall
Filter precision (count/total): ${formatRatio(overall.precision)}
Useful-post false-positive rate (count/total): ${formatRatio(overall.falsePositiveRate)}
Filter recall (count/total): ${formatRatio(overall.recall)}
Coverage (count/total): ${formatRatio(overall.coverage)}
Failure rate (count/total): ${formatRatio(overall.failureRate)}
Abstentions: ${overall.abstentionCount}
Median/p95 latency and sample size: ${overall.latencyMs.median ?? "n/a"}ms / ${overall.latencyMs.p95 ?? "n/a"}ms (n=${overall.latencyMs.sampleSize})
Usage (input/output tokens, summed): ${overall.usage.input} / ${overall.usage.output}

## Held-out split only
Filter precision: ${formatRatio(heldOut.precision)}
Useful-post false-positive rate: ${formatRatio(heldOut.falsePositiveRate)}
Filter recall: ${formatRatio(heldOut.recall)}
Coverage: ${formatRatio(heldOut.coverage)}

## Representative mistakes (decision != user label, excluding "unsure" and abstentions)
${mistakes.length === 0 ? "None" : mistakes.map((m) => `- ${m.id}: user=${m.userLabel}, model=${m.decision}, reasons=[${m.reasonCodes.join(", ")}]`).join("\n")}

${renderDiagnostics(results)}

## Conclusion and next experiment
Not filled in automatically — synthetic/circular-labeled batch (see provenance note above). Do not use this run alone to decide whether automatic filtering is supported; that requires a genuinely user-labeled batch per docs/EVALUATION.md.
`;
}
