// MV3 background service worker. Declared as "type": "module" in the
// manifest, so (unlike content scripts) static imports work here.
//
// The placeholder classifier is not used on the live path. Real TypeSafe/Jev calls happen here — never in content.js, the
// popup, or the options page, all of which have `window`/`document` and
// are the "browser" context the SDK's own refuseBrowser() guard warns
// about (see typesafeClient.js's header comment).
import { classifyPost } from "./typesafeClient.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["slopFilterEnabled"], (res) => {
    if (res.slopFilterEnabled === undefined) {
      chrome.storage.local.set({ slopFilterEnabled: true });
    }
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "CLASSIFY_POST") return false;

  classifyPost(message.text ?? "")
    .then(sendResponse)
    // ARCHITECTURE.md: any failure leaves the post visible, never filtered.
    // classifyPost() already catches its own errors and resolves null, so
    // this only guards against something unexpected in the chain itself.
    .catch(() => sendResponse(null));
  return true; // keep the message channel open for the async sendResponse
});
