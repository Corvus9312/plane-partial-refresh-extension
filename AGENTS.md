# AGENTS.md

## 專案是什麼

瀏覽器擴充套件(Manifest V3,Chrome / Firefox 通用),在 `app.plane.so` 的頁面上加一個懸浮控制條,
可一鍵/定時/切回分頁時觸發 Plane 自身的 React Router 導航,達到「局部刷新資料但不整頁 reload」的效果。
個人自用,**不上架公開商店**,Firefox 走 AMO 的 self-distribution(unlisted)簽署。

## 核心檔案

- `manifest.json` — Manifest V3 設定。`host_permissions` / `content_scripts.matches` 用
  `*://app.plane.so/*`(需要保留星號萬用字元,少了會變成無效 match pattern)。
- `content.js` — 唯一的 content script,注入懸浮 UI + 局部刷新邏輯。UI 元素 id 一律是
  `__ppr_xxx__`(雙底線包住),`querySelector` 要對應同一個 id,兩邊對不起來按鈕會直接失效。
  局部刷新的原理是呼叫頁面自己的 `window.__reactRouterDataRouter.navigate()`,跳走再跳回;
  抓不到這個物件時要 fallback 成 `location.reload()`,不能讓頁面卡死。
- `README.md` — 安裝 / 使用 / 打包說明,面向使用者,不是給 agent 看的技術細節。
- `package.ps1` — 建置腳本,見下方「打包」。
- `LICENSE`

## 打包

```bash
powershell -ExecutionPolicy Bypass -File package.ps1
```

輸出到 `web-ext-artifacts\<資料夾名>-<manifest.json 裡的 version>.zip`,zip 根目錄直接放
`manifest.json`(不能多包一層資料夾,不然上傳驗證會找不到 manifest)。腳本本身、`.git`、
`node_modules`、`web-ext-artifacts`、其他 `.zip` 都會被排除,不會混進打包內容。

改版號、加新檔案(例如以後加 icon)都直接重跑這支腳本就好,不用改腳本邏輯——除非新增的是
子資料夾之外需要被排除的開發用檔案,才需要回來加排除規則。

## 測試(目前還沒實測過,換裝置或改完程式碼都要重新走一次)

**Chrome/Edge**:`chrome://extensions` → 開發人員模式 → 載入未封裝項目 → 選這個資料夾。

**Firefox**:`about:debugging#/runtime/this-firefox` → 載入臨時附加元件 → 選 `manifest.json`
(每次重開 Firefox 就會消失,要重載)。

打開 `app.plane.so` 任一頁面後檢查:
1. 右下角控制條有出現,Console 沒有紅字 error(尤其跟 `querySelector`/`null` 有關的)
2. 按「局部刷新」→ 畫面短暫閃一下,Network 面板能看到重新打 API,但沒有整頁重載(JS/CSS 沒有重抓)
3. 「定時刷新」勾選後倒數會跑,時間到自動觸發;改間隔會重設倒數
4. 「回來自動刷新」勾選後切分頁再切回來會觸發一次,10 秒內再切一次**不會**重複觸發
5. reload 分頁後兩個開關的狀態會恢復(存在 `chrome.storage.local`,依網址記憶)
6. 手動 `delete window.__reactRouterDataRouter` 後按「局部刷新」,要能正確 fallback 成整頁 reload,不能拋錯卡死

## 給 agent 的提醒

- 這個專案沒有 build 流程、沒有 bundler,`content.js` 就是直接被瀏覽器當 content script 執行的
  原始檔案,改的時候不用考慮 transpile/minify。
- 不要把 `web-ext-artifacts/`、任何 `.zip`、`node_modules/` commit 進去(已在 `.gitignore`)。
- `manifest.json` 裡的 match pattern 和 `content.js` 裡的 UI id,兩處的字元(`*`、`__`)很容易在
  複製貼上時被吃掉,改完之後建議實際打開檔案核對一次,不要只憑印象。
- repo 是 `Corvus9312/plane-partial-refresh-extension`,已設好 `origin` 遠端,commit/push 前
  照一般流程確認 diff 內容再操作。
