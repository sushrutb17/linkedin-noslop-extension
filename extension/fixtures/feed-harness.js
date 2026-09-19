// Offline test harness for feed.html. Runs as a plain ES module in a normal
// browser tab — no extension installation, no chrome.* APIs — so the
// blur/reveal/toggle/truncation/dynamic-post presentation logic can be
// visually verified without needing a live LinkedIn session. Mirrors
// content.js's scan logic (truncation skip, MutationObserver, debounce) so
// this fixture actually exercises the same behavior, not just the simpler
// parts of it.
import { applyDecision, revealPost } from "../src/shared/postFilter.js";
import { placeholderClassify } from "../src/shared/placeholderClassifier.js";

const SELECTOR = "[data-slop-post-card]";
const TRUNCATION_SELECTOR = "[data-slop-truncated]";
const MIN_TEXT_LENGTH = 40;
const SCAN_DEBOUNCE_MS = 150;

let filterEnabled = true;
let debounceTimer = null;

function scheduleScan() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(scan, SCAN_DEBOUNCE_MS);
}

function scan() {
  if (!filterEnabled) return;
  document.querySelectorAll(SELECTOR).forEach((card) => {
    if (card.dataset.slopScanned) return;
    card.dataset.slopScanned = "1";

    const text = card.querySelector(".post-text").textContent.trim();
    const isTruncated = text.length < MIN_TEXT_LENGTH || card.querySelector(TRUNCATION_SELECTOR);
    if (isTruncated) {
      card.dataset.slopDecision = "uncertain";
      return;
    }
    applyDecision(card, placeholderClassify(text));
  });
}

document.getElementById("toggle-filter").addEventListener("change", (e) => {
  filterEnabled = e.target.checked;
  if (filterEnabled) {
    scan();
  } else {
    document.querySelectorAll(SELECTOR).forEach(revealPost);
  }
});

let newPostCount = 0;
document.getElementById("simulate-new-post").addEventListener("click", () => {
  newPostCount += 1;

  const author = document.createElement("div");
  author.className = "post-author";
  author.textContent = `Fictional User (dynamic ${newPostCount})`;

  const text = document.createElement("div");
  text.className = "post-text";
  text.textContent = "Which leader are you? 1) The Visionary 2) The Operator 3) The Connector. Drop your number below, I read every comment.";

  const card = document.createElement("article");
  card.setAttribute("data-slop-post-card", "");
  card.append(author, text);

  document.getElementById("feed").appendChild(card);
});

const observer = new MutationObserver(scheduleScan);
observer.observe(document.getElementById("feed"), { childList: true, subtree: true });

scan();
