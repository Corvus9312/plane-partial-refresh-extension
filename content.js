(function () {
  const AUTO_REFRESH_KEY = "autoRefresh";
  const FOCUS_REFRESH_KEY = "focusRefresh";
  const MIN_FOCUS_REFRESH_GAP_MS = 10000; // 10 秒內重複切回來,不重複觸發,避免洗版

  // 舊版懸浮控制條若還留在頁面上,清掉
  const legacy = document.getElementById("pane_partial_refresh_widget");
  if (legacy) legacy.remove();

  // ---------- 局部刷新核心邏輯 ----------
  // content script 跟頁面本身的 JS 是分開的執行環境,沒辦法直接摸到頁面自己的
  // MobX store / router,所以注入一個 <script> 標籤,讓程式碼跑在頁面環境裡。
  function triggerPartialRefresh() {
    const script = document.createElement("script");
    // 優先走 Plane 內部 MobX store 的 fetchIssuesWithExistingPagination("mutation"),
    // 這跟改篩選條件時的重抓一樣:不換頁、不閃爍,只重新打 API 並讓 observer 重繪。
    // 抓不到 store 時才退回跳走再跳回;再不行才整頁 reload。
    script.textContent = `(function () {
      const log = (...args) => console.log("[plane-partial-refresh]", ...args);
      const warn = (...args) => console.warn("[plane-partial-refresh]", ...args);

      function fiberOf(el) {
        if (!el) return null;
        for (const k of Object.keys(el)) {
          if (k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")) return el[k];
          if (k.startsWith("__reactContainer$")) return el[k].stateNode?.current || el[k];
        }
        return null;
      }

      function findRootStore() {
        const seeds = [];
        for (const el of [
          document.getElementById("root"),
          document.querySelector("#app"),
          document.body?.firstElementChild,
          document.body,
        ]) {
          const f = fiberOf(el);
          if (f) seeds.push(f);
        }
        const seen = new Set();
        const q = seeds.slice();
        let n = 0;
        while (q.length && n < 12000) {
          const fiber = q.shift();
          if (!fiber || seen.has(fiber)) continue;
          seen.add(fiber);
          n++;
          const value = fiber.memoizedProps?.value ?? fiber.pendingProps?.value;
          if (value && value.issue && (value.issue.projectIssues || value.issue.cycleIssues)) {
            return value;
          }
          if (fiber.child) q.push(fiber.child);
          if (fiber.sibling) q.push(fiber.sibling);
        }
        return null;
      }

      function parseProjectPath(pathname) {
        const m = pathname.match(/^\\/([^\\/]+)\\/projects\\/([0-9a-fA-F-]+)(?:\\/([^\\/]+))?(?:\\/([^\\/]+))?/);
        if (!m) return null;
        return { workspaceSlug: m[1], projectId: m[2], section: m[3] || "", entityId: m[4] || "" };
      }

      async function softRefreshViaStore(rootStore) {
        const parsed = parseProjectPath(location.pathname);
        if (!parsed) return false;
        const { workspaceSlug, projectId, section, entityId } = parsed;
        const issue = rootStore.issue;
        if (!issue) return false;

        const opts = { canGroup: true, perPageCount: 100 };
        let store = null;
        let args = null;

        if (section === "cycles" && entityId && issue.cycleIssues) {
          store = issue.cycleIssues;
          args = [workspaceSlug, projectId, "mutation", entityId];
        } else if (section === "modules" && entityId && issue.moduleIssues) {
          store = issue.moduleIssues;
          args = [workspaceSlug, projectId, "mutation", entityId];
        } else if (section === "views" && entityId && issue.projectViewIssues) {
          store = issue.projectViewIssues;
          args = [workspaceSlug, projectId, "mutation", entityId];
        } else if (issue.projectIssues) {
          store = issue.projectIssues;
          args = [workspaceSlug, projectId, "mutation"];
        }

        if (!store || !args) return false;

        if (typeof store.fetchIssuesWithExistingPagination === "function" && store.paginationOptions) {
          log("store mutation refresh:", section || "issues", args.slice(0, 2).join("/"));
          await store.fetchIssuesWithExistingPagination(...args);
          return true;
        }
        if (typeof store.fetchIssues === "function") {
          log("store fetchIssues refresh:", section || "issues");
          if (section === "cycles" && entityId) {
            await store.fetchIssues(workspaceSlug, projectId, "mutation", opts, entityId);
          } else if (section === "modules" && entityId) {
            await store.fetchIssues(workspaceSlug, projectId, "mutation", opts, entityId);
          } else if (section === "views" && entityId) {
            await store.fetchIssues(workspaceSlug, projectId, "mutation", opts, entityId);
          } else {
            await store.fetchIssues(workspaceSlug, projectId, "mutation", opts);
          }
          return true;
        }
        return false;
      }

      function navigateAwayAndBack() {
        const r = window.__reactRouterDataRouter;
        if (!r || typeof r.navigate !== "function" || !r.state) {
          warn("找不到 router,改用整頁刷新 fallback");
          location.reload();
          return;
        }
        const pathname = r.state.location.pathname;
        const originalPath = pathname + r.state.location.search;
        const m = pathname.match(/^(\\/[^\\/]+\\/projects\\/[0-9a-fA-F-]+)(?:\\/([^\\/]+))?/);
        if (!m) {
          warn("不是專案內頁面,改用整頁刷新 fallback");
          location.reload();
          return;
        }
        const projectBase = m[1];
        const currentSection = m[2] || "";
        const sections = ["issues", "cycles", "modules", "views", "pages"];
        const awaySection = sections.find((s) => s !== currentSection) || "issues";
        const awayPath = projectBase + "/" + awaySection + "/";

        if (!document.getElementById("__ppr_refresh_overlay__")) {
          const overlay = document.createElement("div");
          overlay.id = "__ppr_refresh_overlay__";
          overlay.style.cssText = "position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,0.35);pointer-events:none;display:flex;align-items:center;justify-content:center;color:#e5e7eb;font:13px/1.4 -apple-system,Segoe UI,Arial,sans-serif;";
          overlay.textContent = "局部刷新中…";
          document.documentElement.appendChild(overlay);
          setTimeout(() => overlay.remove(), 500);
        }

        log("store 不可用,退回跳走再跳回:", awayPath, "→", originalPath);
        r.navigate(awayPath, { replace: true });
        setTimeout(() => { r.navigate(originalPath, { replace: true }); }, 250);
      }

      (async () => {
        try {
          const rootStore = findRootStore();
          if (rootStore) {
            const ok = await softRefreshViaStore(rootStore);
            if (ok) return;
            warn("找到 store 但這頁沒對應的 issues API,退回跳走再跳回");
          } else {
            warn("找不到 Plane rootStore,退回跳走再跳回");
          }
          navigateAwayAndBack();
        } catch (e) {
          console.error("[plane-partial-refresh] 發生錯誤,改用整頁刷新 fallback", e);
          location.reload();
        }
      })();
    })();`;
    document.documentElement.appendChild(script);
    script.remove();
  }

  // ---------- 設定(全域,在擴充套件選項頁調整) ----------
  let autoEnabled = false;
  let autoSeconds = 300;
  let focusEnabled = false;
  let timerId = null;
  let lastFocusRefreshAt = 0;

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startTimer(seconds) {
    stopTimer();
    let countdown = seconds;
    timerId = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) {
        triggerPartialRefresh();
        countdown = seconds;
      }
    }, 1000);
  }

  function applyAutoRefresh() {
    if (autoEnabled) {
      startTimer(autoSeconds);
    } else {
      stopTimer();
    }
  }

  function loadSettings() {
    try {
      chrome.storage.local.get([AUTO_REFRESH_KEY, FOCUS_REFRESH_KEY], (res) => {
        const auto = res[AUTO_REFRESH_KEY];
        const focus = res[FOCUS_REFRESH_KEY];
        autoEnabled = !!(auto && auto.enabled);
        autoSeconds = (auto && auto.seconds) || 300;
        focusEnabled = !!(focus && focus.enabled);
        applyAutoRefresh();
      });
    } catch (e) {}
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[AUTO_REFRESH_KEY]) {
      const auto = changes[AUTO_REFRESH_KEY].newValue;
      autoEnabled = !!(auto && auto.enabled);
      autoSeconds = (auto && auto.seconds) || 300;
      applyAutoRefresh();
    }
    if (changes[FOCUS_REFRESH_KEY]) {
      const focus = changes[FOCUS_REFRESH_KEY].newValue;
      focusEnabled = !!(focus && focus.enabled);
    }
  });

  function maybeRefreshOnReturn() {
    if (!focusEnabled) return;
    if (document.hidden) return;
    const now = Date.now();
    if (now - lastFocusRefreshAt < MIN_FOCUS_REFRESH_GAP_MS) return;
    lastFocusRefreshAt = now;
    triggerPartialRefresh();
  }

  document.addEventListener("visibilitychange", maybeRefreshOnReturn);
  window.addEventListener("focus", maybeRefreshOnReturn);

  // 工具列圖示點擊 → background 轉送訊息到這裡
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "PPR_REFRESH") {
      triggerPartialRefresh();
      sendResponse({ ok: true });
      return true;
    }
  });

  loadSettings();
})();
