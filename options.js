(function () {
  const AUTO_REFRESH_KEY = "autoRefresh";
  const FOCUS_REFRESH_KEY = "focusRefresh";

  const autoEnabledEl = document.getElementById("autoEnabled");
  const autoSecondsEl = document.getElementById("autoSeconds");
  const focusEnabledEl = document.getElementById("focusEnabled");
  const statusEl = document.getElementById("status");

  let saveTimer = null;

  function flashSaved() {
    statusEl.textContent = "已儲存";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      statusEl.textContent = "";
    }, 1200);
  }

  function save() {
    const seconds = parseInt(autoSecondsEl.value, 10) || 300;
    chrome.storage.local.set(
      {
        [AUTO_REFRESH_KEY]: { enabled: autoEnabledEl.checked, seconds },
        [FOCUS_REFRESH_KEY]: { enabled: focusEnabledEl.checked },
      },
      flashSaved
    );
  }

  chrome.storage.local.get([AUTO_REFRESH_KEY, FOCUS_REFRESH_KEY], (res) => {
    const auto = res[AUTO_REFRESH_KEY];
    const focus = res[FOCUS_REFRESH_KEY];
    if (auto) {
      autoEnabledEl.checked = !!auto.enabled;
      if (auto.seconds) autoSecondsEl.value = String(auto.seconds);
    }
    if (focus) {
      focusEnabledEl.checked = !!focus.enabled;
    }
  });

  autoEnabledEl.addEventListener("change", save);
  autoSecondsEl.addEventListener("change", save);
  focusEnabledEl.addEventListener("change", save);
})();
