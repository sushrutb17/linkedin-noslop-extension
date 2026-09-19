import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildQuestions as buildBaselineQuestions, RUBRIC_VERSION as BASELINE_VERSION } from "./rubric-v1.mjs";
import { buildQuestions, DIAGNOSTIC_SIGNALS, RUBRIC_VERSION } from "./rubric.mjs";
import { decide } from "./decide.mjs";
import { renderDiagnostics } from "./report.mjs";

test("experimental builder retains all ten baseline questions and creates three SDK Scores", () => {
  const baseline = buildBaselineQuestions();
  const experimental = buildQuestions();
  assert.equal(BASELINE_VERSION, "v1");
  assert.equal(RUBRIC_VERSION, "v2-experimental");
  assert.equal(Object.keys(baseline).length, 10);
  assert.equal(Object.keys(experimental).length, 13);
  for (const [name, question] of Object.entries(baseline)) {
    assert.deepEqual(experimental[name], question);
  }
  for (const name of DIAGNOSTIC_SIGNALS) {
    assert.equal(experimental[name].type, "score");
    assert.equal(experimental[name].criteria.length, 3);
    assert.ok(experimental[name].criteria.every((level) => typeof level === "string"));
  }
});

test("diagnostic extremes leave cached decisions and reason codes unchanged", async () => {
  const run = JSON.parse(await readFile(new URL("../runs/2026-09-18T20-25-35-530Z.json", import.meta.url), "utf8"));
  const usable = run.results.filter((r) => !r.error && r.answers);
  assert.equal(usable.length, 30);
  for (const result of usable) {
    const baselineDecision = decide(result.answers);
    // Exercise all eight combinations, including conflicting diagnostic levels.
    for (let mask = 0; mask < 8; mask++) {
      const diagnostics = Object.fromEntries(DIAGNOSTIC_SIGNALS.map((name, i) => [name, { score: mask & (1 << i) ? 2 : 0 }]));
      assert.deepEqual(decide({ ...result.answers, ...diagnostics }), baselineDecision, result.id);
    }
  }
});

test("reports distinguish measured zero from absent, failed, and invalid diagnostics", () => {
  const report = renderDiagnostics([
    { id: "measured", answers: { redundant_restatement: { score: 0 }, decorative_explanation: { score: 1.25 }, relationship_obscurity: { score: 2 } } },
    { id: "old-v1", answers: {} },
    { id: "failed", answers: null, error: { name: "Error" } },
    { id: "invalid", answers: { redundant_restatement: { score: NaN } } },
  ]);
  assert.match(report, /zero filtering weight/);
  assert.ok(report.includes("| measured | 0.000 | 1.250 | 2.000 |"));
  for (const id of ["old-v1", "failed", "invalid"]) {
    assert.ok(report.includes(`| ${id} | not available | not available | not available |`));
  }
});
