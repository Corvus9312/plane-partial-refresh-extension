# AGENTS.md

## 專案是什麼

瀏覽器擴充套件(Manifest V3,Chrome / Firefox 通用)。在 `app.plane.so` 上:
- **點工具列圖示** → 對目前分頁做局部刷新
- **擴充套件選項頁** → 設定定時刷新 / 回來自動刷新(全域,通常設一次)
- 頁面上**沒有**懸浮控制條

個人自用,**不上架公開商店**,Firefox 走 AMO 的 self-distribution(unlisted)簽署。

## 核心檔案

- `manifest.json` — Manifest V3。`host_permissions` / `content_scripts.matches` 用
  `*://app.plane.so/*`(需要保留星號萬用字元)。`action` 不設 `default_popup`,才能用
  `chrome.action.onClicked`。`options_ui` 指向 `options.html`。`background` 同時寫
  `service_worker` 與 `scripts` 以兼顧 Chrome / Firefox。
- `content.js` — content script:局部刷新邏輯 + 讀取全域 storage 跑定時/回來刷新 +
  接收 `PPR_REFRESH` 訊息。不注入 UI。刷新優先走 Plane MobX store 的
  `fetchIssuesWithExistingPagination` / `fetchIssues`;抓不到再 navigate 跳走再跳回;
  再不行 `location.reload()`。
- `background.js` — 點圖示時對 Plane 分頁 `tabs.sendMessage({ type: "PPR_REFRESH" })`;
  非 Plane 頁則 `openOptionsPage()`。
- `options.html` / `options.js` — 設定頁。storage key:`autoRefresh`、`focusRefresh`(全域)。
  `focusRefresh.minGapSeconds` 預設 60,距上次刷新未滿這秒數,回來時不自動刷。
- `README.md` — 安裝 / 使用 / 打包說明。含 `.zip` / `.xpi` 用法;上 Release 時也要寫。
- `package.ps1` — 建置腳本。產出 `.zip`;`.xpi` 需另經 AMO 簽署。
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

## Release / 上版

上 GitHub Release 時,**同時附上** `.zip` 與 `.xpi`,並在 Release 說明裡寫清楚安裝方式
(可直接對齊或摘要 `README.md` 的「從 GitHub Release 安裝」):

- **`.zip`**（`package.ps1` 產出）→ **Chrome / Edge**：解壓 → `chrome://extensions` →
  開發人員模式 →「載入未封裝項目」→ 選解壓資料夾。Chrome **不能**裝 `.xpi`，也**不能**
  雙擊 zip 安裝。
- **`.xpi`**（把同一份 zip 上傳 AMO self-distribution / unlisted 簽署後下載）→ **Firefox**：
  用 Firefox 開啟該 `.xpi`（拖進視窗或「開啟檔案」）即可永久安裝。Firefox 臨時載入則仍可
  選資料夾裡的 `manifest.json`。
- 開頭加一句：**`.xpi` 只給 Firefox，`.zip` 給 Chrome/Edge，兩邊不相通。**

Release body 建議至少包含上述 zip / xpi 使用步驟，不要只貼變更說明卻沒寫怎麼裝。

## 測試(換裝置或改完程式碼都要重新走一次)

**Chrome/Edge**:`chrome://extensions` → 開發人員模式 → 載入未封裝項目 → 選這個資料夾。

**Firefox**:`about:debugging#/runtime/this-firefox` → 載入臨時附加元件 → 選 `manifest.json`
(每次重開 Firefox 就會消失,要重載)。

打開 `app.plane.so` 任一頁面後檢查:
1. 頁面上**沒有**懸浮控制條;Console 沒有紅字 error
2. 點工具列擴充套件圖示 → 觸發局部刷新(Network 有重新打 API,盡不整頁重載 JS/CSS)
3. 非 Plane 分頁點圖示 → 應打開選項頁
4. 選項頁開關「定時刷新」後,Plane 分頁會依間隔自動刷新;改間隔會重設節奏
5. 「回來自動刷新」勾選後:切走再回來時,若距上次刷新(含手動/定時)未滿設定秒數(預設 60)**不該**刷新;滿了才刷一次
6. reload 分頁後選項設定仍生效(全域 `chrome.storage.local`)
7. 抓不到 store / router 時要能 fallback,不能拋錯卡死

## 給 agent 的提醒

- 這個專案沒有 build 流程、沒有 bundler,JS 都是直接被瀏覽器執行的原始檔。
- 不要把 `web-ext-artifacts/`、任何 `.zip`、`node_modules/` commit 進去(已在 `.gitignore`)。
- `manifest.json` 裡的 match pattern 字元(`*`)很容易在複製貼上時被吃掉,改完建議打開檔案核對。
- 不要幫 `action` 加 `default_popup`,否則點圖示不會觸發 `onClicked` 刷新。
- repo 是 `Corvus9312/plane-partial-refresh-extension`,已設好 `origin` 遠端,commit/push 前
  照一般流程確認 diff 內容再操作。
