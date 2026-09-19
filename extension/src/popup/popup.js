const toggle = document.getElementById("enabled-toggle");

chrome.storage.local.get(["slopFilterEnabled"], (res) => {
  toggle.checked = res.slopFilterEnabled !== false;
});

toggle.addEventListener("change", () => {
  chrome.storage.local.set({ slopFilterEnabled: toggle.checked });
});

document.getElementById("options-link").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
