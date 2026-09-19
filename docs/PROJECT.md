# Project brief

## User intent

Build a browser add-on that reduces “AI slop” in the user's LinkedIn feed by hiding or blurring posts. Use TypeSafe AI's Jev model as the intended evaluation engine.

The requested sequence is feasibility → planning → implementation. The current deliverable is shared project documentation that preserves context across agents and coding tools.

## Feasibility findings

- Browser content scripts can inspect and modify rendered page content, enabling per-post overlays or collapsed cards. See [Chrome documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).
- Jev accepts state and typed questions, including Choice, Score, and Noul, with multiple questions in one request. This interface fits a multi-signal filter. Its accuracy on this task remains untested. See [TypeSafe introduction](https://docs.typesafe.ai/introduction).
- Text classification cannot establish AI authorship reliably enough to promise a perfect AI detector. Position this as preference-based content filtering. See [OpenAI's classifier limitations](https://openai.com/index/new-ai-classifier-for-indicating-ai-written-text/).
- LinkedIn's published policy prohibits extensions that scrape, modify appearance, or automate activity. This is a material distribution constraint, not solved by choosing Jev or avoiding a backend. See [LinkedIn policy](https://www.linkedin.com/help/linkedin/answer/a1341387).

## Proposed first version

These defaults are proposals, not user-confirmed implementation decisions:

- Chrome desktop first, using Manifest V3.
- English text posts in the main feed first.
- A single filtering toggle and a sensitivity control.
- Blur or collapse a flagged post with a short reason and a one-click reveal action.
- Leave posts visible when evaluation is uncertain, unavailable, or lacks sufficient text.
- Evaluate newly visible posts and cache unchanged content during browsing.
- Use fixed reason labels derived from evaluated signals; do not generate accusations about an author.

Candidate signals: engagement bait, generic filler, concrete substance, and formulaic storytelling. Formatting, emoji, polished grammar, or a single phrase should not independently determine a verdict.

## Example experience

1. The user enables the extension.
2. A post enters the visible feed and its available text is evaluated.
3. If the configured rules justify filtering, an overlay or compact card appears: “Filtered: engagement bait.”
4. “Show post” reveals the original content without changing the post itself.
5. Disabling the filter restores affected posts.

Exact wording, visual treatment, loading behavior, and sensitivity values remain to be designed.

**Implemented and confirmed working on a real feed (2026-09-18):** steps 1–5 above all happen for real now — see `extension/README.md`. Visual treatment ended up as blur + a red outline + a diagonal "AI SLOP" ribbon, with the filter reason shown as fixed labels (e.g. "Filtered: formulaic_storytelling, vague_sourcing"). Sensitivity values are still undesigned — the UI stub exists but isn't wired to anything.

## Outside the proposed MVP

- Proving whether a person used AI.
- Image, video, audio, or carousel-content analysis.
- Filtering comments, messages, profiles, notifications, or other social platforms.
- Automatically liking, commenting, reporting, posting, or messaging.
- Training a new model, personalization pipelines, billing, or public marketplace distribution.

## Success criteria

- On a held-out sample, the model mostly filters posts the user actually wants filtered and rarely hides useful posts. **Status:** only a single real post has been checked against a person's own keep/filter judgment (it matched); the synthetic batch is a plumbing sanity check only, not evidence toward this criterion. Not yet met at any meaningful sample size.
- The extension preserves navigation, scrolling, links, and reveal controls. **Status:** reveal/toggle confirmed working on the real feed; scroll/navigation/link preservation under real infinite-scroll not specifically stress-tested.
- API failures and uncertain decisions do not erase useful feed content. **Status:** implemented and verified (fail-safe `null` on any error, confirmed via a real no-key test).
- Response time and cost are measured on realistic posts before making performance claims. **Status:** real costs observed are trivial (~$0.002 across all testing so far); no systematic latency measurement done yet.
- A reproducible demo can show filtering and recovery with consented or synthetic content. **Status:** not started.

## Open choices

| Choice | Current position |
| --- | --- |
| Definition of slop | Needs user-labeled examples and rubric iteration |
| Browser | Confirmed: Chrome, Manifest V3 |
| Display | Confirmed: blur |
| Model/version | Jev confirmed as `jev-1.13.0` (current `jev-latest`); pinning literal version proposed |
| Access and budget | Pricing ($0.042/M input tokens, output free) and rate limits (250k tok/s, 1200 req/min) now documented; each user supplies their own key |
| Deployment | Confirmed: no separate backend; extension's background service worker calls TypeSafe directly, user-entered key in `chrome.storage.local` |
| Privacy | Minimize text sent and avoid default raw-text retention; TypeSafe doesn't train on customer data and offers enterprise zero-retention, but standard retention duration and third-party-content-specific terms still need review of the full DPA |
| Launch scope | Personal prototype; not published to any extension store |
| Branding | Working description only; no final name |

Resolve choices when they materially affect the next phase. Do not block useful documentation or offline evaluation design on deployment details.
