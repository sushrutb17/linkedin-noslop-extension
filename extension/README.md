# Extension (working personal prototype)

Chrome, Manifest V3, blur display. Built as a personal prototype that runs with your own API key; not published to any extension store.

## Status

**Working end-to-end on a real LinkedIn feed** (tested 2026-09-18): real posts get blurred with a reason, and "Show post" reveals them individually. `src/background/typesafeClient.js` calls `https://api.typesafe.ai/v1/systemone` directly from the background service worker — there is no separate backend, because each user supplies their own key. Set your API key in the options page; without one, posts stay visible (fail-safe).

Selectors in `src/content/content.js` (`SELECTOR`, `TEXT_SELECTOR`) are real, derived from real LinkedIn post markup and confirmed working live. They rely on `role`, `componentkey`, and `data-testid` attributes rather than LinkedIn's auto-generated CSS class names, which change between builds. Only verified against the post types that appeared in one feed so far; image-only, poll, and article/newsletter posts specifically aren't separately confirmed.

Blurred posts get a red outline and a diagonal "AI SLOP" corner ribbon (`.slop-filter-banner` in `styles.css`).

`src/shared/placeholderClassifier.js` still exists but is only used by the offline fixture now (real network calls cost real money, however small — the fixture stays free to run repeatedly).

Known, deliberate gaps (not bugs):
- Sensitivity control in the options page is stored but not wired to `decide.js`'s thresholds yet.
- No bounded-concurrency limiter across simultaneous classify calls, and no cross-page-load caching by content hash — only per-DOM-node dedup (`slopScanned`). On a fast-scrolling real feed this could fire many requests at once (planned, not built).
- No retry/backoff on transient failures (rate limits, 5xx) — a single failure leaves the post visible rather than retrying once (`docs/ARCHITECTURE.md`'s "Constraints still to validate").
- `slopScanned`'s dedup assumes a DOM node keeps representing the same post; if LinkedIn recycles DOM nodes for different content during virtualized scrolling, a recycled node could keep a stale marker (not yet observed or tested for — see `docs/ARCHITECTURE.md`).

## Why the background service worker, specifically

`@typesafe-ai/sdk`'s `TypeSafeClient` refuses to run when `window`/`document` are present — a real guard against shipping an API key to a page any visitor could inspect via devtools (verified by reading the SDK source of `@typesafe-ai/sdk@0.6.0`). An MV3 background service worker has neither, so it isn't that context. `content.js`, `popup.js`, and `options.js` must never hold or send the API key directly — only `typesafeClient.js`, in the background worker, does. `typesafeClient.js` hand-builds the request instead of importing the SDK class (verified byte-for-byte equivalent to the SDK's own wire format from source), avoiding both the ambiguity and an npm dependency in the extension bundle.

## Try it

**Offline fixture (no extension install, no API key, no cost):**
```sh
cd extension            # NOT extension/fixtures — feed.html loads ../src/... relatively,
python3 -m http.server 8765   # so the server root has to be extension/ or those 404.
# open http://localhost:8765/fixtures/feed.html
```
Toggle "Filter enabled" to see blur/reveal both directions; "Simulate new post arriving" exercises the `MutationObserver` path. Uses the placeholder classifier, not real TypeSafe. Verified 2026-09-18 with headless-Chromium Playwright — no console errors.

**As a real unpacked Chrome extension:**
1. `chrome://extensions` -> enable Developer mode -> "Load unpacked" -> select the `extension/` folder. If you're updating an already-loaded copy, hit the reload icon here — unpacked extensions don't hot-reload on file changes.
2. Open the extension's options page, paste your TypeSafe API key, Save.
3. Go to `https://www.linkedin.com/feed/` and refresh. Real posts should start blurring within a few seconds where the rubric flags them, with a "Show post" button and a diagonal ribbon.

## Why content.js duplicates postFilter.js

MV3 content scripts can't use static `import` (only background service workers support `"type": "module"`), so the presentation logic is intentionally duplicated in `content.js` for a prototype this size rather than adding a bundler. Keep both in sync if either changes; a bundler (esbuild) is a reasonable addition if this grows — `shared/rubric.js` and `shared/decide.js` are already plain ES modules imported cleanly by `background.js`, since service workers don't have this restriction.
