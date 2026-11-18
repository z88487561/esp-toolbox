# ESP 工具箱（PWA）
純靜態檔案，不需建置。需用 **HTTPS**（或 localhost）開啟，Web Bluetooth / Web Serial 才能使用。
- 本機測試：`python3 -m http.server 8000` → http://localhost:8000
- 上線：整個資料夾放到 GitHub Pages 即可。更新程式後把 `sw.js` 的 `V` 版本號 +1。
- 隱私：沒有任何 MAC 位址、SSID、PIN 寫在程式裡；燈具自訂名稱與已授權裝置只存在使用者自己的瀏覽器。

## 新增工具
1. 在 `js/tools/` 新增模組，預設匯出：
   `{id, icon, name, sub, tags:[], guide:[{h:'標題',li:['說明…']}], mount(root){ …; return cleanup }}`
2. 在 `js/registry.js` import 並加進陣列。陣列順序即預設顯示順序，使用者可在首頁「自訂排序」調整，也可用每個工具右上角的 ☀️/🌙 切換亮暗模式（舊版 iframe 工具除外）。
3. 共用工具：`core/ble.js`（寫入、記住/自動重連）、`core/ui.js`（toast、esc）。

所有工具皆為原生模組。`js/tools/legacy.js` 提供 `L()` 輔助函式，可暫時用 iframe 掛載舊的單檔頁面（放在 `legacy/`）。
