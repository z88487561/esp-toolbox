# ESP 工具箱（PWA）
純靜態檔案，不需建置。需用 **HTTPS**（或 localhost）開啟，Web Bluetooth / Web Serial 才能使用。
- 本機測試：`python3 -m http.server 8000` → http://localhost:8000
- 上線：整個資料夾放到 GitHub Pages 即可。更新程式後把 `sw.js` 的 `V` 版本號 +1。
- 隱私：沒有任何 MAC 位址、SSID、PIN 寫在程式裡；燈具自訂名稱與已授權裝置只存在使用者自己的瀏覽器。

## 新增工具
1. 在 `js/tools/` 新增模組，預設匯出：
   `{id, cat, icon, name, sub, tags:[], guide:[{h:'標題',li:['說明…']}], mount(root){ …; return cleanup }}`
2. 在 `js/registry.js` import 並加進陣列。`cat` 要是 `js/app.js` 裡 `CATS` 的其中一個（可自行增加）。
3. 共用工具：`core/ble.js`（寫入、記住/自動重連）、`core/ui.js`（toast、esc）。

`js/tools/legacy.js` 內的工具暫時用 iframe 跑原頁面（`legacy/`），改寫完成後移到 `js/tools/` 即可。
