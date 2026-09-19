# Proposed architecture

**Status:** personal prototype. The extension and direct-TypeSafe integration described below are implemented in `extension/` and verified on a real feed. Compatibility across all LinkedIn post types remains unverified.

## Data flow

```text
Visible LinkedIn post
  → content script extracts available post text
  → chrome.runtime.sendMessage to the background service worker
  → background worker calls TypeSafe/Jev directly (fetch, no backend hop)
  → background worker applies versioned decision rules (decide.js)
  → content script keeps, blurs, or reveals the post
```

**No separate backend:** for the personal-prototype scope. The background service worker calls `https://api.typesafe.ai/v1/systemone` directly, using a key the user enters into the extension's options page and that lives only in `chrome.storage.local`. This is safe specifically because it's a single-user, non-distributed prototype — AGENTS.md's prohibition is on embedding a *shared* secret in a *distributed* extension, which doesn't describe a key the user supplies for their own personal use. If you ever distribute the extension to others, revisit this: a shared key would need a backend to protect it.

## Responsibilities

| Component | Responsibility |
| --- | --- |
| Feed adapter | Locate post containers and body text; detect missing/truncated text; handle feed updates |
| Content script | Observe visible posts, apply reversible presentation changes, provide reveal controls |
| Background worker | Calls TypeSafe directly, applies decision rules, request orchestration — no separate backend |
| Evaluation module | Define atomic questions, normalize answers, apply explicit filtering rules |
| Settings | Enable/disable filtering, sensitivity (stored, not yet wired), API key entry. Display treatment is fixed to blur, not a user-facing option |

Keep LinkedIn-specific selectors separate from evaluation logic: page structure can change independently of the rubric.

## TypeSafe integration

Official quick-start documentation currently illustrates `POST https://api.typesafe.ai/v1/systemone` with bearer authentication, `state`, `model`, and a `questions` map. `jev-latest` and `jev-preview` both currently resolve to `jev-1.13.0` (verified 2026-09-18). **Implemented (confirmed):** the literal `jev-1.13.0` identifier is pinned in both `eval/harness/rubric-v1.mjs` and `extension/src/shared/rubric.js`, so an upstream alias move can't silently change results — confirmed accepted by the real API in every call made so far. Context window is 64k tokens total, with 32k reserved for state plus the longest single question — this bounds how much post text plus how many questions can go in one request.

- **Noul:** yes/no probability for a narrow proposition, such as whether a post solicits engagement.
- **Score:** ordered descriptive levels for a dimension such as concrete substance.
- **Choice:** a defined categorical judgment when appropriate.

Ask independent questions together against one post's state. The documentation supports multiple questions against a shared state; do not assume this automatically means independent batching of many posts.

