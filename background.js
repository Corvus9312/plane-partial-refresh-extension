// 點工具列圖示 → 對目前分頁的 content script 下達局部刷新
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.id == null) return;

  const url = tab.url || "";
  if (!/^https?:\/\/app\.plane\.so\//i.test(url)) {
    // 不在 Plane 頁面時開選項頁,避免「點了沒反應」
    try {
      await chrome.runtime.openOptionsPage();
    } catch (e) {}
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "PPR_REFRESH" });
  } catch (e) {
    // content script 尚未注入(剛開分頁等),略過
    console.warn("[plane-partial-refresh] 無法對此分頁送出刷新訊息", e);
  }
});
