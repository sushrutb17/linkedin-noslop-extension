// Minimal hand-rolled TypeSafe/Jev client for the MV3 background service
// worker. Not using @typesafe-ai/sdk directly — see rubric.js's header
// comment for why (its refuseBrowser() guard, and the verified wire format
// not needing the SDK at all). Wire format verified 2026-09-18 by reading
// the SDK source directly, not just its docs (a doc example once showed
// score() criteria as an object map; the SDK actually requires an array).
import { RUBRIC_VERSION, MODEL, buildQuestions } from "../shared/rubric.js";
import { DECISION_RULES_VERSION, decide } from "../shared/decide.js";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const TIMEOUT_MS = 15000;

export async function classifyPost(text) {
  const { typesafeApiKey } = await chrome.storage.local.get(["typesafeApiKey"]);
  // ARCHITECTURE.md: any failure — including "not configured yet" — leaves
  // the post visible. Never a filter decision.
  if (!typesafeApiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${typesafeApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        state: { post_text: text },
        model: MODEL,
        questions: buildQuestions(),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Rate limit, auth failure, malformed request, server error, etc.
      // ARCHITECTURE.md: leave visible on any API error.
      console.warn(`[slop-filter] TypeSafe request failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return decide(data.answers);
  } catch (err) {
    // Network error, timeout/abort, or malformed JSON response.
    console.warn("[slop-filter] TypeSafe request error:", err?.message ?? err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const CLIENT_INFO = { RUBRIC_VERSION, DECISION_RULES_VERSION, MODEL };
