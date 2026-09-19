// Evaluation harness for docs/EVALUATION.md. Reads a labeled JSONL batch,
// calls TypeSafe/Jev with the rubric in rubric.mjs, applies the decision
// rules in decide.mjs, and writes a run report under eval/runs/.
//
// On any per-request failure (network, rate limit exhausted, malformed
// response) the post is recorded as an abstention/failure and never
// silently treated as "filter" — ARCHITECTURE.md: "leave posts visible" on
// API errors or uncertainty.
//
// Usage:
//   node --env-file=.env run.mjs                 # real run against TYPESAFE_API_KEY
//   node --env-file=.env run.mjs --limit 5        # first 5 examples only
//   node run.mjs --dry-run                        # no network calls, no key needed
//
// To retune decide.mjs's thresholds without spending more API budget, use
// rescore.mjs against an existing run's .json instead of re-running this.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as experimentalRubric from "./rubric.mjs";
import * as baselineRubric from "./rubric-v1.mjs";
import { DECISION_RULES_VERSION, decide } from "./decide.mjs";
import { computeMetrics, renderReport } from "./report.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLES_PATH = path.join(__dirname, "..", "examples", "batch-001.jsonl");
const RUNS_DIR = path.join(__dirname, "..", "runs");

const args = process.argv.slice(2);
const rubricArg = args.find((a) => a === "--rubric" || a.startsWith("--rubric="));
const rubricName = rubricArg ? (rubricArg.split("=")[1] ?? args[args.indexOf(rubricArg) + 1]) : "v2-experimental";
if (!["v1", "v2-experimental"].includes(rubricName)) {
  throw new Error("--rubric must be v1 or v2-experimental");
}
const { RUBRIC_VERSION, MODEL, buildQuestions } = rubricName === "v1" ? baselineRubric : experimentalRubric;
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit"));
const limit = limitArg ? Number(limitArg.split("=")[1] ?? args[args.indexOf(limitArg) + 1]) : undefined;

const CONCURRENCY = 5;

async function loadExamples() {
  const raw = await readFile(EXAMPLES_PATH, "utf8");
  const rows = raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
  return typeof limit === "number" && Number.isFinite(limit) ? rows.slice(0, limit) : rows;
}

async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function evaluateOne(client, example) {
  const questions = buildQuestions();
  const started = Date.now();
  try {
    const result = await client.systemOne({
      state: { post_text: example.text },
      model: MODEL,
      questions,
    });
    const latencyMs = Date.now() - started;
    const { decision, reasonCodes } = decide(result.answers);
    return {
      id: example.id,
      split: example.split,
      userLabel: example.label,
      decision,
      reasonCodes,
      modelUsed: result.model,
      usage: result.usage,
      latencyMs,
      answers: result.answers,
      error: null,
    };
  } catch (err) {
    const latencyMs = Date.now() - started;
    return {
      id: example.id,
      split: example.split,
      userLabel: example.label,
      decision: "uncertain",
      reasonCodes: [],
      modelUsed: null,
      usage: null,
      latencyMs,
      answers: null,
      error: { name: err?.name ?? "Error", message: err?.message ?? String(err) },
    };
  }
}

async function main() {
  const examples = await loadExamples();

  if (dryRun) {
    const questions = buildQuestions();
    console.log(`[dry run] ${examples.length} examples, ${Object.keys(questions).length} questions per request, rubric ${RUBRIC_VERSION}, model ${MODEL}`);
    for (const ex of examples.slice(0, 3)) {
      console.log(`  ${ex.id} [${ex.category_hint}] state.post_text=${JSON.stringify(ex.text.slice(0, 80))}${ex.text.length > 80 ? "..." : ""}`);
    }
    console.log("[dry run] no API calls made, no cost incurred.");
    return;
  }

  const { TypeSafeClient } = await import("@typesafe-ai/sdk");
  const client = new TypeSafeClient();

  const results = await mapWithConcurrency(examples, CONCURRENCY, (ex) => evaluateOne(client, ex));

  const dev = results.filter((r) => r.split === "dev");
  const heldOut = results.filter((r) => r.split === "held_out");
  const overall = computeMetrics(results);
  const devMetrics = computeMetrics(dev);
  const heldOutMetrics = computeMetrics(heldOut);

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  await mkdir(RUNS_DIR, { recursive: true });
  await writeFile(path.join(RUNS_DIR, `${runId}.json`), JSON.stringify({ runId, rubricVersion: RUBRIC_VERSION, decisionRulesVersion: DECISION_RULES_VERSION, model: MODEL, results }, null, 2));
  const report = renderReport({ runId, rubricVersion: RUBRIC_VERSION, decisionRulesVersion: DECISION_RULES_VERSION, model: MODEL, dryRun: false, overall, dev: devMetrics, heldOut: heldOutMetrics, results });
  await writeFile(path.join(RUNS_DIR, `${runId}.md`), report);

  console.log(report);
  console.log(`Full raw results: eval/runs/${runId}.json`);
}

main().catch((err) => {
  console.error("Harness failed:", err);
  process.exitCode = 1;
});
