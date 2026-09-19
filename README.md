# LinkedIn NoSlop

A Chrome extension (Manifest V3) that uses [TypeSafe AI](https://docs.typesafe.ai/introduction)'s Jev model to spot low-value LinkedIn feed posts and blur them, with a one-click "Show post" to reveal any of them.

It is a working personal prototype, shared as a starting point for building your own filter. "Slop" here means *your* definition of low-value content — engagement bait, generic filler, formulaic storytelling — not a claim that a post was written by AI.

## How it works

1. A content script finds feed posts on `linkedin.com/feed` and extracts only the post text.
2. The background service worker sends that text to TypeSafe/Jev with a rubric of narrow yes/no and 0–2 questions (`extension/src/shared/rubric.js`).
3. Plain code combines the answers into `keep`, `filter`, or `uncertain` (`extension/src/shared/decide.js`). Only `filter` blurs a post; anything uncertain, incomplete, or failed stays visible.
4. Blurred posts show the reason and a "Show post" button.

## Quick start

**Try it offline first (no API key, no cost):**
```sh
cd extension
python3 -m http.server 8765
# open http://localhost:8765/fixtures/feed.html
```

**Run it on your real feed:**
1. Get a TypeSafe API key from the TypeSafe dashboard.
2. Open `chrome://extensions`, enable Developer mode, click "Load unpacked", and choose the `extension/` folder.
3. Open the extension's options page, paste your key, and save. The key stays in your browser's local extension storage.
4. Visit `https://www.linkedin.com/feed/` and refresh.

See [`extension/README.md`](extension/README.md) for details and known gaps.

## Make it your own

- **Change what counts as slop:** edit the questions in `extension/src/shared/rubric.js` and the thresholds in `extension/src/shared/decide.js`. Bump the version constants when you do.
- **Measure before you trust it:** label some posts yourself and run them through the offline harness in [`eval/harness/`](eval/harness/README.md). The included 30 examples are synthetic sanity checks, not proof of accuracy — see [`eval/examples/README.md`](eval/examples/README.md).
- **Cost:** at the time of writing Jev charged $0.042 per million input tokens with free output; a full 30-post evaluation run used about 37k input tokens. Check current [pricing](https://docs.typesafe.ai/models.md) yourself.

## Documents

| Document | Purpose |
| --- | --- |
| [Project brief](docs/PROJECT.md) | Intent, scope, product behavior, and open questions |
| [Architecture](docs/ARCHITECTURE.md) | System design, constraints, and failure handling |
| [Evaluation](docs/EVALUATION.md) | How to test whether the filter matches your definition of slop |
| [Agent instructions](AGENTS.md) | Rules for AI coding tools working on this repo |

## Important caveats

- **LinkedIn policy:** LinkedIn [prohibits](https://www.linkedin.com/help/linkedin/answer/a1341387) extensions that modify its appearance. Running this locally does not change that. Use it at your own risk; it is not distributed through any store.
- **Your own key only:** the extension calls TypeSafe directly from the background worker with the key you enter. Never ship a build with a shared key embedded — anyone could extract it.
- **No automation:** the filter only reads and blurs. It never likes, comments, messages, scrolls, or posts.
- **Accuracy is unproven:** there is no validated accuracy figure. Judge it against your own labeled posts.

## References

- [TypeSafe introduction](https://docs.typesafe.ai/introduction) · [quick start](https://docs.typesafe.ai/introduction/quickstart) · [confidence](https://docs.typesafe.ai/confidence) · [Jev 1.13 limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md) · [guardrails cookbook](https://docs.typesafe.ai/cookbooks/llm_guardrails.md)
- [Chrome extension content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop) and [sergebulaev/linkedin-skills](https://github.com/sergebulaev/linkedin-skills) — named writing-pattern catalogs that inspired several rubric questions

## License

[MIT](LICENSE). The license covers this code only; using TypeSafe/Jev is subject to TypeSafe's own terms, and running the extension on LinkedIn is subject to LinkedIn's.
