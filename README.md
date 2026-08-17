# Plane 工作項目局部刷新小工具

解決 Plane「work 區塊不會自己更新,只有整頁 F5 才有效,但整頁重整太浪費資源」的問題。

## 原理

Plane 是用 React + React Router 寫的 SPA。工作項目資料主要在內部 MobX store。
本工具優先呼叫 Plane 的 store 重新抓資料並重繪；抓不到時才退回「路由跳走再跳回」,
再不行才整頁 `location.reload()`。全程盡量不重抓 JS/CSS,比 F5 輕量。

## 安裝方式

`.xpi` 只給 **Firefox** 用；`.zip` 給 **Chrome / Edge**（或當原始碼包）用，兩邊檔案**不相通**，請依瀏覽器下載對應檔。

### 從 GitHub Release 安裝（建議）

到本專案的 [Releases](https://github.com/Corvus9312/plane-partial-refresh-extension/releases) 下載對應版號的檔案。

#### Firefox（用 `.xpi`）

1. 下載 Release 裡的 `.xpi`（AMO 自我發布簽署後的附加元件）
2. 用 Firefox 打開該檔（可把 `.xpi` 拖進 Firefox 視窗，或選「檔案 → 開啟檔案」）
3. 依提示完成安裝；之後重開瀏覽器仍會保留，不必每次重載

若瀏覽器擋下未在商店公開上架的附加元件，請確認你下載的是已簽署的 `.xpi`，或改用下方「臨時載入」方式。

#### Chrome / Edge（用 `.zip`）

1. 下載 Release 裡的 `.zip`，解壓縮到固定位置（路徑之後不要亂移）
2. 網址列輸入 `chrome://extensions`（Edge 則為 `edge://extensions`）
3. 打開右上角「開發人員模式」
4. 點「載入未封裝項目」，選擇**解壓後的資料夾**（裡面要看得到 `manifest.json`）
5. 之後若你更新了解壓內容，到同一頁按「重新載入」即可

注意：Chrome **不能**安裝 `.xpi`；本機也**不能**直接雙擊 `.zip` 安裝，一定要解壓後用「載入未封裝項目」。

### 從原始碼臨時載入（開發 / 未簽署時）

#### Firefox

1. 取得專案資料夾（clone 或把 `.zip` 解壓），放在固定位置
2. 網址列輸入 `about:debugging#/runtime/this-firefox`
3. 點「載入臨時附加元件」(Load Temporary Add-on)
4. 選擇資料夾裡的 `manifest.json`

「臨時附加元件」在 Firefox 關閉後會消失，下次要重新載入。若要永久保留，請走 AMO
[`addons.mozilla.org/developers/`](https://addons.mozilla.org/developers/) 的自我發布簽署，
或使用 Firefox Developer Edition / Nightly，並在 `about:config` 把
`xpinstall.signatures.required` 設為 `false` 後用「安裝」而非「臨時載入」。

#### Chrome / Edge

1. 取得專案資料夾（或解壓 `.zip`）
2. `chrome://extensions` → 開發人員模式 →「載入未封裝項目」→ 選該資料夾

## 使用方式

畫面上**不會**再出現懸浮控制條。

1. **手動刷新**：打開 `https://app.plane.so` 的分頁後，點瀏覽器工具列上的本擴充套件圖示即可局部刷新一次  
   （若不在 Plane 頁面點圖示，會打開設定頁）
2. **設定**：到擴充套件管理頁開啟「選項 / 偏好設定」  
   - Chrome / Edge：`chrome://extensions` → 本擴充套件「詳細資料」→「擴充功能選項」  
   - Firefox：`about:addons` → 本附加元件 →「偏好設定」
3. 在設定頁可開關「定時刷新」（含間隔）與「回來自動刷新」；設定為全域，通常調一次即可
4. 「回來自動刷新」：從別的視窗/分頁切回 Plane 分頁時自動刷新一次（10 秒內不會重複觸發）
5. 「定時刷新」與「回來自動刷新」可同時開，互不衝突

## 打包

要產生可上傳 AMO（Firefox 簽署成 `.xpi`）或給 Chrome 解壓安裝的 `.zip`，在專案根目錄跑:

```bash
powershell -ExecutionPolicy Bypass -File package.ps1
```

會自動讀取 `manifest.json` 裡的版號,輸出到 `web-ext-artifacts\plane-partial-refresh-extension-<版本>.zip`,
內容只包含擴充套件執行所需檔案（含 `manifest.json`、`content.js`、`background.js`、`options.*`、`icons/`、
`README.md`、`LICENSE` 等）,排除 `.git`、`node_modules`、`web-ext-artifacts` 等開發用檔案;
`manifest.json` 會放在 zip 根目錄,符合上傳要求。

- **Chrome**：用這個 `.zip` 解壓後「載入未封裝項目」即可（不必上 Chrome Web Store）。
- **Firefox**：把同一個 `.zip` 上傳到 AMO 自我發布簽署，下載回來的才是可永久安裝的 `.xpi`。

改版號、加新檔案都不用改這支腳本,直接重跑即可。

## 注意事項

* 優先使用 Plane 內部 store 重抓資料；失敗時會退回路由跳走再跳回或整頁 reload。
  這些都是 Plane 沒有公開保證的內部細節,改版後可能需要再調整。
* 若走到「跳走再跳回」,畫面可能短暫閃一下,屬正常現象。
* 自動刷新設定存在瀏覽器本機 `chrome.storage.local`(全域),與網址無關。
