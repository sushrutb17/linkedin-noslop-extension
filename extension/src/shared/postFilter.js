// Framework-agnostic presentation logic: blur a filtered post card, show a
// reveal control, and support toggling filtering off entirely. Used by both
// the real MV3 content script (content.js, which inlines this logic — see
// its header comment for why) and fixtures/feed-harness.js for offline
// visual testing without the extension installed.
//
// ARCHITECTURE.md: presentation changes must be fully reversible. This
// module never removes or mutates the post's own content — it only adds/
// removes an overlay sibling and a CSS class.

export const REASON_LABELS = {
  engagement_bait: "Engagement bait",
  formulaic_storytelling: "Formulaic story",
  formulaic_rhetorical_hook: "Scripted rhetorical hook",
  fake_profound_framing: "Fake-profound framing",
  vague_sourcing: "Vague sourcing",
  generic_filler: "Generic filler",
  corporate_phrasing: "Corporate jargon",
  adversarial_instruction_detected: "Suspicious content",
};

export function applyDecision(cardEl, { decision, reasonCodes = [] }) {
  cardEl.dataset.slopDecision = decision;
  removeOverlay(cardEl);
  // PROJECT.md: leave posts visible on keep AND on uncertain — only a
  // definitive "filter" gets blurred.
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

  const label = reasonCodes.map((c) => REASON_LABELS[c]).filter(Boolean).join(", ") || "Low-value post";

  const reasonEl = document.createElement("span");
  reasonEl.className = "slop-filter-reason";
  reasonEl.textContent = `Filtered: ${label}`;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "slop-filter-reveal";
  button.textContent = "Show post";
  button.addEventListener("click", () => {
    const card = overlay.closest("[data-slop-decision]");
    revealPost(card);
  });

  overlay.append(ribbonWrap, reasonEl, button);
  return overlay;
}

export function revealPost(cardEl) {
  if (!cardEl) return;
  cardEl.classList.remove("slop-filter-blurred");
  removeOverlay(cardEl);
  cardEl.dataset.slopDecision = "revealed";
}

function removeOverlay(cardEl) {
  const existing = cardEl.querySelector(":scope > .slop-filter-overlay");
  if (existing) existing.remove();
}

// Disabling the filter reveals every currently-blurred card. Re-enabling
// does not re-blur automatically here — the caller (content.js / harness)
// re-scans and re-applies decisions, since "enabled" and "has a decision"
// are separate states.
export function revealAll(root, selector) {
  root.querySelectorAll(selector).forEach((card) => revealPost(card));
}
