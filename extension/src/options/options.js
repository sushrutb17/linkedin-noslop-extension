const toggle = document.getElementById("enabled-toggle");
const sensitivity = document.getElementById("sensitivity");
const apiKeyInput = document.getElementById("api-key");
const saveKeyButton = document.getElementById("save-key");
const keyStatus = document.getElementById("key-status");

chrome.storage.local.get(["slopFilterEnabled", "slopFilterSensitivity", "typesafeApiKey"], (res) => {
  toggle.checked = res.slopFilterEnabled !== false;
  sensitivity.value = res.slopFilterSensitivity ?? 50;
  if (res.typesafeApiKey) {
    apiKeyInput.placeholder = "•••• saved ••••";
  }
});

toggle.addEventListener("change", () => {
  chrome.storage.local.set({ slopFilterEnabled: toggle.checked });
});

saveKeyButton.addEventListener("click", () => {
  const value = apiKeyInput.value.trim();
  if (!value) {
    keyStatus.textContent = "Enter a key first.";
    keyStatus.className = "status err";
    return;
  }
  chrome.storage.local.set({ typesafeApiKey: value }, () => {
    apiKeyInput.value = "";
    apiKeyInput.placeholder = "•••• saved ••••";
    keyStatus.textContent = "Saved.";
    keyStatus.className = "status ok";
  });
});
