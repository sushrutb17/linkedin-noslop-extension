// MV3 content script. Classic script, not a module: unlike background
// service workers, content_scripts in the manifest don't support a "type":
// "module" key, so this can't use static `import` against shared/postFilter.js
// without a bundler. For this prototype's size, the small amount of
// presentation logic is duplicated here rather than adding a build step —
// keep this in sync with src/shared/postFilter.js if either changes.
//
// Selectors below verified 2026-09-18 against one real feed post's markup
// (not stored in this repo, since it contained a real person's post). LinkedIn's own CSS-module classnames
// (hashed, e.g. "e5616576") are NOT used here — they look auto-generated
// per build and would break on any redeploy. `role`/`componentkey`/
// `data-testid` attributes looked far more stable and are used instead.
// Still only verified against ONE post snapshot; LinkedIn may vary this by
// post type (video/image/poll/article) or run A/B tests. Re-verify if
// posts stop being detected.
(function () {
  const SELECTOR = 'div[role="listitem"][componentkey^="update-card-"]';
  // The post body text lives specifically here, scoped away from
  // surrounding UI chrome (author name, reaction/comment counts, and —
  // critically — an embedded video's player controls, which otherwise
  // pollute `card.textContent` with strings like "Mute", "Fullscreen", or
  // caption-menu option names).
  const TEXT_SELECTOR = '[data-testid="expandable-text-box"]';
  // Finding from the real post inspected: LinkedIn's "…more" truncation is
  // a CSS line-clamp toggle, not a content loader — the full text is
  // already present in TEXT_SELECTOR's DOM node whether or not "…more" was
  // clicked. No separate truncation-skip heuristic is needed for that
  // reason; MIN_TEXT_LENGTH below still covers genuinely short/image-only
  // posts (ARCHITECTURE.md: "Mark partial text as partial... keep
  // truncated posts visible" — here, "truncated" in the sense of missing
  // content, e.g. no TEXT_SELECTOR match at all, or very little text).
  const MIN_TEXT_LENGTH = 40;
  // MutationObserver on a fast-scrolling infinite feed can fire very
  // frequently; the browser already batches mutation records into one
  // callback per microtask, but a small debounce on top avoids scanning on
  // every single intermediate DOM tweak during a burst of changes.
  const SCAN_DEBOUNCE_MS = 150;

  let enabled = true;
  let debounceTimer = null;

  chrome.storage.local.get(["slopFilterEnabled"], (res) => {
    enabled = res.slopFilterEnabled !== false;
    if (enabled) scan();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.slopFilterEnabled) return;
    enabled = changes.slopFilterEnabled.newValue !== false;
    if (enabled) {
      scan();
    } else {
      document.querySelectorAll(SELECTOR).forEach(revealCard);
    }
  });

  function scheduleScan() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scan, SCAN_DEBOUNCE_MS);
  }

  function scan() {
    if (!enabled) return;
    document.querySelectorAll(SELECTOR).forEach((card) => {
      if (card.dataset.slopScanned) return;
      card.dataset.slopScanned = "1";

      const text = extractPostText(card);
      if (text.length < MIN_TEXT_LENGTH) {
        // No text body found (image/video/poll-only post) or too little to
        // evaluate meaningfully. Never sent to the classifier — nothing
        // useful to send anyway, and keeps text transmission minimal
        // (ARCHITECTURE.md).
        card.dataset.slopDecision = "uncertain";
        return;
      }

      chrome.runtime.sendMessage({ type: "CLASSIFY_POST", text }, (response) => {
        // ARCHITECTURE.md: on any failure/no-answer, leave the post visible.
        if (chrome.runtime.lastError || !response) return;
        applyDecision(card, response);
      });
    });
  }

  // Reads the post body text, excluding the "…more" toggle button's own
  // label (it's UI chrome, not post content, and it's a descendant of
  // TEXT_SELECTOR's element per the real markup this was verified against).
  function extractPostText(card) {
    const textEl = card.querySelector(TEXT_SELECTOR);
    if (!textEl) return "";
    const clone = textEl.cloneNode(true);
    clone.querySelectorAll('[data-testid="expandable-text-button"]').forEach((btn) => btn.remove());
    return clone.textContent.trim();
  }

  function applyDecision(cardEl, { decision, reasonCodes = [] }) {
    cardEl.dataset.slopDecision = decision;
    removeOverlay(cardEl);
    if (decision !== "filter") {
      cardEl.classList.remove("slop-filter-blurred");
      return;
    }
    const overlay = buildOverlay(reasonCodes);
    cardEl.appendChild(overlay);
    cardEl.classList.add("slop-filter-blurred");
  }

  function buildOverlay(reasonCodes) {
    const overlay = document.createElement("div");
    overlay.className = "slop-filter-overlay";

    const ribbonWrap = document.createElement("div");
    ribbonWrap.className = "slop-filter-ribbon-wrap";
    const banner = document.createElement("div");
    banner.className = "slop-filter-banner";
    banner.textContent = "AI SLOP";
    ribbonWrap.appendChild(banner);

    const reasonEl = document.createElement("span");
    reasonEl.className = "slop-filter-reason";
    reasonEl.textContent = `Filtered: ${reasonCodes.join(", ") || "Low-value post"}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "slop-filter-reveal";
    button.textContent = "Show post";
    button.addEventListener("click", () => revealCard(overlay.closest(SELECTOR)));

    overlay.append(ribbonWrap, reasonEl, button);
    return overlay;
  }

  function revealCard(cardEl) {
    if (!cardEl) return;
    cardEl.classList.remove("slop-filter-blurred");
    removeOverlay(cardEl);
    cardEl.dataset.slopDecision = "revealed";
  }

  function removeOverlay(cardEl) {
    const existing = cardEl.querySelector(":scope > .slop-filter-overlay");
    if (existing) existing.remove();
  }

  // LinkedIn's feed is a client-rendered, infinitely-scrolling SPA — new
  // post cards appear without a page navigation. ARCHITECTURE.md: "avoid
  // duplicate evaluations when the page rerenders" — the `slopScanned`
  // marker above prevents re-classifying the same card node.
  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });

  // Cleanup: content scripts are torn down automatically by the browser on
  // navigation/unload, so there's no explicit teardown call needed for the
  // observer itself — but a pending debounced scan would otherwise fire
  // into a torn-down page. Clear it defensively.
  window.addEventListener("pagehide", () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    observer.disconnect();
  });
})();
