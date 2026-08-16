# Plane 工作項目局部刷新小工具

解決 Plane「work 區塊不會自己更新,只有整頁 F5 才有效,但整頁重整太浪費資源」的問題。

## 原理

Plane 是用 React + React Router 寫的 SPA。實測發現:

* 切換 List / Board 檢視模式不會重新抓資料
* 只改網址參數不會重新抓資料
* 但是「路由跳走再跳回來」會讓 Plane 自己重新呼叫 API、自己重新渲染畫面

所以這個工具會呼叫 Plane 頁面自己的 `window.__reactRouterDataRouter.navigate()`,
在同一個分頁裡跳到專案首頁、0.25 秒後再跳回原本頁面,全程都在 Plane 的 SPA 路由裡完成,
不會整頁重新載入(不會重抓 JS/CSS/圖片這些靜態資源),比 F5 輕量很多。

如果哪天 Plane 改版導致抓不到這個 router 物件,工具會自動退回整頁刷新,不會整個壞掉。

## 安裝方式

### Firefox

1. 解壓縮這個資料夾,放在電腦上固定位置(暫時載入的擴充套件,瀏覽器關掉就會被移除,需要每次重開瀏覽器後重新載入,或改用永久簽署安裝)
2. 網址列輸入 `about:debugging#/runtime/this-firefox`
3. 點「載入臨時附加元件」(Load Temporary Add-on)
4. 選擇解壓後資料夾裡的 `manifest.json` 檔案
5. 之後打開 `https://app.plane.so` 底下任何頁面,右下角就會自動出現控制條

注意:「臨時附加元件」在 Firefox 關閉後就會消失,下次要用得重新載入一次。如果想要永久保留,需要到
`https://addons.mozilla.org/developers/` 走簽署流程,或使用 Firefox Developer Edition / Nightly
並在 `about:config` 把 `xpinstall.signatures.required` 設為 `false` 後用「安裝」而非「臨時載入」。

### Chrome / Edge 等 Chromium 系瀏覽器

1. 解壓縮資料夾
2. 網址列輸入 `chrome://extensions`,打開右上角「開發人員模式」
3. 點「載入未封裝項目」,選擇解壓後的資料夾
4. 打開 Plane 頁面,右下角會自動出現控制條

## 使用方式

1. 打開你的 Plane work 頁面,右下角會自動出現控制條(不用手動點擊圖示啟用)
2. 「局部刷新」:立即觸發一次(跳走再跳回,約 0.3 秒完成)
3. 「定時刷新」勾選後,依你選的間隔(1/3/5/10/30 分)定時自動局部刷新
4. 「回來自動刷新」勾選後,只要你從別的視窗/分頁切回這個分頁,就會自動刷新一次
   (10 秒內重複切回來不會重複觸發,避免洗版;真的要立即再刷新可以直接按「局部刷新」按鈕)
5. 「定時刷新」跟「回來自動刷新」可以同時開,互不衝突
6. 按 ➖ 可以把控制條收起來,收起後右下角會留一個小圓按鈕,點它可以再打開

## 打包

要產生可以直接上傳到 AMO(Firefox 自我發布簽署)或 Chrome 開發者後台的 `.zip`,在專案根目錄跑:

```bash
powershell -ExecutionPolicy Bypass -File package.ps1
```

會自動讀取 `manifest.json` 裡的版號,輸出到 `web-ext-artifacts\plane-partial-refresh-extension-<版本>.zip`,
內容只包含 `manifest.json`、`content.js`、`README.md`、`LICENSE`(排除 `.git`、`node_modules`、
`web-ext-artifacts` 等開發用檔案),`manifest.json` 會放在 zip 根目錄,符合上傳要求。

改版號、加新檔案都不用改這支腳本,直接重跑即可。

## 注意事項

* 這個做法依賴 Plane 內部一個叫 `__reactRouterDataRouter` 的物件,是我們實際連進你的 Plane
  頁面用瀏覽器工具驗證過確實存在、確實有效的。但這是 Plane 沒有公開保證的內部實作細節,
  如果之後 Plane 改版拿掉或改名這個物件,工具偵測不到時會自動退回整頁 `location.reload()`,
  不會讓頁面卡死,只是效果退回跟 F5 一樣。
* 跳走再跳回的瞬間,畫面會有極短暫(<0.3秒)閃到專案首頁再閃回來,這是正常現象。
* 自動刷新設定記在瀏覽器本機儲存(依網址記憶),同一個網址下次打開會自動恢復上次設定。
