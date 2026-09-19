// Reapply the current decide.mjs to a previous run's cached answers, with no
// new API calls (decide() is a pure function of already-fetched answers).
// Use this whenever decision-rule thresholds change — no reason to spend
// API budget just to re-derive the same model answers.
//
// Usage: node rescore.mjs <path-to-run.json>
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DECISION_RULES_VERSION, decide } from "./decide.mjs";
import { computeMetrics, renderReport } from "./report.mjs";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node rescore.mjs <path-to-run.json>");
  process.exitCode = 1;
} else {
  const data = JSON.parse(await readFile(inputPath, "utf8"));

  const results = data.results.map((r) => {
    if (r.error || !r.answers) return r; // can't rescore a failed request
    const { decision, reasonCodes } = decide(r.answers);
    return { ...r, decision, reasonCodes };
  });

  const dev = results.filter((r) => r.split === "dev");
  const heldOut = results.filter((r) => r.split === "held_out");
  const overall = computeMetrics(results);
  const devMetrics = computeMetrics(dev);
  const heldOutMetrics = computeMetrics(heldOut);

  const runId = `${data.runId}-rescored-${DECISION_RULES_VERSION}`;
  const outDir = path.dirname(inputPath);
  await writeFile(
    path.join(outDir, `${runId}.json`),
    JSON.stringify({ runId, rubricVersion: data.rubricVersion, decisionRulesVersion: DECISION_RULES_VERSION, model: data.model, results }, null, 2),
  );
  const report = renderReport({
    runId,
    rubricVersion: data.rubricVersion,
    decisionRulesVersion: DECISION_RULES_VERSION,
    model: data.model,
    dryRun: false,
    rescoredFrom: data.runId,
    overall,
    dev: devMetrics,
    heldOut: heldOutMetrics,
    results,
  });
  await writeFile(path.join(outDir, `${runId}.md`), report);

  console.log(report);
}
