(function () {
  const WIDGET_ID = "pane_partial_refresh_widget";
  const STORAGE_KEY = "autoRefresh:" + location.origin + location.pathname;
  const FOCUS_STORAGE_KEY = "focusRefresh:" + location.origin + location.pathname;
  const MIN_FOCUS_REFRESH_GAP_MS = 10000; // 10 秒內重複切回來,不重複觸發,避免洗版

  if (document.getElementById(WIDGET_ID)) return; // 避免重複注入

  // ---------- 局部刷新核心邏輯 ----------
  // content script 跟頁面本身的 JS 是分開的執行環境,沒辦法直接摸到頁面自己的
  // window.__reactRouterDataRouter,所以注入一個 <script> 標籤,讓程式碼跑在
  // 頁面自己的環境裡執行,才拿得到這個物件。
  function triggerPartialRefresh() {
    const script = document.createElement("script");
    script.textContent = `(function () {
      try {
        const r = window.__reactRouterDataRouter;
        if (!r) {
          console.warn("[plane-partial-refresh] 找不到 router,改用整頁刷新 fallback");
          location.reload();
          return;
        }
        if (typeof r.revalidate === "function") {
          // 直接重新跑目前頁面的資料載入,不換頁,不會有跳走再跳回時的閃爍或中繼頁 404
          console.log("[plane-partial-refresh] 使用 revalidate() 重新整理,沒有換頁");
          r.revalidate();
          return;
        }
        if (typeof r.navigate !== "function" || !r.state) {
          console.warn("[plane-partial-refresh] 找不到可用的 router API,改用整頁刷新 fallback");
          location.reload();
          return;
        }
        console.log("[plane-partial-refresh] 沒有 revalidate(),退回跳走再跳回的做法");
        const originalPath = r.state.location.pathname + r.state.location.search;
        const m = r.state.location.pathname.match(/^(\\/[^\\/]+\\/projects\\/[0-9a-fA-F-]+\\/)/);
        const awayPath = (m && m[1] !== r.state.location.pathname) ? m[1] : "/";
        r.navigate(awayPath);
        setTimeout(() => { r.navigate(originalPath); }, 250);
      } catch (e) {
        console.error("[plane-partial-refresh] 發生錯誤,改用整頁刷新 fallback", e);
        location.reload();
      }
    })();`;
    document.documentElement.appendChild(script);
    script.remove();
  }

  // ---------- 懸浮控制條 UI ----------
  const box = document.createElement("div");
  box.id = WIDGET_ID;
  box.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    background: #1f2937;
    color: #fff;
    font-family: -apple-system, "Segoe UI", Arial, sans-serif;
    font-size: 13px;
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    user-select: none;
  `;

  box.innerHTML = `
    <button id="__ppr_refresh_now__" title="觸發 Plane 自己的路由重新抓取資料,不整頁重載" style="
      background:#2563eb;color:#fff;border:none;border-radius:6px;
      padding:6px 10px;cursor:pointer;font-size:13px;">局部刷新</button>
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
      <input id="__ppr_toggle__" type="checkbox" style="cursor:pointer;"> 定時刷新
    </label>
    <select id="__ppr_interval__" style="border-radius:6px;border:none;padding:4px;">
      <option value="60">1 分</option>
      <option value="180">3 分</option>
      <option value="300" selected>5 分</option>
      <option value="600">10 分</option>
      <option value="1800">30 分</option>
    </select>
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;" title="切到別的視窗/分頁,再切回這個分頁時,自動刷新一次">
      <input id="__ppr_focus_toggle__" type="checkbox" style="cursor:pointer;"> 回來自動刷新
    </label>
    <span id="__ppr_status__" style="opacity:0.75;min-width:70px;"></span>
    <button id="__ppr_collapse__" title="收起小工具" style="
      background:transparent;color:#9ca3af;border:none;cursor:pointer;font-size:14px;">➖</button>
  `;

  document.body.appendChild(box);

  const statusEl = box.querySelector("#__ppr_status__");
  const toggleEl = box.querySelector("#__ppr_toggle__");
  const intervalEl = box.querySelector("#__ppr_interval__");

  let timerId = null;
  let countdown = 0;

  function tickLabel() {
    if (!toggleEl.checked) {
      statusEl.textContent = "";
      return;
    }
    statusEl.textContent = `下次刷新：${countdown}s`;
  }

  function startTimer(seconds) {
    stopTimer();
    countdown = seconds;
    tickLabel();
    timerId = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) {
        triggerPartialRefresh();
        countdown = seconds;
      }
      tickLabel();
    }, 1000);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    statusEl.textContent = "";
  }

  box.querySelector("#__ppr_refresh_now__").addEventListener("click", () => {
    triggerPartialRefresh();
  });

  box.querySelector("#__ppr_collapse__").addEventListener("click", () => {
    box.style.display = "none";
    const mini = document.createElement("button");
    mini.textContent = "⟳";
    mini.title = "打開 Plane 局部刷新小工具";
    mini.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      background:#2563eb;color:#fff;border:none;border-radius:50%;
      width:36px;height:36px;cursor:pointer;font-size:16px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    `;
    mini.addEventListener("click", () => {
      mini.remove();
      box.style.display = "flex";
    });
    document.body.appendChild(mini);
  });

  toggleEl.addEventListener("change", () => {
    const seconds = parseInt(intervalEl.value, 10);
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: { enabled: toggleEl.checked, seconds } });
    } catch (e) {}
    if (toggleEl.checked) {
      startTimer(seconds);
    } else {
      stopTimer();
    }
  });

  intervalEl.addEventListener("change", () => {
    if (toggleEl.checked) {
      const seconds = parseInt(intervalEl.value, 10);
      try {
        chrome.storage.local.set({ [STORAGE_KEY]: { enabled: true, seconds } });
      } catch (e) {}
      startTimer(seconds);
    }
  });

  try {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      const saved = res[STORAGE_KEY];
      if (saved && saved.enabled) {
        toggleEl.checked = true;
        intervalEl.value = String(saved.seconds || 300);
        startTimer(saved.seconds || 300);
      }
    });
  } catch (e) {}

  // ---------- 切回分頁時自動刷新 ----------
  const focusToggleEl = box.querySelector("#__ppr_focus_toggle__");
  let lastFocusRefreshAt = 0;

  function maybeRefreshOnReturn() {
    if (!focusToggleEl.checked) return;
    if (document.hidden) return; // 真的是「回到」才刷新,不是「離開」時刷新
    const now = Date.now();
    if (now - lastFocusRefreshAt < MIN_FOCUS_REFRESH_GAP_MS) return; // debounce,避免短時間內連續觸發
    lastFocusRefreshAt = now;
    triggerPartialRefresh();
  }

  document.addEventListener("visibilitychange", maybeRefreshOnReturn);
  window.addEventListener("focus", maybeRefreshOnReturn);

  focusToggleEl.addEventListener("change", () => {
    try {
      chrome.storage.local.set({ [FOCUS_STORAGE_KEY]: { enabled: focusToggleEl.checked } });
    } catch (e) {}
  });

  try {
    chrome.storage.local.get([FOCUS_STORAGE_KEY], (res) => {
      const saved = res[FOCUS_STORAGE_KEY];
      if (saved && saved.enabled) {
        focusToggleEl.checked = true;
      }
    });
  } catch (e) {}
})();
