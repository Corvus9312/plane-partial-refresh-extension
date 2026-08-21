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
  `fetchIssuesWithExistingPagination` / `fetchIssues`;接著重抓目前 peek / 詳情頁 /
  已載入過描述的 work item(`issueDetail.fetchIssue`);目前開著的 peek 側欄會先重抓再
  短暫關開以強制描述編輯器重掛。抓不到再 navigate 跳走再跳回;再不行 `location.reload()`。
  定時 / 回來自動刷新只在 work items 頁(`/projects/.../issues`)觸發;手動點圖示不受限。
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

上 GitHub Release 時必做兩件事:

1. **附件**：同時附上 `.zip` 與 `.xpi`（有簽好的 xpi 再發；還沒拿到 xpi 就先不要發缺檔的 Release）。
2. **Release 說明必須含「檔案怎麼用」**，不能只寫變更摘要。舊版 Release 常漏這段，之後每一版都要有。

可對齊或摘要 `README.md` 的「從 GitHub Release 安裝」。Release body **建議直接用下面範本**（變更說明可接在後面）:

```markdown
`.xpi` 只給 Firefox，`.zip` 給 Chrome/Edge，兩邊不相通。

### Chrome / Edge（用 `.zip`）
1. 下載 Release 的 `.zip`，解壓到固定位置
2. 開啟 `chrome://extensions`（Edge：`edge://extensions`）
3. 打開「開發人員模式」→「載入未封裝項目」→ 選**解壓後的資料夾**
4. 注意：不能雙擊 zip 安裝，也不能裝 `.xpi`

### Firefox（用 `.xpi`）
1. 下載 Release 的 `.xpi`（AMO 自我發布簽署後的檔）
2. 用 Firefox 開啟該檔（拖進視窗，或「檔案 → 開啟檔案」）完成永久安裝
3. 開發／未簽署時仍可用 `about:debugging#/runtime/this-firefox` 臨時載入 `manifest.json`

### 變更
- （此版變更要點）
```

重點對照:

- **`.zip`**（`package.ps1` 產出）→ Chrome / Edge 解壓後「載入未封裝項目」
- **`.xpi`**（同一份 zip 上傳 AMO unlisted 簽署後下載）→ Firefox 開啟安裝
- 開頭一定要有：**`.xpi` 只給 Firefox，`.zip` 給 Chrome/Edge，兩邊不相通。**

## 測試(換裝置或改完程式碼都要重新走一次)

**Chrome/Edge**:`chrome://extensions` → 開發人員模式 → 載入未封裝項目 → 選這個資料夾。

**Firefox**:`about:debugging#/runtime/this-firefox` → 載入臨時附加元件 → 選 `manifest.json`
(每次重開 Firefox 就會消失,要重載)。

打開 `app.plane.so` 任一頁面後檢查:
1. 頁面上**沒有**懸浮控制條;Console 沒有紅字 error
2. 點工具列擴充套件圖示 → 觸發局部刷新(Network 有重新打 API,盡不整頁重載 JS/CSS)
3. 非 Plane 分頁點圖示 → 應打開選項頁
4. 選項頁開關「定時刷新」後,在 work items 頁(`/projects/.../issues`)會依間隔自動刷新;其它 Plane 頁時間到也不該刷;改間隔會重設節奏
5. 「回來自動刷新」勾選後:切走再回來時,若不在 work items 頁**不該**刷;若距上次刷新(含手動/定時)未滿設定秒數(預設 60)**不該**刷新;滿了才刷一次
6. 手動點圖示在非 work items 的 Plane 頁仍可刷新
7. reload 分頁後選項設定仍生效(全域 `chrome.storage.local`)
8. 抓不到 store / router 時要能 fallback,不能拋錯卡死

## 給 agent 的提醒

- 這個專案沒有 build 流程、沒有 bundler,JS 都是直接被瀏覽器執行的原始檔。
- 不要把 `web-ext-artifacts/`、任何 `.zip`、`node_modules/` commit 進去(已在 `.gitignore`)。
- `manifest.json` 裡的 match pattern 字元(`*`)很容易在複製貼上時被吃掉,改完建議打開檔案核對。
- 不要幫 `action` 加 `default_popup`,否則點圖示不會觸發 `onClicked` 刷新。
- 上 GitHub Release 時 Release body **一定要**含 zip / xpi 使用教學(見上方「Release / 上版」
  範本),不要只寫變更說明;還沒有簽署好的 `.xpi` 就先不要發缺附件的 Release。
- repo 是 `Corvus9312/plane-partial-refresh-extension`,已設好 `origin` 遠端,commit/push 前
  照一般流程確認 diff 內容再操作。