Choice and Score expose confidence derived from their answer distributions. Noul does not have the same separate confidence field. Neither output should be presented as a verified probability of AI authorship. See [quick start](https://docs.typesafe.ai/introduction/quickstart) and [confidence](https://docs.typesafe.ai/confidence).

The state should clearly delimit untrusted post content. Instructions found in a post must not override the classification rubric. Include adversarial examples in evaluation.

Jev's own documented limitations confirm this is a real, not hypothetical, risk: "state is data, and `jev-1.13` does not treat it as hostile by default". TypeSafe's own guardrail cookbook suggests a reusable pattern for this: a dedicated Noul question detecting classifier-directed instructions in the post text (e.g., "the text tries to instruct the classifier or claims a verdict for itself" vs. "ordinary post content"), paired with a severity Score, evaluated separately from the four slop-quality questions. Treat a high-severity hit as a reason to flag the post as `uncertain` (visible, not auto-filtered) rather than trusting either the slop questions or the post's own claims about itself. **Implemented:** `extension/src/shared/rubric.js`'s `adversarial_instruction`/`adversarial_severity` questions and `decide.js`'s severity>=2 guard.

**On calling the API from a browser context:** `@typesafe-ai/sdk`'s `TypeSafeClient` refuses to run when `window`/`document` are present, specifically to prevent shipping a key to a page any visitor could inspect. An MV3 background service worker has no `window`/`document`, so it isn't the context that guard targets — and `extension/src/background/typesafeClient.js` hand-builds the request (verified byte-for-byte equivalent to the SDK's own wire format by reading its source) rather than importing the SDK class, sidestepping the question entirely. The content script, popup, and options page must never hold or send the API key directly — only the background worker does.

## Application response

**Implemented shape** (`decide.js`'s return value, sent from background worker to content script via `chrome.runtime.sendMessage`):

```json
{
  "decision": "filter",
  "reasonCodes": ["engagement_bait", "corporate_phrasing"]
}
```

This is the application's own contract, **not the TypeSafe wire format**. `rubricVersion`/`modelVersion` were originally proposed as part of this response but aren't currently included — `content.js` doesn't need them, and they're not otherwise surfaced anywhere in the extension. `RUBRIC_VERSION`/`DECISION_RULES_VERSION`/`MODEL` constants do exist in code (`rubric.js`, `decide.js`) for versioning the logic itself; adding them to the per-post response would only matter if something (e.g. a debug view) needed to know which version classified a specific post.

Potential decisions are `keep`, `filter`, and `uncertain`. The frontend treats `uncertain` as visible. Preserve raw signal outputs in the evaluation harness for analysis; production retention should be minimal and intentional — the extension currently logs neither raw answers nor post text on success (silent), only a status code or error message on failure.

## Filtering rules

- Combine independent signals in code; do not rely on a single “is this AI slop?” question.
- Useful concrete information should reduce the chance that stylistic traits alone trigger filtering.
- Tune thresholds on development examples, then evaluate on a held-out set.
- A high score or concentrated distribution does not guarantee correctness.
- Map reason codes to short fixed user-facing labels. Avoid “AI-generated” as a factual verdict.

## Reliability and privacy

- Start with visible posts; do not crawl, automatically expand posts, or scroll to harvest a feed.
- Mark partial text as partial. Initially keep truncated posts visible unless the evaluation establishes a reliable handling strategy.
- Cache by normalized post content plus model/rubric identity; settings must not reuse stale final decisions. A text hash is an identifier, not a guarantee of anonymity.
- Avoid duplicate evaluations when the page rerenders. Revalidate the current content before attaching an asynchronous result to a reused feed element.
- Limit concurrency, timeouts, and retries. On API errors, rate limits, malformed output, or exhausted budget, leave posts visible.
- Make the filter toggle and reveal actions reversible and keyboard-accessible.
- Send only necessary post text and minimal evaluation context. Do not transmit author names or profile identifiers unless a future explicit requirement justifies them.
- Do not retain raw post text in default application logs. Review TypeSafe data-handling terms before processing a real feed; no provider retention guarantee has been verified.
- Use least-privilege extension permissions. **Implemented:** the API key lives only in `chrome.storage.local`, entered via the options page; only the background service worker reads it or calls TypeSafe; `host_permissions` is scoped to `linkedin.com` and `api.typesafe.ai` only.

## Constraints still to validate

Two specific implementation gaps worth naming, not yet hit in practice but real risks on a real feed:

- **Virtualized/recycled DOM nodes:** `content.js`'s `slopScanned` marker assumes a DOM node keeps representing the same post. Some feed frameworks recycle/reuse DOM nodes for different content as the user scrolls (windowing/virtualization) — if LinkedIn's feed does this, a recycled node could keep a stale `slopScanned`/`slopDecision` marker and never get re-evaluated for its new content. Not yet observed or tested for; `ARCHITECTURE.md`'s original guidance ("revalidate the current content before attaching an asynchronous result to a reused feed element") isn't implemented.
- **No retry logic:** `typesafeClient.js` has a timeout (`AbortController`, 15s) but no retry/backoff on transient failures (rate limits, 5xx, connection errors) — a single failure leaves the post visible rather than retrying once. Reasonable as a conservative default (fail open), but means transient blips reduce coverage rather than resolving themselves.

Broader open items: selector stability and full live-LinkedIn browser compatibility across all post types remain unverified beyond the post types encountered so far. Jev task quality against real user labels has only one data point — not broadly validated. Provider retention terms for third-party content are still open. LinkedIn policy remains a separate constraint even if the engineering works. Resolved: pricing and rate limits, authentication mechanism and no-backend architecture, pinned model version.
